import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { NameTag, Friend, FriendRequest, PrivacySetting, SharedStats, InviteLink, SharingToggles } from '@/constants/types';
import { useAuth } from '@/providers/AuthProvider';
import {
  ensureUserProfile,
  updateUserProfile,
  searchUsers,
  sendFriendRequest as supaSendRequest,
  getIncomingRequests as supaGetIncoming,
  getOutgoingRequests as supaGetOutgoing,
  acceptFriendRequest as supaAcceptRequest,
  declineFriendRequest as supaDeclineRequest,
  cancelFriendRequest as supaCancelRequest,
  removeFriendship,
  getFriendsList,
  upsertUserStats,
  getFriendStats as supaGetFriendStats,
  createInviteLink as supaCreateInviteLink,
  UserProfileRow,
} from '@/utils/supabaseSocial';

const LEGACY_KEYS: Record<string, string> = {
  nameTag: 'tritrack_nametag',
  friends: 'tritrack_friends',
  incomingRequests: 'tritrack_incoming_requests',
  outgoingRequests: 'tritrack_outgoing_requests',
  privacy: 'tritrack_privacy',
  invites: 'tritrack_invites',
  sharing: 'tritrack_sharing',
};

function userKey(userId: string, base: string): string {
  return `tritrack:${userId}:${base}`;
}

