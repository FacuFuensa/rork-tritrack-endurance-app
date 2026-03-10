import { supabase, isSupabaseConfigured } from './supabase';
import { Friend, FriendRequest, SharedStats, InviteLink } from '@/constants/types';

function isTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as Record<string, unknown>;
  const code = e.code as string | undefined;
  const msg = e.message as string | undefined;
  return code === '42P01' || (msg?.includes('relation') && msg?.includes('does not exist')) || false;
}

export interface UserProfileRow {
  id: string;
  display_name: string;
  name_tag: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export async function ensureUserProfile(
  userId: string,
  displayName: string,
  suggestedNameTag?: string
): Promise<UserProfileRow | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (fetchError) {
      if (isTableError(fetchError)) {
        console.warn('[SupabaseSocial] profiles table does not exist. Run the SQL schema.');
        return null;
      }
      console.error('[SupabaseSocial] Fetch profile error:', fetchError.message);
      return null;
    }

    if (existing) {
      console.log('[SupabaseSocial] Profile found for user:', userId);
      return existing;
    }

    const nameTag = suggestedNameTag
      ? suggestedNameTag.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 20)
      : (displayName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 15) +
        Math.random().toString(36).slice(2, 5));

    const { data, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        display_name: displayName,
        name_tag: nameTag,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        const retryTag = nameTag + Math.random().toString(36).slice(2, 4);
        const { data: retryData } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            display_name: displayName,
            name_tag: retryTag,
          })
          .select()
          .single();
        return retryData ?? null;
      }
      console.error('[SupabaseSocial] Insert profile error:', insertError.message);
      return null;
    }

    console.log('[SupabaseSocial] Profile created:', nameTag);
    return data;
  } catch (err) {
    console.error('[SupabaseSocial] ensureUserProfile error:', err);
    return null;
  }
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<UserProfileRow, 'display_name' | 'name_tag' | 'avatar_url'>>
): Promise<UserProfileRow | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('[SupabaseSocial] Update profile error:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[SupabaseSocial] updateUserProfile error:', err);
    return null;
  }
}

export async function searchUsers(query: string): Promise<UserProfileRow[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const cleaned = query.replace(/^@/, '').toLowerCase().trim();
    if (cleaned.length < 2) return [];

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`name_tag.ilike.%${cleaned}%,display_name.ilike.%${cleaned}%`)
      .limit(10);

    if (error) {
      if (isTableError(error)) {
        console.warn('[SupabaseSocial] profiles table missing');
        return [];
      }
      console.error('[SupabaseSocial] Search error:', error.message);
      return [];
    }

    console.log(`[SupabaseSocial] Search "${cleaned}" returned ${data?.length ?? 0} results`);
    return data ?? [];
  } catch (err) {
    console.error('[SupabaseSocial] searchUsers error:', err);
    return [];
  }
}

async function lookupUserProfiles(userIds: string[]): Promise<Record<string, UserProfileRow>> {
  if (!userIds.length || !isSupabaseConfigured()) return {};

  const unique = [...new Set(userIds)];
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('id', unique);

    if (error || !data) return {};

    const map: Record<string, UserProfileRow> = {};
    for (const row of data) {
      map[row.id] = row;
    }
    return map;
  } catch {
    return {};
  }
}

export async function sendFriendRequest(
  fromUserId: string,
  toUserId: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    if (fromUserId === toUserId) {
      console.warn('[SupabaseSocial] Cannot send friend request to yourself');
      return false;
    }

    const { data: existingFriend } = await supabase
      .from('friends')
      .select('id')
      .eq('user_a', fromUserId < toUserId ? fromUserId : toUserId)
      .eq('user_b', fromUserId < toUserId ? toUserId : fromUserId)
      .maybeSingle();

    if (existingFriend) {
      console.log('[SupabaseSocial] Already friends');
      return true;
    }

    const { data: existing } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('from_user_id', fromUserId)
      .eq('to_user_id', toUserId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      console.log('[SupabaseSocial] Friend request already pending');
      return true;
    }

    const { data: reverse } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('from_user_id', toUserId)
      .eq('to_user_id', fromUserId)
      .eq('status', 'pending')
      .maybeSingle();

    if (reverse) {
      console.log('[SupabaseSocial] Reverse request exists, auto-accepting');
      return acceptFriendRequest(reverse.id, toUserId, fromUserId);
    }

    const { error } = await supabase.from('friend_requests').insert({
      from_user_id: fromUserId,
      to_user_id: toUserId,
      status: 'pending',
    });

    if (error) {
      if (isTableError(error)) {
        console.warn('[SupabaseSocial] friend_requests table missing');
        return false;
      }
      console.error('[SupabaseSocial] Send friend request error:', error.message);
      return false;
    }

    console.log('[SupabaseSocial] Friend request sent from', fromUserId, 'to', toUserId);
    return true;
  } catch (err) {
    console.error('[SupabaseSocial] sendFriendRequest error:', err);
    return false;
  }
}

