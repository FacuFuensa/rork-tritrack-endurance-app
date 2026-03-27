import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  Search,
  UserPlus,
  Users,
  Link2,
  ShieldAlert,
  ShieldOff,
  Trash2,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  AtSign,
  Copy,
  Send,
  Info,
  Bell,
  Clock,
  Check,
  X,
  UserCheck,
  Inbox,
  SendHorizontal,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Friend, FriendRequest, PrivacySetting } from '@/constants/types';
import { useSocial, SearchResultUser } from '@/providers/SocialProvider';
import { useAuth } from '@/providers/AuthProvider';
import GlassCard from '@/components/GlassCard';

type TabType = 'friends' | 'requests';

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    nameTag,
    friends,
    blockedFriends,
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
    privacySetting,
    updatePrivacy,
    generateInviteLink,
    supabaseReady,
    isSignedIn,
    refreshFriends,
  } = useSocial();
  const { isSignedIn: authSignedIn } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultUser[]>([]);
  const [searchError, setSearchError] = useState('');
  const [showBlocked, setShowBlocked] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const tabIndicator = useRef(new Animated.Value(0)).current;

  const switchTab = useCallback((tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    Animated.spring(tabIndicator, {
      toValue: tab === 'friends' ? 0 : 1,
      useNativeDriver: true,
      tension: 300,
      friction: 30,
    }).start();
  }, [tabIndicator]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError('');
    setSearchResults([]);
    try {
      const results = await searchFriends(searchQuery.trim());
      if (results.length > 0) {
        setSearchResults(results);
      } else {
        setSearchError('No users found matching that name tag');
      }
    } catch {
      setSearchError('Search failed. Try again.');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, searchFriends]);

  const handleSendRequest = useCallback(async (user: SearchResultUser) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await sendRequest(user);
    if (success) {
      Alert.alert('Request Sent', `Friend request sent to ${user.displayName}.`);
    } else {
      Alert.alert('Error', 'Could not send friend request. Try again.');
    }
  }, [sendRequest]);

  const handleAcceptRequest = useCallback(async (request: FriendRequest) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await acceptRequest(request);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [acceptRequest]);

  const handleDeclineRequest = useCallback(async (request: FriendRequest) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await declineRequest(request);
  }, [declineRequest]);

  const handleCancelRequest = useCallback(async (request: FriendRequest) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await cancelRequest(request);
  }, [cancelRequest]);

  const handleRemoveFriend = useCallback((friend: Friend) => {
    Alert.alert(
      'Remove Friend',
      `Remove ${friend.displayName} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            removeFriend(friend.userId);
          },
        },
      ]
    );
  }, [removeFriend]);

  const handleBlock = useCallback((friend: Friend) => {
    Alert.alert(
      'Block User',
      `Block ${friend.displayName}? They won't be able to see your stats.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            blockUser(friend.userId);
          },
        },
      ]
    );
  }, [blockUser]);

  const handleUnblock = useCallback((friend: Friend) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    unblockUser(friend.userId);
  }, [unblockUser]);

  const handleShareInvite = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const link = await generateInviteLink();
    const url = `https://tritrack.app/invite/${link.code}`;
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard?.writeText(url);
        Alert.alert('Link Copied', 'Invite link copied to clipboard!');
      } else {
        await Share.share({
          message: `Join me on TriTrack! ${url}`,
          url: url,
        });
      }
    } catch {
      Alert.alert('Invite Link', url);
    }
  }, [generateInviteLink]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refreshFriends();
    setIsRefreshing(false);
  }, [refreshFriends]);

  const handleCopyTag = useCallback(() => {
    if (!nameTag) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === 'web') {
      navigator.clipboard?.writeText(nameTag.tag);
    }
    Alert.alert('Copied', `@${nameTag.tag} copied to clipboard`);
  }, [nameTag]);

  const privacyOptions: { value: PrivacySetting; label: string; desc: string; icon: React.ReactNode }[] = [
    { value: 'everything', label: 'Share Everything', desc: 'All stats visible to friends', icon: <Eye size={16} color={Colors.success} /> },
    { value: 'best_stats', label: 'Best Stats Only', desc: 'Only top achievements visible', icon: <EyeOff size={16} color={Colors.warning} /> },
    { value: 'nothing', label: 'Private', desc: 'No stats shared with friends', icon: <Lock size={16} color={Colors.danger} /> },
  ];

  const isFriendAlready = useCallback((userId: string) => {
    return friends.some((f) => f.userId === userId);
  }, [friends]);

  const getResultStatus = useCallback((user: SearchResultUser): 'friend' | 'pending' | 'incoming' | 'none' => {
    if (isFriendAlready(user.userId)) return 'friend';
    if (isRequestPending(user.userId)) return 'pending';
    if (hasIncomingFrom(user.userId)) return 'incoming';
    return 'none';
  }, [isFriendAlready, isRequestPending, hasIncomingFrom]);

  const totalRequestCount = incomingRequests.length + outgoingRequests.length;

  const tabTranslateX = tabIndicator.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <LinearGradient
      colors={[Colors.gradientStart, Colors.gradientMid, Colors.gradientEnd]}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Network</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
          disabled={isRefreshing}
          activeOpacity={0.7}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <Send size={18} color={Colors.accent} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
          onPress={() => switchTab('friends')}
          activeOpacity={0.7}
        >
          <Users size={16} color={activeTab === 'friends' ? Colors.accent : Colors.textTertiary} />
          <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
            Friends
          </Text>
          {friends.length > 0 && (
            <View style={[styles.tabBadge, activeTab === 'friends' && styles.tabBadgeActive]}>
              <Text style={styles.tabBadgeText}>{friends.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
          onPress={() => switchTab('requests')}
          activeOpacity={0.7}
        >
          <Bell size={16} color={activeTab === 'requests' ? Colors.accent : Colors.textTertiary} />
          <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
            Requests
          </Text>
          {incomingRequests.length > 0 && (
            <View style={[styles.tabBadge, styles.tabBadgeAlert]}>
              <Text style={styles.tabBadgeText}>{incomingRequests.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!authSignedIn ? (
          <GlassCard accentColor={Colors.warning}>
            <View style={styles.signInPrompt}>
              <Info size={18} color={Colors.warning} />
              <View style={styles.signInPromptText}>
                <Text style={styles.signInPromptTitle}>Sign in required</Text>
                <Text style={styles.signInPromptDesc}>
                  Sign in to search and add friends, share stats, and sync across devices.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.signInPromptBtn}
                onPress={() => router.push('/account' as never)}
                activeOpacity={0.7}
              >
                <Text style={styles.signInPromptBtnText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        ) : supabaseReady ? (
          <View style={styles.connectedBanner}>
            <View style={[styles.connectedDot, { backgroundColor: Colors.success }]} />
            <Text style={styles.connectedBannerText}>Connected</Text>
          </View>
        ) : null}

        {activeTab === 'friends' && (
          <>
            <Text style={styles.sectionTitle}>FIND FRIENDS</Text>
            <GlassCard accentColor={Colors.social}>
              <View style={styles.searchRow}>
                <View style={styles.searchInput}>
                  <AtSign size={16} color={Colors.textTertiary} />
                  <TextInput
                    style={styles.searchTextInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search by name tag..."
                    placeholderTextColor={Colors.textTertiary}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <TouchableOpacity
                  style={styles.searchBtn}
                  onPress={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  activeOpacity={0.7}
                >
                  {isSearching ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Search size={18} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>

              {nameTag && (
                <TouchableOpacity
                  style={styles.myTagRow}
                  onPress={handleCopyTag}
                  activeOpacity={0.7}
                >
                  <View style={styles.myTagIcon}>
                    <AtSign size={14} color={Colors.accent} />
                  </View>
                  <View style={styles.myTagInfo}>
                    <Text style={styles.myTagLabel}>Your Name Tag</Text>
                    <Text style={styles.myTagValue}>@{nameTag.tag}</Text>
                  </View>
                  <Copy size={14} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}

              {searchResults.length > 0 && (
                <View style={styles.searchResultsContainer}>
                  <Text style={styles.searchResultsTitle}>Results</Text>
                  {searchResults.map((user) => {
                    const status = getResultStatus(user);
                    return (
                      <View key={user.id} style={styles.searchResultCard}>
                        <View style={styles.searchResultAvatar}>
                          <Text style={styles.searchResultAvatarText}>
                            {user.displayName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.searchResultInfo}>
                          <Text style={styles.searchResultName}>{user.displayName}</Text>
                          <Text style={styles.searchResultTag}>@{user.nameTag}</Text>
                        </View>
                        {status === 'friend' ? (
                          <View style={styles.statusBadge}>
                            <UserCheck size={14} color={Colors.success} />
                            <Text style={[styles.statusBadgeText, { color: Colors.success }]}>Friends</Text>
                          </View>
                        ) : status === 'pending' ? (
                          <View style={[styles.statusBadge, { backgroundColor: Colors.warning + '15' }]}>
                            <Clock size={14} color={Colors.warning} />
                            <Text style={[styles.statusBadgeText, { color: Colors.warning }]}>Pending</Text>
                          </View>
                        ) : status === 'incoming' ? (
                          <TouchableOpacity
                            style={[styles.addFriendBtn, { backgroundColor: Colors.success }]}
                            onPress={() => {
                              const req = hasIncomingFrom(user.userId);
                              if (req) handleAcceptRequest(req);
                            }}
                            activeOpacity={0.7}
                          >
                            <Check size={16} color="#FFFFFF" />
                            <Text style={styles.addFriendBtnText}>Accept</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.addFriendBtn}
                            onPress={() => handleSendRequest(user)}
                            activeOpacity={0.7}
                          >
                            <UserPlus size={16} color="#FFFFFF" />
                            <Text style={styles.addFriendBtnText}>Request</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {searchError ? (
                <Text style={styles.searchErrorText}>{searchError}</Text>
              ) : null}
            </GlassCard>

            <TouchableOpacity
              style={styles.inviteLinkRow}
              onPress={handleShareInvite}
              activeOpacity={0.7}
            >
              <View style={styles.inviteLinkIcon}>
                <Link2 size={18} color={Colors.accent} />
              </View>
              <View style={styles.inviteLinkText}>
                <Text style={styles.inviteLinkTitle}>Invite by Link</Text>
                <Text style={styles.inviteLinkSubtitle}>Share a link to add friends</Text>
              </View>
              <Copy size={16} color={Colors.textTertiary} />
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>
              MY FRIENDS ({friends.length})
            </Text>

            {friends.length === 0 ? (
              <GlassCard>
                <View style={styles.emptyState}>
                  <Users size={32} color={Colors.textTertiary} />
                  <Text style={styles.emptyTitle}>No friends yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Search by name tag or share your invite link to connect with training partners.
                  </Text>
                </View>
              </GlassCard>
            ) : (
              friends.map((friend) => (
                <TouchableOpacity
                  key={`friend_${friend.userId}`}
                  style={styles.friendRow}
                  onPress={() => router.push(`/friend-profile?userId=${friend.userId}&name=${encodeURIComponent(friend.displayName)}&tag=${friend.nameTag}` as never)}
                  activeOpacity={0.7}
                >
                  <View style={styles.friendAvatar}>
                    <Text style={styles.friendAvatarText}>
                      {friend.displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{friend.displayName}</Text>
                    <Text style={styles.friendTag}>@{friend.nameTag}</Text>
                  </View>
                  <View style={styles.friendActions}>
                    <TouchableOpacity
                      style={styles.friendActionBtn}
                      onPress={() => handleBlock(friend)}
                      activeOpacity={0.7}
                    >
                      <ShieldAlert size={14} color={Colors.textTertiary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.friendActionBtn}
                      onPress={() => handleRemoveFriend(friend)}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={14} color={Colors.danger} />
                    </TouchableOpacity>
                    <ChevronRight size={16} color={Colors.textTertiary} />
                  </View>
                </TouchableOpacity>
              ))
            )}

            <Text style={styles.sectionTitle}>PRIVACY</Text>
            <GlassCard>
              {privacyOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.privacyRow,
                    privacySetting === option.value && styles.privacyRowActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    updatePrivacy(option.value);
                  }}
                  activeOpacity={0.7}
                >
                  {option.icon}
                  <View style={styles.privacyText}>
                    <Text style={[
                      styles.privacyLabel,
                      privacySetting === option.value && styles.privacyLabelActive,
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={styles.privacyDesc}>{option.desc}</Text>
                  </View>
                  {privacySetting === option.value ? (
                    <View style={styles.privacyCheck}>
                      <View style={styles.privacyCheckDot} />
                    </View>
                  ) : (
                    <View style={styles.privacyUncheck} />
                  )}
                </TouchableOpacity>
              ))}
            </GlassCard>

            {blockedFriends.length > 0 ? (
              <>
                <TouchableOpacity
                  style={styles.blockedHeader}
                  onPress={() => setShowBlocked(!showBlocked)}
                  activeOpacity={0.7}
                >
                  <ShieldOff size={14} color={Colors.textTertiary} />
                  <Text style={styles.blockedHeaderText}>
                    Blocked Users ({blockedFriends.length})
                  </Text>
                  <ChevronRight
                    size={14}
                    color={Colors.textTertiary}
                    style={{ transform: [{ rotate: showBlocked ? '90deg' : '0deg' }] }}
                  />
                </TouchableOpacity>

                {showBlocked ? (
                  blockedFriends.map((friend) => (
                    <View key={`blocked_${friend.userId}`} style={styles.blockedRow}>
                      <Text style={styles.blockedName}>{friend.displayName}</Text>
                      <TouchableOpacity
                        style={styles.unblockBtn}
                        onPress={() => handleUnblock(friend)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.unblockBtnText}>Unblock</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                ) : null}
              </>
            ) : null}
          </>
        )}

        {activeTab === 'requests' && (
          <>
            {incomingRequests.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>
                  <Inbox size={12} color={Colors.textTertiary} /> INCOMING ({incomingRequests.length})
                </Text>
                {incomingRequests.map((req) => (
                  <View key={req.id} style={styles.requestCard}>
                    <View style={styles.requestAvatar}>
                      <Text style={styles.requestAvatarText}>
                        {req.fromDisplayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestName}>{req.fromDisplayName}</Text>
                      <Text style={styles.requestTag}>@{req.fromNameTag}</Text>
                    </View>
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => handleAcceptRequest(req)}
                        activeOpacity={0.7}
                      >
                        <Check size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.declineBtn}
                        onPress={() => handleDeclineRequest(req)}
                        activeOpacity={0.7}
                      >
                        <X size={18} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            {outgoingRequests.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>
                  SENT ({outgoingRequests.length})
                </Text>
                {outgoingRequests.map((req) => (
                  <View key={req.id} style={styles.requestCard}>
                    <View style={[styles.requestAvatar, { backgroundColor: Colors.warning + '20' }]}>
                      <Text style={[styles.requestAvatarText, { color: Colors.warning }]}>
                        {req.toNameTag.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestName}>@{req.toNameTag}</Text>
                      <View style={styles.pendingBadge}>
                        <Clock size={10} color={Colors.warning} />
                        <Text style={styles.pendingBadgeText}>Pending</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => handleCancelRequest(req)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
              <GlassCard>
                <View style={styles.emptyState}>
                  <Bell size={32} color={Colors.textTertiary} />
                  <Text style={styles.emptyTitle}>No requests</Text>
                  <Text style={styles.emptySubtitle}>
                    When you send or receive friend requests, they'll appear here.
                  </Text>
                </View>
              </GlassCard>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accent + '15',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  tabBar: {
    flexDirection: 'row' as const,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  tab: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  tabActive: {
    backgroundColor: 'rgba(94, 159, 255, 0.12)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
  },
  tabTextActive: {
    color: Colors.accent,
  },
  tabBadge: {
    backgroundColor: Colors.textTertiary,
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 5,
  },
  tabBadgeActive: {
    backgroundColor: Colors.accent + '30',
  },
  tabBadgeAlert: {
    backgroundColor: Colors.danger,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  connectedBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 6,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectedBannerText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 10,
  },
  searchRow: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 14,
    height: 46,
  },
  searchTextInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  searchBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.social,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  myTagRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    gap: 10,
  },
  myTagIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.accent + '15',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  myTagInfo: {
    flex: 1,
  },
  myTagLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  myTagValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.accent,
    marginTop: 1,
  },
  searchResultsContainer: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  searchResultsTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  searchResultCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  searchResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: Colors.socialDark,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  searchResultAvatarText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Colors.social,
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  searchResultTag: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: Colors.success + '15',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  addFriendBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: Colors.social,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addFriendBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  searchErrorText: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 12,
    textAlign: 'center' as const,
  },
  inviteLinkRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.accent + '08',
    borderWidth: 1,
    borderColor: Colors.accent + '20',
    gap: 12,
  },
  inviteLinkIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.accent + '15',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  inviteLinkText: {
    flex: 1,
  },
  inviteLinkTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  inviteLinkSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  friendRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 8,
  },
  friendAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.socialDark,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  friendAvatarText: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.social,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  friendName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  friendTag: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  friendActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  friendActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  privacyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  privacyRowActive: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  privacyText: {
    flex: 1,
  },
  privacyLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  privacyLabelActive: {
    color: Colors.textPrimary,
  },
  privacyDesc: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  privacyCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  privacyCheckDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  privacyUncheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.textTertiary,
  },
  blockedHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  blockedHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
  },
  blockedRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginHorizontal: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 10,
    marginBottom: 6,
  },
  blockedName: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  unblockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.accent + '15',
  },
  unblockBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  signInPrompt: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  signInPromptText: {
    flex: 1,
  },
  signInPromptTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.warning,
  },
  signInPromptDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  signInPromptBtn: {
    backgroundColor: Colors.warning + '20',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  signInPromptBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.warning,
  },
  requestCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 8,
  },
  requestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.social + '20',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  requestAvatarText: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.social,
  },
  requestInfo: {
    flex: 1,
    marginLeft: 12,
  },
  requestName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  requestTag: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  acceptBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.success,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  declineBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.danger + '15',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  pendingBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: 3,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.warning,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.danger + '15',
    borderWidth: 1,
    borderColor: Colors.danger + '30',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.danger,
  },
});