async function getWithFallback(namespacedKey: string, legacyKey: string): Promise<string | null> {
  let val = await AsyncStorage.getItem(namespacedKey);
  if (val !== null) return val;
  val = await AsyncStorage.getItem(legacyKey);
  if (val !== null) {
    AsyncStorage.setItem(namespacedKey, val).catch(() => {});
    AsyncStorage.removeItem(legacyKey).catch(() => {});
    console.log(`[SocialProvider] Migrated key ${legacyKey} -> ${namespacedKey}`);
  }
  return val;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const DEFAULT_SHARING: SharingToggles = {
  shareWorkouts: true,
  shareBests: true,
  shareRecovery: true,
  shareEvents: true,
};

export interface SearchResultUser {
  id: string;
  userId: string;
  nameTag: string;
  displayName: string;
  photoUrl?: string;
}

export const [SocialProvider, useSocial] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { account, session, isSignedIn, authReady } = useAuth();

  const userId = account?.id ?? session?.user?.id ?? null;
  const storageScope = useMemo(() => getStorageScope(userId), [userId]);
  const storageScopeRef = useRef<string>('guest');
  const prevUserIdRef = useRef<string | null>(null);

  const [nameTag, setNameTag] = useState<NameTag | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [privacySetting, setPrivacySetting] = useState<PrivacySetting>('everything');
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [sharingToggles, setSharingToggles] = useState<SharingToggles>(DEFAULT_SHARING);
  const [supaProfile, setSupaProfile] = useState<UserProfileRow | null>(null);
  const [supabaseReady, setSupabaseReady] = useState<boolean>(false);

  useEffect(() => {
    storageScopeRef.current = storageScope;
  }, [storageScope]);

  const resetToDefaults = useCallback(() => {
    console.log('[SocialProvider] Resetting to defaults');
    setNameTag(null);
    setFriends([]);
    setIncomingRequests([]);
    setOutgoingRequests([]);
    setPrivacySetting('everything');
    setInviteLinks([]);
    setSharingToggles(DEFAULT_SHARING);
    setSupaProfile(null);
    setSupabaseReady(false);
  }, []);

  useEffect(() => {
    const prev = prevUserIdRef.current;
    prevUserIdRef.current = userId;

    if (prev !== null && prev !== userId) {
      console.log(`[SocialProvider] User changed from ${prev} to ${userId}, resetting`);
      resetToDefaults();
      queryClient.removeQueries({ queryKey: ['tritrack-social-local'] });
      queryClient.removeQueries({ queryKey: ['tritrack-social-local', prev] });
      queryClient.removeQueries({ queryKey: ['tritrack-social-local', storageScope] });
    }

    if (userId === null && prev !== null) {
      console.log('[SocialProvider] User signed out, resetting');
      resetToDefaults();
    }
  }, [queryClient, resetToDefaults, storageScope, userId]);

  const localDataQuery = useQuery({
    queryKey: ['tritrack-social-local', storageScope],
    queryFn: async () => {
      console.log('[SocialProvider] Loading local social data for scope:', storageScope);

      const scopedKey = (base: string) => storageKey(storageScope, base);

      const [nt, fr, inc, out, priv, inv, sh] = await Promise.all([
        getWithFallback(scopedKey('nametag'), LEGACY_KEYS.nameTag),
        getWithFallback(scopedKey('friends'), LEGACY_KEYS.friends),
        getWithFallback(scopedKey('incoming_requests'), LEGACY_KEYS.incomingRequests),
        getWithFallback(scopedKey('outgoing_requests'), LEGACY_KEYS.outgoingRequests),
        getWithFallback(scopedKey('privacy'), LEGACY_KEYS.privacy),
        getWithFallback(scopedKey('invites'), LEGACY_KEYS.invites),
        getWithFallback(scopedKey('sharing'), LEGACY_KEYS.sharing),
      ]);
      return {
        nameTag: nt ? JSON.parse(nt) : null,
        friends: fr ? JSON.parse(fr) : [],
        incomingRequests: inc ? JSON.parse(inc) : [],
        outgoingRequests: out ? JSON.parse(out) : [],
        privacySetting: priv ? JSON.parse(priv) : 'everything',
        inviteLinks: inv ? JSON.parse(inv) : [],
        sharingToggles: sh ? JSON.parse(sh) : DEFAULT_SHARING,
      };
    },
    enabled: authReady,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (authReady && localDataQuery.data) {
      console.log('[SocialProvider] Local data loaded');
      setNameTag(localDataQuery.data.nameTag);
      setFriends(localDataQuery.data.friends);
      setIncomingRequests(localDataQuery.data.incomingRequests);
      setOutgoingRequests(localDataQuery.data.outgoingRequests);
      setPrivacySetting(localDataQuery.data.privacySetting);
      setInviteLinks(localDataQuery.data.inviteLinks);
      setSharingToggles(localDataQuery.data.sharingToggles);
    }
  }, [authReady, localDataQuery.data]);

  const persistMutation = useMutation({
    mutationFn: async ({ key, data }: { key: string; data: unknown }) => {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    },
  });

  const persist = useCallback((base: string, data: unknown) => {
    const key = storageKey(storageScopeRef.current, base);
    persistMutation.mutate({ key, data });
  }, [persistMutation]);

  useEffect(() => {
    if (!isSignedIn || !session?.user || !account) {
      setSupabaseReady(false);
      return;
    }

    const initProfile = async () => {
      console.log('[SocialProvider] Initializing Supabase profile for:', account.email);
      try {
        const profile = await ensureUserProfile(
          session.user.id,
          account.displayName,
          nameTag?.tag
        );

        if (profile) {
          console.log('[SocialProvider] Supabase profile ready:', profile.name_tag);
          setSupaProfile(profile);
          setSupabaseReady(true);

          if (!nameTag || nameTag.tag !== profile.name_tag) {
            const newTag: NameTag = {
              tag: profile.name_tag,
              createdAt: profile.created_at,
              changesLeft: nameTag?.changesLeft ?? 1,
            };
            setNameTag(newTag);
            persist('nametag', newTag);
          }

          const supaFriends = await getFriendsList(session.user.id);
          console.log(`[SocialProvider] Loaded ${supaFriends.length} friends from Supabase`);
          setFriends(supaFriends);
          persist('friends', supaFriends);

          const [incoming, outgoing] = await Promise.all([
            supaGetIncoming(session.user.id),
            supaGetOutgoing(session.user.id),
          ]);
          setIncomingRequests(incoming);
          setOutgoingRequests(outgoing);
          persist('incoming_requests', incoming);
          persist('outgoing_requests', outgoing);
          console.log(`[SocialProvider] Loaded ${incoming.length} incoming, ${outgoing.length} outgoing requests`);
        } else {
          console.warn('[SocialProvider] Could not create Supabase profile (tables may not exist)');
          setSupabaseReady(false);
        }
      } catch (err) {
        console.error('[SocialProvider] Profile init error:', err);
        setSupabaseReady(false);
      }
    };

    void initProfile();
  }, [account, isSignedIn, nameTag, persist, session?.user]);

  const createNameTag = useCallback(async (tag: string) => {
    const cleaned = tag.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
    if (!cleaned) return false;

    if (supabaseReady && session?.user) {
      try {
        const updated = await updateUserProfile(session.user.id, { name_tag: cleaned.toLowerCase() });
        if (updated) {
          setSupaProfile(updated);
        }
      } catch (err) {
        console.error('[SocialProvider] Update name_tag error:', err);
        return false;
      }
    }

    const newTag: NameTag = {
      tag: cleaned,
      createdAt: new Date().toISOString(),
      changesLeft: 1,
    };
    setNameTag(newTag);
    persist('nametag', newTag);
    console.log('[SocialProvider] Name tag created:', cleaned);
    return true;
  }, [persist, supabaseReady, session?.user?.id]);

  const updateNameTag = useCallback(async (newTag: string) => {
    if (!nameTag || nameTag.changesLeft <= 0) {
      console.log('[SocialProvider] No changes left for name tag');
      return false;
    }
    const cleaned = newTag.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
    if (!cleaned) return false;

    if (supabaseReady && session?.user) {
      try {
        const updated = await updateUserProfile(session.user.id, { name_tag: cleaned.toLowerCase() });
        if (updated) {
          setSupaProfile(updated);
        }
      } catch (err) {
        console.error('[SocialProvider] Update name_tag error:', err);
        return false;
      }
    }

    const updated: NameTag = {
      ...nameTag,
      tag: cleaned,
      changesLeft: nameTag.changesLeft - 1,
    };
    setNameTag(updated);
    persist('nametag', updated);
    console.log('[SocialProvider] Name tag updated:', cleaned);
    return true;
  }, [nameTag, persist, supabaseReady, session?.user?.id]);

  const searchFriends = useCallback(async (searchTag: string): Promise<SearchResultUser[]> => {
    console.log('[SocialProvider] Searching for:', searchTag);

    if (supabaseReady) {
      const results = await searchUsers(searchTag);
      return results
        .filter((r) => r.id !== session?.user?.id)
        .map((r) => ({
          id: r.id,
          userId: r.id,
          nameTag: r.name_tag,
          displayName: r.display_name,
          photoUrl: r.avatar_url ?? undefined,
        }));
    }

    if (searchTag.length >= 3) {
      return [{
        id: generateId(),
        userId: 'user_' + generateId(),
        nameTag: searchTag,
        displayName: searchTag + ' (local)',
      }];
    }
    return [];
  }, [supabaseReady, session?.user?.id]);

  const sendRequest = useCallback(async (toUser: SearchResultUser) => {
    if (!session?.user || !nameTag) return false;

    if (supabaseReady) {
      const success = await supaSendRequest(
        session.user.id,
        toUser.userId
      );
      if (success) {
        const [outgoing, supaFriends] = await Promise.all([
          supaGetOutgoing(session.user.id),
          getFriendsList(session.user.id),
        ]);
        setOutgoingRequests(outgoing);
        persist('outgoing_requests', outgoing);
        if (supaFriends.length > 0) {
          setFriends(supaFriends);
          persist('friends', supaFriends);
        }
        console.log('[SocialProvider] Friend request sent to:', toUser.nameTag);
        return true;
      }
      return false;
    }

    const newReq: FriendRequest = {
      id: generateId(),
      fromUserId: session.user.id,
      fromNameTag: nameTag.tag,
      fromDisplayName: account?.displayName ?? nameTag.tag,
      toUserId: toUser.userId,
      toNameTag: toUser.nameTag,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setOutgoingRequests((prev) => {
      const next = [...prev, newReq];
      persist('outgoing_requests', next);
      return next;
    });
    return true;
  }, [session?.user?.id, nameTag, account?.displayName, supabaseReady, persist]);

  const acceptRequest = useCallback(async (request: FriendRequest) => {
    if (supabaseReady && session?.user) {
      const success = await supaAcceptRequest(request.id, request.fromUserId, request.toUserId);
      if (success) {
        const [incoming, supaFriends] = await Promise.all([
          supaGetIncoming(session.user.id),
          getFriendsList(session.user.id),
        ]);
        setIncomingRequests(incoming);
        setFriends(supaFriends);
        persist('incoming_requests', incoming);
        persist('friends', supaFriends);
        console.log('[SocialProvider] Friend request accepted from:', request.fromNameTag);
        return true;
      }
      return false;
    }

    setIncomingRequests((prev) => {
      const next = prev.filter((r) => r.id !== request.id);
      persist('incoming_requests', next);
      return next;
    });
    const newFriend: Friend = {
      id: generateId(),
      userId: request.fromUserId,
      nameTag: request.fromNameTag,
      displayName: request.fromDisplayName,
      addedAt: new Date().toISOString(),
      isBlocked: false,
    };
    setFriends((prev) => {
      if (prev.some((f) => f.userId === newFriend.userId)) return prev;
      const next = [...prev, newFriend];
      persist('friends', next);
      return next;
    });
    return true;
  }, [supabaseReady, session?.user?.id, persist]);

  const declineRequest = useCallback(async (request: FriendRequest) => {
    if (supabaseReady) {
      await supaDeclineRequest(request.id);
    }
    setIncomingRequests((prev) => {
      const next = prev.filter((r) => r.id !== request.id);
      persist('incoming_requests', next);
      return next;
    });
    console.log('[SocialProvider] Friend request declined:', request.id);
  }, [supabaseReady, persist]);

  const cancelRequest = useCallback(async (request: FriendRequest) => {
    if (supabaseReady) {
      await supaCancelRequest(request.id);
    }
    setOutgoingRequests((prev) => {
      const next = prev.filter((r) => r.id !== request.id);
      persist('outgoing_requests', next);
      return next;
    });
    console.log('[SocialProvider] Friend request cancelled:', request.id);
  }, [supabaseReady, persist]);

  const removeFriend = useCallback(async (friendUserId: string) => {
    if (supabaseReady && session?.user) {
      await removeFriendship(session.user.id, friendUserId);
      const supaFriends = await getFriendsList(session.user.id);
      setFriends(supaFriends);
      persist('friends', supaFriends);
      console.log('[SocialProvider] Friend removed via Supabase:', friendUserId);
      return;
    }

    setFriends((prev) => {
      const next = prev.filter((f) => f.userId !== friendUserId);
      persist('friends', next);
      console.log('[SocialProvider] Friend removed locally:', friendUserId);
      return next;
    });
  }, [persist, supabaseReady, session?.user?.id]);

  const blockUser = useCallback(async (blockUserId: string) => {
    setFriends((prev) => {
      const idx = prev.findIndex((f) => f.userId === blockUserId);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], isBlocked: true };
      persist('friends', next);
      console.log('[SocialProvider] User blocked:', blockUserId);
      return next;
    });
  }, [persist]);

  const unblockUser = useCallback(async (unblockUserId: string) => {
    setFriends((prev) => {
      const idx = prev.findIndex((f) => f.userId === unblockUserId);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], isBlocked: false };
      persist('friends', next);
      console.log('[SocialProvider] User unblocked:', unblockUserId);
      return next;
    });
  }, [persist]);

  const updatePrivacy = useCallback(async (setting: PrivacySetting) => {
    setPrivacySetting(setting);
    persist('privacy', setting);
    console.log('[SocialProvider] Privacy updated:', setting);
  }, [persist]);

  const updateSharing = useCallback(async (updates: Partial<SharingToggles>) => {
    setSharingToggles((prev) => {
      const next = { ...prev, ...updates };
      persist('sharing', next);
      return next;
    });
  }, [persist]);

  const generateInviteLink = useCallback(async (): Promise<InviteLink> => {
    if (supabaseReady && session?.user && nameTag) {
      const link = await supaCreateInviteLink(session.user.id, nameTag.tag);
      if (link) {
        setInviteLinks((prev) => {
          const next = [...prev, link];
          persist('invites', next);
          return next;
        });
        console.log('[SocialProvider] Invite link generated via Supabase:', link.code);
        return link;
      }
    }

    const link: InviteLink = {
      id: generateId(),
      code: generateId() + generateId(),
      createdBy: nameTag?.tag ?? 'unknown',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    setInviteLinks((prev) => {
      const next = [...prev, link];
      persist('invites', next);
      return next;
    });
    console.log('[SocialProvider] Invite link generated locally:', link.code);
    return link;
  }, [nameTag, persist, supabaseReady, session?.user?.id]);

  const syncStats = useCallback(async (stats: SharedStats) => {
    if (!supabaseReady || !session?.user) return;

    try {
      await upsertUserStats(session.user.id, stats);
      console.log('[SocialProvider] Stats synced to Supabase');
    } catch (err) {
      console.error('[SocialProvider] Stats sync error:', err);
    }
  }, [supabaseReady, session?.user?.id]);

  const getRemoteFriendStats = useCallback(async (friendUserId: string): Promise<SharedStats | null> => {
    if (supabaseReady) {
      const stats = await supaGetFriendStats(friendUserId);
      if (stats) {
        console.log('[SocialProvider] Got remote stats for:', friendUserId);
        return stats;
      }
    }

    return null;
  }, [supabaseReady]);

  const refreshFriends = useCallback(async () => {
    if (!supabaseReady || !session?.user) return;

    try {
      const [supaFriends, incoming, outgoing] = await Promise.all([
        getFriendsList(session.user.id),
        supaGetIncoming(session.user.id),
        supaGetOutgoing(session.user.id),
      ]);
      setFriends(supaFriends);
      setIncomingRequests(incoming);
      setOutgoingRequests(outgoing);
      persist('friends', supaFriends);
      persist('incoming_requests', incoming);
      persist('outgoing_requests', outgoing);
      console.log(`[SocialProvider] Refreshed ${supaFriends.length} friends, ${incoming.length} incoming, ${outgoing.length} outgoing`);
    } catch (err) {
      console.error('[SocialProvider] Refresh friends error:', err);
    }
  }, [supabaseReady, session?.user?.id, persist]);

  const isRequestPending = useCallback((pendingUserId: string): boolean => {
    return outgoingRequests.some((r) => r.toUserId === pendingUserId && r.status === 'pending');
  }, [outgoingRequests]);

  const hasIncomingFrom = useCallback((fromUserId: string): FriendRequest | undefined => {
    return incomingRequests.find((r) => r.fromUserId === fromUserId && r.status === 'pending');
  }, [incomingRequests]);

  const activeFriends = useMemo(() => friends.filter((f) => !f.isBlocked), [friends]);
  const blockedFriends = useMemo(() => friends.filter((f) => f.isBlocked), [friends]);

  return useMemo(() => ({
    nameTag,
    createNameTag,
    updateNameTag,
    friends: activeFriends,
    blockedFriends,
    allFriends: friends,
    removeFriend,
    blockUser,
    unblockUser,
    searchFriends,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    incomingRequests,
    outgoingRequests,
    isRequestPending,
    hasIncomingFrom,
    friendRequests: incomingRequests,
    privacySetting,
    updatePrivacy,
    sharingToggles,
    updateSharing,
    inviteLinks,
    generateInviteLink,
    getFriendStats: getRemoteFriendStats,
    syncStats,
    refreshFriends,
    supabaseReady,
    supaProfile,
    isSignedIn,
    isLoading: authReady ? localDataQuery.isLoading : true,
  }), [
    acceptRequest,
    activeFriends,
    blockedFriends,
    blockUser,
    cancelRequest,
    createNameTag,
    declineRequest,
    generateInviteLink,
    getRemoteFriendStats,
    hasIncomingFrom,
    incomingRequests,
    inviteLinks,
    isRequestPending,
    isSignedIn,
    localDataQuery.isLoading,
    nameTag,
    outgoingRequests,
    privacySetting,
    refreshFriends,
    removeFriend,
    searchFriends,
    sendRequest,
    sharingToggles,
    supaProfile,
    supabaseReady,
    syncStats,
    unblockUser,
    updateNameTag,
    updatePrivacy,
    updateSharing,
    authReady,
    friends,
  ]);
});