export async function getIncomingRequests(userId: string): Promise<FriendRequest[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('to_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      if (isTableError(error)) return [];
      console.error('[SupabaseSocial] Get incoming requests error:', error.message);
      return [];
    }

    const fromUserIds = (data ?? []).map((r: Record<string, unknown>) => r.from_user_id as string);
    const profiles = await lookupUserProfiles(fromUserIds);

    return (data ?? []).map((r: Record<string, unknown>) => {
      const fromId = r.from_user_id as string;
      const profile = profiles[fromId];
      return {
        id: r.id as string,
        fromUserId: fromId,
        fromNameTag: profile?.name_tag ?? '',
        fromDisplayName: profile?.display_name ?? '',
        fromPhotoUrl: profile?.avatar_url ?? undefined,
        toUserId: r.to_user_id as string,
        toNameTag: '',
        status: r.status as 'pending' | 'accepted' | 'declined',
        createdAt: r.created_at as string,
      };
    });
  } catch (err) {
    console.error('[SupabaseSocial] getIncomingRequests error:', err);
    return [];
  }
}

export async function getOutgoingRequests(userId: string): Promise<FriendRequest[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('from_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      if (isTableError(error)) return [];
      console.error('[SupabaseSocial] Get outgoing requests error:', error.message);
      return [];
    }

    const toUserIds = (data ?? []).map((r: Record<string, unknown>) => r.to_user_id as string);
    const profiles = await lookupUserProfiles(toUserIds);

    return (data ?? []).map((r: Record<string, unknown>) => {
      const toId = r.to_user_id as string;
      const profile = profiles[toId];
      return {
        id: r.id as string,
        fromUserId: r.from_user_id as string,
        fromNameTag: '',
        fromDisplayName: '',
        toUserId: toId,
        toNameTag: profile?.name_tag ?? '',
        status: r.status as 'pending' | 'accepted' | 'declined',
        createdAt: r.created_at as string,
      };
    });
  } catch (err) {
    console.error('[SupabaseSocial] getOutgoingRequests error:', err);
    return [];
  }
}

export async function acceptFriendRequest(requestId: string, fromUserId: string, toUserId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { error: updateError } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', requestId);

    if (updateError) {
      console.error('[SupabaseSocial] Accept request update error:', updateError.message);
      return false;
    }

    const userA = fromUserId < toUserId ? fromUserId : toUserId;
    const userB = fromUserId < toUserId ? toUserId : fromUserId;

    const { error: friendError } = await supabase
      .from('friends')
      .insert({ user_a: userA, user_b: userB });

    if (friendError) {
      if (friendError.code === '23505') {
        console.log('[SupabaseSocial] Friendship already exists (duplicate)');
        return true;
      }
      console.error('[SupabaseSocial] Create friendship error:', friendError.message);
      return false;
    }

    console.log('[SupabaseSocial] Friend request accepted, mutual friendship created:', userA, '<->', userB);
    return true;
  } catch (err) {
    console.error('[SupabaseSocial] acceptFriendRequest error:', err);
    return false;
  }
}

export async function declineFriendRequest(requestId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) {
      console.error('[SupabaseSocial] Decline request error:', error.message);
      return false;
    }
    console.log('[SupabaseSocial] Friend request declined:', requestId);
    return true;
  } catch (err) {
    console.error('[SupabaseSocial] declineFriendRequest error:', err);
    return false;
  }
}

export async function cancelFriendRequest(requestId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', requestId);

    if (error) {
      console.error('[SupabaseSocial] Cancel request error:', error.message);
      return false;
    }
    console.log('[SupabaseSocial] Friend request cancelled:', requestId);
    return true;
  } catch (err) {
    console.error('[SupabaseSocial] cancelFriendRequest error:', err);
    return false;
  }
}

export async function removeFriendship(
  currentUserId: string,
  friendUserId: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const userA = currentUserId < friendUserId ? currentUserId : friendUserId;
    const userB = currentUserId < friendUserId ? friendUserId : currentUserId;

    const { error } = await supabase
      .from('friends')
      .delete()
      .eq('user_a', userA)
      .eq('user_b', userB);

    if (error) {
      console.error('[SupabaseSocial] Remove friendship error:', error.message);
      return false;
    }

    console.log('[SupabaseSocial] Friendship removed between', userA, 'and', userB);
    return true;
  } catch (err) {
    console.error('[SupabaseSocial] removeFriendship error:', err);
    return false;
  }
}

