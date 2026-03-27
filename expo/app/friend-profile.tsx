import React, { useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  Trophy,
  Flame,
  Timer,
  TrendingUp,
  Waves,
  Bike,
  Footprints,
  RefreshCw,
  AlertCircle,
  UserX,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useSocial } from '@/providers/SocialProvider';
import GlassCard from '@/components/GlassCard';
import { formatTime } from '@/utils/dateUtils';

function SkeletonPulse({ width, height, style }: { width: number | string; height: number; style?: object }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius: 8,
          backgroundColor: 'rgba(255,255,255,0.08)',
          opacity,
        },
        style,
      ]}
    />
  );
}

export default function FriendProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId, name, tag } = useLocalSearchParams<{ userId: string; name: string; tag: string }>();
  const { getFriendStats, friends } = useSocial();

  const isFriend = friends.some((f) => f.userId === userId);
  const displayName = name ? decodeURIComponent(name) : 'Friend';

  const statsQuery = useQuery({
    queryKey: ['friend-stats', userId],
    queryFn: async () => {
      if (!userId) throw new Error('No user ID');
      console.log('[FriendProfile] Fetching stats for', userId);
      const data = await getFriendStats(userId);
      console.log('[FriendProfile] Stats loaded:', data ? 'has data' : 'no data');
      return data;
    },
    enabled: !!userId && isFriend,
    staleTime: 60000,
    retry: 2,
  });

  const handleRetry = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    queryClient.invalidateQueries({ queryKey: ['friend-stats', userId] });
  }, [queryClient, userId]);

  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      <View style={styles.statsRow}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.statCard}>
            <SkeletonPulse width={24} height={24} />
            <SkeletonPulse width={40} height={28} style={{ marginTop: 8 }} />
            <SkeletonPulse width={60} height={14} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>
      <View style={{ paddingHorizontal: 20, gap: 10 }}>
        <SkeletonPulse width={120} height={14} />
        <SkeletonPulse width="100%" height={64} style={{ borderRadius: 14 } as object} />
        <SkeletonPulse width="100%" height={64} style={{ borderRadius: 14 } as object} />
        <SkeletonPulse width="100%" height={64} style={{ borderRadius: 14 } as object} />
      </View>
    </View>
  );

  const renderNotFriend = () => (
    <GlassCard>
      <View style={styles.notFriendContainer}>
        <UserX size={32} color={Colors.textTertiary} />
        <Text style={styles.notFriendTitle}>Not friends yet</Text>
        <Text style={styles.notFriendDesc}>
          You need to be friends with {displayName} to view their stats. Send a friend request first.
        </Text>
      </View>
    </GlassCard>
  );

  const renderError = () => (
    <GlassCard accentColor={Colors.danger}>
      <View style={styles.errorContainer}>
        <AlertCircle size={28} color={Colors.danger} />
        <Text style={styles.errorText}>
          {statsQuery.error instanceof Error ? statsQuery.error.message : 'Could not load stats. Please try again.'}
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={handleRetry}
          activeOpacity={0.7}
        >
          <RefreshCw size={16} color={Colors.accent} />
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    </GlassCard>
  );

  const renderNoStats = () => (
    <GlassCard>
      <View style={styles.noStatsContainer}>
        <Trophy size={28} color={Colors.textTertiary} />
        <Text style={styles.noStatsText}>
          No stats available yet. This user hasn't synced any training data.
        </Text>
      </View>
    </GlassCard>
  );

  const stats = statsQuery.data;

  const renderStats = () => {
    if (!stats) return renderNoStats();

    return (
      <>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Trophy size={20} color={Colors.warning} />
            <Text style={styles.statValue}>{stats.totalWorkouts}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statCard}>
            <Flame size={20} color={Colors.run} />
            <Text style={styles.statValue}>{stats.currentStreak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Timer size={20} color={Colors.accent} />
            <Text style={styles.statValue}>
              {Math.round(stats.totalTrainingTime / 3600)}h
            </Text>
            <Text style={styles.statLabel}>Total Time</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>BEST PERFORMANCES</Text>

        <GlassCard accentColor={Colors.run}>
          <View style={styles.perfRow}>
            <View style={[styles.perfIcon, { borderColor: Colors.run + '30' }]}>
              <Footprints size={20} color={Colors.run} />
            </View>
            <View style={styles.perfInfo}>
              <Text style={styles.perfLabel}>Best Run Distance</Text>
              <Text style={[styles.perfValue, { color: Colors.run }]}>
                {stats.bestRunDistance > 0 ? `${stats.bestRunDistance.toFixed(1)} mi` : '\u2014'}
              </Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard accentColor={Colors.bike}>
          <View style={styles.perfRow}>
            <View style={[styles.perfIcon, { borderColor: Colors.bike + '30' }]}>
              <Bike size={20} color={Colors.bike} />
            </View>
            <View style={styles.perfInfo}>
              <Text style={styles.perfLabel}>Longest Ride</Text>
              <Text style={[styles.perfValue, { color: Colors.bike }]}>
                {stats.longestRide > 0 ? `${stats.longestRide.toFixed(1)} mi` : '\u2014'}
              </Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard accentColor={Colors.swim}>
          <View style={styles.perfRow}>
            <View style={[styles.perfIcon, { borderColor: Colors.swim + '30' }]}>
              <Waves size={20} color={Colors.swim} />
            </View>
            <View style={styles.perfInfo}>
              <Text style={styles.perfLabel}>Total Swim</Text>
              <Text style={[styles.perfValue, { color: Colors.swim }]}>
                {stats.swimTotal > 0 ? `${(stats.swimTotal / 1000).toFixed(1)} km` : '\u2014'}
              </Text>
            </View>
          </View>
        </GlassCard>

        <Text style={styles.sectionTitle}>TRAINING TIME</Text>
        <GlassCard>
          <View style={styles.timeRow}>
            <TrendingUp size={20} color={Colors.success} />
            <View style={styles.timeInfo}>
              <Text style={styles.timeValue}>
                {formatTime(stats.totalTrainingTime)}
              </Text>
              <Text style={styles.timeLabel}>Total training time logged</Text>
            </View>
          </View>
        </GlassCard>
      </>
    );
  };

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
          testID="friend-profile-back"
        >
          <ChevronLeft size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRetry}
          activeOpacity={0.7}
        >
          <RefreshCw size={18} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <LinearGradient
            colors={[Colors.social, '#7B68EE']}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileTag}>@{tag}</Text>
          {isFriend && (
            <View style={styles.friendBadge}>
              <Text style={styles.friendBadgeText}>Friends</Text>
            </View>
          )}
        </View>

        {!isFriend ? (
          renderNotFriend()
        ) : statsQuery.isLoading ? (
          renderSkeleton()
        ) : statsQuery.isError ? (
          renderError()
        ) : (
          renderStats()
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
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  profileHeader: {
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 28,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
  },
  profileTag: {
    fontSize: 14,
    color: Colors.social,
    marginTop: 4,
    fontWeight: '600' as const,
  },
  friendBadge: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: Colors.success + '15',
    borderWidth: 1,
    borderColor: Colors.success + '30',
  },
  friendBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  skeletonContainer: {
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row' as const,
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
    alignItems: 'center' as const,
    gap: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    letterSpacing: 0.3,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  perfRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
  },
  perfIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  perfInfo: {
    flex: 1,
  },
  perfLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  perfValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
  },
  timeInfo: {
    flex: 1,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  timeLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  noStatsContainer: {
    paddingVertical: 28,
    alignItems: 'center' as const,
    gap: 10,
  },
  noStatsText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center' as const,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  notFriendContainer: {
    alignItems: 'center' as const,
    paddingVertical: 28,
    gap: 10,
  },
  notFriendTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  notFriendDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  errorContainer: {
    alignItems: 'center' as const,
    paddingVertical: 24,
    gap: 10,
  },
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  retryBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.accent + '15',
    marginTop: 4,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
});
