import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Flame, Trophy, Timer, TrendingUp, Camera, Pencil, Heart, Users, AtSign, ChevronRight, Zap } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useTraining } from '@/providers/TrainingProvider';
import { calculateAllTimeStats } from '@/utils/calculations';
import { formatTime, daysUntil } from '@/utils/dateUtils';
import GlassCard from '@/components/GlassCard';
import { useSocial } from '@/providers/SocialProvider';
import { useAuth } from '@/providers/AuthProvider';
import { formatSleepDuration, hasRealMetrics } from '@/utils/whoopMapper';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, updateProfile, dailyLogs, supplements, recoveryOptions, workoutConfigs } = useTraining();
  const { nameTag, createNameTag, updateNameTag, syncStats, supabaseReady } = useSocial();
  const { whoopData, isSignedIn, account, getLatestWhoopMetrics } = useAuth();
  const latestWhoopMetrics = useMemo(() => getLatestWhoopMetrics(), [getLatestWhoopMetrics]);
  const showWhoopData = useMemo(() => hasRealMetrics(latestWhoopMetrics), [latestWhoopMetrics]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [isEditingTag, setIsEditingTag] = useState(false);
  const [editTag, setEditTag] = useState(nameTag?.tag ?? '');

  const stats = useMemo(() => calculateAllTimeStats(dailyLogs), [dailyLogs]);

  useEffect(() => {
    if (supabaseReady && stats) {
      syncStats({
        totalWorkouts: stats.totalSessions,
        bestRunDistance: stats.runLongest,
        longestRide: stats.bikeLongest,
        swimTotal: stats.swimTotal,
        currentStreak: stats.currentStreak,
        totalTrainingTime: stats.totalTrainingTime,
      });
      console.log('[Profile] Auto-synced stats to Supabase');
    }
  }, [supabaseReady, stats.totalSessions, stats.currentStreak, stats.totalTrainingTime]);

  const isConfigVisible = useCallback((configId: string): boolean => {
    const config = workoutConfigs.find((c) => c.id === configId);
    if (!config) return true;
    return config.showInSummaries !== false;
  }, [workoutConfigs]);

  const supplementsLoggedCount = useMemo(() => {
    let count = 0;
    for (const log of Object.values(dailyLogs)) {
      count += log.supplementsTaken.length;
    }
    return count;
  }, [dailyLogs]);

  const totalSupplementsPossible = useMemo(() => {
    return Object.keys(dailyLogs).length * supplements.length;
  }, [dailyLogs, supplements]);

  const adherence = totalSupplementsPossible > 0
    ? Math.round((supplementsLoggedCount / totalSupplementsPossible) * 100)
    : 0;

  const recoveryAllTimeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const opt of recoveryOptions) {
      counts[opt.id] = 0;
    }
    for (const log of Object.values(dailyLogs)) {
      for (const rid of log.recoveryCompleted) {
        if (counts[rid] !== undefined) {
          counts[rid]++;
        }
      }
    }
    return counts;
  }, [dailyLogs, recoveryOptions]);

  const totalRecoveryActions = useMemo(() => {
    let total = 0;
    for (const count of Object.values(recoveryAllTimeCounts)) {
      total += count;
    }
    return total;
  }, [recoveryAllTimeCounts]);

  const handlePickPhoto = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          console.log('[Profile] Permission denied for media library');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        updateProfile({ photoUri: result.assets[0].uri });
        console.log('[Profile] Photo updated');
      }
    } catch (e) {
      console.log('[Profile] Photo pick error:', e);
    }
  };

  const handleSaveName = () => {
    const trimmed = editName.trim();
    if (trimmed) {
      updateProfile({ name: trimmed });
    } else {
      setEditName(profile.name);
    }
    setIsEditingName(false);
  };

  const handleStartEdit = () => {
    setEditName(profile.name);
    setIsEditingName(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <LinearGradient
      colors={[Colors.gradientStart, Colors.gradientMid, Colors.gradientEnd]}
      style={styles.container}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handlePickPhoto}
            activeOpacity={0.8}
            testID="profile-photo-btn"
          >
            {profile.photoUri ? (
              <Image source={{ uri: profile.photoUri }} style={styles.avatarImage} />
            ) : (
              <LinearGradient
                colors={[Colors.accent, '#7B68EE']}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {profile.name.charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            )}
            <View style={styles.cameraOverlay}>
              <Camera size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          {isEditingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={editName}
                onChangeText={setEditName}
                onBlur={handleSaveName}
                onSubmitEditing={handleSaveName}
                autoFocus
                returnKeyType="done"
                selectTextOnFocus
                testID="profile-name-input"
              />
            </View>
          ) : (
            <TouchableOpacity style={styles.nameRow} onPress={handleStartEdit} activeOpacity={0.7}>
              <Text style={styles.profileName}>{profile.name}</Text>
              <Pencil size={14} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}

          <Text style={styles.profileEvent}>
            {profile.eventName}{profile.eventDate ? ` · ${daysUntil(profile.eventDate)} days away` : ''}
          </Text>
        </View>

        {nameTag ? (
          <View style={styles.nameTagRow}>
            <AtSign size={14} color={Colors.social} />
            <Text style={styles.nameTagText}>{nameTag.tag}</Text>
            {nameTag.changesLeft > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  setEditTag(nameTag.tag);
                  setIsEditingTag(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.7}
              >
                <Pencil size={12} color={Colors.textTertiary} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.createTagBtn}
            onPress={() => setIsEditingTag(true)}
            activeOpacity={0.7}
          >
            <AtSign size={14} color={Colors.social} />
            <Text style={styles.createTagText}>Create Name Tag</Text>
          </TouchableOpacity>
        )}

        {isEditingTag ? (
          <View style={styles.tagEditContainer}>
            <View style={styles.tagEditRow}>
              <AtSign size={16} color={Colors.social} />
              <TextInput
                style={styles.tagInput}
                value={editTag}
                onChangeText={(t) => setEditTag(t.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))}
                placeholder="YourNameTag"
                placeholderTextColor={Colors.textTertiary}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (editTag.trim().length >= 3) {
                    if (nameTag) {
                      updateNameTag(editTag.trim());
                    } else {
                      createNameTag(editTag.trim());
                    }
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                  setIsEditingTag(false);
                }}
              />
            </View>
            <Text style={styles.tagHint}>3-20 chars, letters, numbers, underscore</Text>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Trophy size={20} color={Colors.warning} />
            <Text style={styles.statValue}>{stats.totalSessions}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statCard}>
            <Flame size={20} color={Colors.run} />
            <Text style={styles.statValue}>{stats.currentStreak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          <View style={styles.statCard}>
            <TrendingUp size={20} color={Colors.success} />
            <Text style={styles.statValue}>{stats.totalMiles.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Total Miles</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>ALL-TIME STATS</Text>

        {isConfigVisible('swim') ? <GlassCard accentColor={Colors.swim}>
          <View style={styles.disciplineHeader}>
            <Text style={styles.disciplineEmoji}>🏊</Text>
            <Text style={[styles.disciplineTitle, { color: Colors.swim }]}>Swim</Text>
          </View>
          <View style={styles.disciplineStats}>
            <View style={styles.disciplineStat}>
              <Text style={styles.disciplineStatValue}>
                {stats.swimTotal > 0 ? `${(stats.swimTotal / 1000).toFixed(1)}km` : '\u2014'}
              </Text>
              <Text style={styles.disciplineStatLabel}>Total</Text>
            </View>
            <View style={styles.disciplineStat}>
              <Text style={styles.disciplineStatValue}>
                {stats.swimLongest > 0 ? `${stats.swimLongest}m` : '\u2014'}
              </Text>
              <Text style={styles.disciplineStatLabel}>Longest</Text>
            </View>
            <View style={styles.disciplineStat}>
              <Text style={styles.disciplineStatValue}>
                {stats.swimBestPace > 0
                  ? `${Math.floor(stats.swimBestPace / 60)}:${String(Math.round(stats.swimBestPace % 60)).padStart(2, '0')}/100m`
                  : '\u2014'}
              </Text>
              <Text style={styles.disciplineStatLabel}>Best Pace</Text>
            </View>
          </View>
        </GlassCard> : null}

        {isConfigVisible('bike') ? <GlassCard accentColor={Colors.bike}>
          <View style={styles.disciplineHeader}>
            <Text style={styles.disciplineEmoji}>🚴</Text>
            <Text style={[styles.disciplineTitle, { color: Colors.bike }]}>Bike</Text>
          </View>
          <View style={styles.disciplineStats}>
            <View style={styles.disciplineStat}>
              <Text style={styles.disciplineStatValue}>
                {stats.bikeTotal > 0 ? `${stats.bikeTotal.toFixed(1)}mi` : '\u2014'}
              </Text>
              <Text style={styles.disciplineStatLabel}>Total</Text>
            </View>
            <View style={styles.disciplineStat}>
              <Text style={styles.disciplineStatValue}>
                {stats.bikeLongest > 0 ? `${stats.bikeLongest.toFixed(1)}mi` : '\u2014'}
              </Text>
              <Text style={styles.disciplineStatLabel}>Longest</Text>
            </View>
            <View style={styles.disciplineStat}>
              <Text style={styles.disciplineStatValue}>
                {stats.bikeBestSpeed > 0 ? `${stats.bikeBestSpeed.toFixed(1)}mph` : '\u2014'}
              </Text>
              <Text style={styles.disciplineStatLabel}>Best Speed</Text>
            </View>
          </View>
        </GlassCard> : null}

        {isConfigVisible('run') ? <GlassCard accentColor={Colors.run}>
          <View style={styles.disciplineHeader}>
            <Text style={styles.disciplineEmoji}>🏃</Text>
            <Text style={[styles.disciplineTitle, { color: Colors.run }]}>Run</Text>
          </View>
          <View style={styles.disciplineStats}>
            <View style={styles.disciplineStat}>
              <Text style={styles.disciplineStatValue}>
                {stats.runTotal > 0 ? `${stats.runTotal.toFixed(1)}mi` : '\u2014'}
              </Text>
              <Text style={styles.disciplineStatLabel}>Total</Text>
            </View>
            <View style={styles.disciplineStat}>
              <Text style={styles.disciplineStatValue}>
                {stats.runLongest > 0 ? `${stats.runLongest.toFixed(1)}mi` : '\u2014'}
              </Text>
              <Text style={styles.disciplineStatLabel}>Longest</Text>
            </View>
            <View style={styles.disciplineStat}>
              <Text style={styles.disciplineStatValue}>
                {stats.runBestPace > 0
                  ? `${Math.floor(stats.runBestPace / 60)}:${String(Math.round(stats.runBestPace % 60)).padStart(2, '0')}/mi`
                  : '\u2014'}
              </Text>
              <Text style={styles.disciplineStatLabel}>Best Pace</Text>
            </View>
          </View>
        </GlassCard> : null}

        <Text style={styles.sectionTitle}>TRACKING</Text>

        <GlassCard accentColor={Colors.supplement}>
          <View style={styles.trackingRow}>
            <View>
              <Text style={[styles.trackingTitle, { color: Colors.supplement }]}>
                Supplement Tracking
              </Text>
              <Text style={styles.trackingSubtitle}>
                {supplementsLoggedCount} doses logged
              </Text>
            </View>
            <View style={styles.adherenceBadge}>
              <Text style={styles.adherenceText}>{adherence}%</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard>
          <View style={styles.trackingRow}>
            <View style={styles.trackingRowLeft}>
              <Timer size={20} color={Colors.accent} />
              <View>
                <Text style={styles.trackingTitle}>Total Training Time</Text>
                <Text style={styles.trackingSubtitle}>
                  {formatTime(stats.totalTrainingTime)}
                </Text>
              </View>
            </View>
          </View>
        </GlassCard>

        {recoveryOptions.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>RECOVERY TRACKING</Text>

            <GlassCard accentColor={Colors.recovery}>
              <View style={styles.recoveryHeader}>
                <Heart size={18} color={Colors.recovery} />
                <Text style={[styles.trackingTitle, { color: Colors.recovery }]}>
                  Recovery Actions
                </Text>
                <View style={styles.recoveryTotalBadge}>
                  <Text style={styles.recoveryTotalText}>{totalRecoveryActions}x</Text>
                </View>
              </View>

              {recoveryOptions.map((opt) => {
                const count = recoveryAllTimeCounts[opt.id] ?? 0;
                return (
                  <View key={opt.id} style={styles.recoveryStatRow}>
                    <Text style={styles.recoveryStatName}>{opt.name}</Text>
                    <View style={styles.recoveryStatRight}>
                      <Text style={styles.recoveryStatCount}>{count}x</Text>
                      <View style={styles.recoveryStatBarBg}>
                        <View
                          style={[
                            styles.recoveryStatBarFill,
                            {
                              width: totalRecoveryActions > 0
                                ? `${Math.min((count / totalRecoveryActions) * 100, 100)}%`
                                : '0%',
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </GlassCard>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>SOCIAL & CONNECTIONS</Text>

        <TouchableOpacity
          style={styles.socialLink}
          onPress={() => router.push('/friends' as never)}
          activeOpacity={0.7}
        >
          <View style={[styles.socialLinkIcon, { backgroundColor: Colors.socialDark }]}>
            <Users size={18} color={Colors.social} />
          </View>
          <View style={styles.socialLinkText}>
            <Text style={styles.socialLinkTitle}>Friends Network</Text>
            <Text style={styles.socialLinkSubtitle}>View and manage friends</Text>
          </View>
          <ChevronRight size={16} color={Colors.textTertiary} />
        </TouchableOpacity>

        {showWhoopData && latestWhoopMetrics ? (
          <>
            <Text style={styles.sectionTitle}>WHOOP RECOVERY</Text>
            <GlassCard accentColor={Colors.whoop}>
              <View style={styles.whoopRow}>
                <Zap size={18} color={Colors.whoop} />
                <View style={styles.whoopInfo}>
                  <Text style={[styles.trackingTitle, { color: Colors.whoop }]}>Recovery ({latestWhoopMetrics.date})</Text>
                  <Text style={styles.trackingSubtitle}>
                    {latestWhoopMetrics.recoveryScore > 0 ? `${latestWhoopMetrics.recoveryScore}%` : '\u2014'}
                    {' · Strain '}
                    {latestWhoopMetrics.rawStrain > 0 ? latestWhoopMetrics.strain : '\u2014'}
                    {' · Sleep '}
                    {latestWhoopMetrics.sleepDurationSeconds > 0 ? formatSleepDuration(latestWhoopMetrics.sleepDurationSeconds) : '\u2014'}
                  </Text>
                </View>
                {latestWhoopMetrics.recoveryScore > 0 ? (
                  <View style={[styles.whoopBadge, {
                    backgroundColor: latestWhoopMetrics.recoveryScore >= 67 ? Colors.success + '20' : latestWhoopMetrics.recoveryScore >= 34 ? Colors.warning + '20' : Colors.danger + '20',
                  }]}>
                    <Text style={[styles.whoopBadgeText, {
                      color: latestWhoopMetrics.recoveryScore >= 67 ? Colors.success : latestWhoopMetrics.recoveryScore >= 34 ? Colors.warning : Colors.danger,
                    }]}>
                      {latestWhoopMetrics.recoveryScore}%
                    </Text>
                  </View>
                ) : null}
              </View>
            </GlassCard>
          </>
        ) : null}

        {isSignedIn && account ? (
          <GlassCard>
            <View style={styles.accountRow}>
              <View style={styles.accountIcon}>
                <Text style={styles.accountIconText}>{account.displayName.charAt(0)}</Text>
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.trackingTitle}>{account.displayName}</Text>
                <Text style={styles.trackingSubtitle}>{account.email}</Text>
              </View>
            </View>
          </GlassCard>
        ) : null}

        <View style={{ height: 32 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  avatarContainer: {
    marginBottom: 12,
    position: 'relative' as const,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  cameraOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: 2,
    borderColor: Colors.gradientStart,
  },
  nameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
  },
  nameEditRow: {
    width: '70%',
  },
  nameInput: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
    textAlign: 'center' as const,
    borderBottomWidth: 2,
    borderBottomColor: Colors.accent,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  profileEvent: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
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
  disciplineHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 14,
  },
  disciplineEmoji: {
    fontSize: 22,
  },
  disciplineTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  disciplineStats: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },
  disciplineStat: {
    flex: 1,
    alignItems: 'center' as const,
  },
  disciplineStatValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  disciplineStatLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
    fontWeight: '500' as const,
  },
  trackingRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  trackingRowLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  trackingTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  trackingSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  adherenceBadge: {
    backgroundColor: Colors.supplementDark,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  adherenceText: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: Colors.supplement,
  },
  recoveryHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 14,
  },
  recoveryTotalBadge: {
    marginLeft: 'auto' as const,
    backgroundColor: Colors.recoveryDark,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  recoveryTotalText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: Colors.recovery,
  },
  recoveryStatRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  recoveryStatName: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    width: 110,
  },
  recoveryStatRight: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  recoveryStatCount: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    minWidth: 36,
    textAlign: 'right' as const,
  },
  recoveryStatBarBg: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  recoveryStatBarFill: {
    height: 5,
    backgroundColor: Colors.recovery,
    borderRadius: 3,
  },
  nameTagRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    justifyContent: 'center' as const,
    marginTop: 4,
    marginBottom: 4,
  },
  nameTagText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.social,
  },
  createTagBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    justifyContent: 'center' as const,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.socialDark,
    alignSelf: 'center' as const,
  },
  createTagText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.social,
  },
  tagEditContainer: {
    alignItems: 'center' as const,
    marginTop: 8,
    marginBottom: 8,
  },
  tagEditRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.social + '40',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tagInput: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    minWidth: 140,
  },
  tagHint: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 6,
  },
  socialLink: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 12,
    gap: 12,
  },
  socialLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  socialLinkText: {
    flex: 1,
  },
  socialLinkTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  socialLinkSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  whoopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  whoopInfo: {
    flex: 1,
  },
  whoopBadge: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  whoopBadgeText: {
    fontSize: 15,
    fontWeight: '800' as const,
  },
  accountRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.googleDark,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  accountIconText: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.google,
  },
  accountInfo: {
    flex: 1,
  },
});