export async function getFriendsList(userId: string): Promise<Friend[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data: friendsAsA, error: errorA } = await supabase
      .from('friends')
      .select('*')
      .eq('user_a', userId);

    const { data: friendsAsB, error: errorB } = await supabase
      .from('friends')
      .select('*')
      .eq('user_b', userId);

    if (errorA && !isTableError(errorA)) {
      console.error('[SupabaseSocial] Get friends (as A) error:', errorA.message);
    }
    if (errorB && !isTableError(errorB)) {
      console.error('[SupabaseSocial] Get friends (as B) error:', errorB.message);
    }

    if ((isTableError(errorA) || isTableError(errorB))) {
      console.warn('[SupabaseSocial] friends table missing');
      return [];
    }

    const allFriendships = [...(friendsAsA ?? []), ...(friendsAsB ?? [])];
    if (!allFriendships.length) return [];

    const friendIds = allFriendships.map((f: Record<string, unknown>) => {
      const a = f.user_a as string;
      const b = f.user_b as string;
      return a === userId ? b : a;
    });

    const uniqueFriendIds = [...new Set(friendIds)];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', uniqueFriendIds);

    const profileMap = new Map(
      (profiles ?? []).map((p: UserProfileRow) => [p.id, p])
    );

    return allFriendships.map((f: Record<string, unknown>) => {
      const a = f.user_a as string;
      const b = f.user_b as string;
      const friendId = a === userId ? b : a;
      const profile = profileMap.get(friendId);
      return {
        id: f.id as string,
        userId: friendId,
        nameTag: profile?.name_tag ?? '',
        displayName: profile?.display_name ?? 'Unknown',
        photoUrl: profile?.avatar_url ?? undefined,
        addedAt: f.created_at as string,
        isBlocked: false,
      };
    });
  } catch (err) {
    console.error('[SupabaseSocial] getFriendsList error:', err);
    return [];
  }
}

export async function upsertUserStats(
  userId: string,
  stats: SharedStats
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase.from('user_stats').upsert(
      {
        user_id: userId,
        total_workouts: stats.totalWorkouts,
        best_run_distance: stats.bestRunDistance,
        longest_ride: stats.longestRide,
        swim_total: stats.swimTotal,
        current_streak: stats.currentStreak,
        total_training_time: stats.totalTrainingTime,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      if (isTableError(error)) {
        console.warn('[SupabaseSocial] user_stats table missing');
        return false;
      }
      console.error('[SupabaseSocial] Upsert stats error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SupabaseSocial] upsertUserStats error:', err);
    return false;
  }
}

export async function getFriendStats(friendUserId: string): Promise<SharedStats | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', friendUserId)
      .maybeSingle();

    if (error) {
      if (isTableError(error)) return null;
      console.error('[SupabaseSocial] Get friend stats error:', error.message);
      return null;
    }

    if (!data) return null;

    return {
      totalWorkouts: data.total_workouts ?? 0,
      bestRunDistance: data.best_run_distance ?? 0,
      longestRide: data.longest_ride ?? 0,
      swimTotal: data.swim_total ?? 0,
      currentStreak: data.current_streak ?? 0,
      totalTrainingTime: data.total_training_time ?? 0,
    };
  } catch (err) {
    console.error('[SupabaseSocial] getFriendStats error:', err);
    return null;
  }
}

export async function createInviteLink(
  userId: string,
  nameTag: string
): Promise<InviteLink | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const code =
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8) +
      Math.random().toString(36).slice(2, 8);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('invite_links')
      .insert({
        code,
        created_by: userId,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      if (isTableError(error)) {
        console.warn('[SupabaseSocial] invite_links table missing');
        return null;
      }
      console.error('[SupabaseSocial] Create invite error:', error.message);
      return null;
    }

    return {
      id: data.id,
      code: data.code,
      createdBy: nameTag,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
    };
  } catch (err) {
    console.error('[SupabaseSocial] createInviteLink error:', err);
    return null;
  }
}

export async function useInviteLink(
  code: string,
  currentUserId: string
): Promise<{ success: boolean; creatorUserId?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Not configured' };

  try {
    const { data: invite, error } = await supabase
      .from('invite_links')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (error || !invite) {
      return { success: false, error: 'Invalid invite link' };
    }

    if (invite.used_by) {
      return { success: false, error: 'Invite link already used' };
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return { success: false, error: 'Invite link expired' };
    }

    if (invite.created_by === currentUserId) {
      return { success: false, error: 'Cannot use your own invite link' };
    }

    await supabase
      .from('invite_links')
      .update({ used_by: currentUserId })
      .eq('id', invite.id);

    const result = await sendFriendRequest(currentUserId, invite.created_by);
    if (!result) {
      return { success: false, error: 'Failed to send friend request' };
    }

    return { success: true, creatorUserId: invite.created_by };
  } catch (err) {
    console.error('[SupabaseSocial] useInviteLink error:', err);
    return { success: false, error: 'Unknown error' };
  }
}
