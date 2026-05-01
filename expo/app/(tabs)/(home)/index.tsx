import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Plus, Check, BarChart3, Target, Zap, Moon, Activity } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Workout, ImportedWorkout } from '@/constants/types';
import { useTraining } from '@/providers/TrainingProvider';
import { useAuth } from '@/providers/AuthProvider';
import { formatSleepDuration, hasRealMetrics } from '@/utils/whoopMapper';
import { getRecoveryIntensitySuggestion, fetchStravaActivities, refreshStravaToken } from '@/utils/integrations';
import { deduplicateWorkouts } from '@/utils/dedup';
import { formatDate, daysUntil, getMonthName, isToday as isTodayUtil, getWeekDates } from '@/utils/dateUtils';
import { convertDistance } from '@/utils/calculations';
import WeekCalendar from '@/components/WeekCalendar';
import WorkoutCard from '@/components/WorkoutCard';
import GlassCard from '@/components/GlassCard';
import SupplementModal from '@/components/SupplementModal';
import RecoveryModal from '@/components/RecoveryModal';
import WeeklySummaryModal from '@/components/WeeklySummaryModal';
import ProgressBottomSheet from '@/components/ProgressBottomSheet';



export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const {
    profile,
    supplements,
    addSupplement,
    recoveryOptions,
    addRecoveryOption,
    dailyLogs,
    getDailyLog,
    saveWorkout,
    deleteWorkout,
    toggleSupplement,
    toggleRecovery,
    workoutConfigs,
    isLoading,
    dataReady,
    activeEvent,
    activeGoalEvent,
    hasSeenEventOnboarding,
  } = useTraining();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showSupplementModal, setShowSupplementModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showWeeklySummary, setShowWeeklySummary] = useState(false);
  const [showProgressSheet, setShowProgressSheet] = useState(false);

  const { integrations, getWhoopMetricsForDate, importedWorkouts, addImportedWorkouts, updateIntegration } = useAuth();
  const autoSyncRunning = useRef(false);
  const reconciliationDone = useRef(false);

  const saveImportedToLogs = useCallback((imported: ImportedWorkout[]) => {
    console.log('[Home] Saving', imported.length, 'imported workouts to daily logs');
    const savedInThisBatch = new Set<string>();
    let savedCount = 0;

    for (const iw of imported) {
      const batchKey = `${iw.source}_${iw.sourceId}`;
      if (savedInThisBatch.has(batchKey)) continue;

      const config = workoutConfigs.find((c) => c.id === iw.type);
      const fallback = config ?? workoutConfigs.find((c) => c.id === 'run') ?? workoutConfigs[0];
      if (!fallback) continue;

      const existingLog = getDailyLog(iw.date);
      const alreadySaved = existingLog.workouts.some(
        (w) => w.externalId === iw.sourceId && w.sourceProvider === iw.source
      );
      if (alreadySaved) continue;

      const activeConfig = config ?? fallback;
      const distUnit = activeConfig.distanceUnit;
      const distanceInUnit = convertDistance(iw.distance, 'km', distUnit);

      let avgSpeed: number | undefined;
      if (iw.avgSpeedKmh && iw.avgSpeedKmh > 0) {
        const speedInUnit = convertDistance(iw.avgSpeedKmh, 'km', distUnit);
        avgSpeed = Math.round(speedInUnit * 100) / 100;
      }

      const workout: Workout = {
        id: iw.id,
        type: config ? iw.type : fallback.id,
        distance: Math.round(distanceInUnit * 100) / 100,
        time: iw.time,
        elevation: iw.elevation,
        avgSpeed,
        laps: iw.laps,
        sourceProvider: iw.source,
        externalId: iw.sourceId,
      };
      saveWorkout(iw.date, workout);
      savedInThisBatch.add(batchKey);
      savedCount++;
      console.log('[Home] Saved imported workout:', iw.date, workout.type, 'dist:', workout.distance, distUnit);
    }
    console.log('[Home] Batch save complete:', savedCount, 'of', imported.length, 'saved');
  }, [workoutConfigs, getDailyLog, saveWorkout]);

  useEffect(() => {
    if (dataReady && hasSeenEventOnboarding === false) {
      console.log('[HomeScreen] First launch detected, redirecting to onboarding');
      router.replace('/onboarding' as never);
    }
  }, [dataReady, hasSeenEventOnboarding, router]);

  const performStravaAutoSync = useCallback(async () => {
    if (autoSyncRunning.current) return;
    const stravaConfig = integrations?.strava;
    if (!stravaConfig || stravaConfig.status !== 'connected') return;

    const lastSync = stravaConfig.lastSyncAt;
    if (lastSync) {
      const hoursSince = (Date.now() - new Date(lastSync).getTime()) / (1000 * 60 * 60);
      if (hoursSince < 12) {
        console.log('[Home] Strava auto-sync skipped, last sync', Math.round(hoursSince), 'hours ago');
        return;
      }
    }

    autoSyncRunning.current = true;
    console.log('[Home] Starting Strava auto-sync...');

    try {
      let token = stravaConfig.accessToken ?? '';
      const refreshTk = stravaConfig.refreshToken;
      const expiresAt = stravaConfig.tokenExpiresAt;

      if (expiresAt && new Date(expiresAt) < new Date() && refreshTk) {
        try {
          const refreshed = await refreshStravaToken(refreshTk);
          token = refreshed.accessToken;
          updateIntegration('strava', {
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            tokenExpiresAt: new Date(refreshed.expiresAt * 1000).toISOString(),
          });
        } catch (refreshErr) {
          console.warn('[Home] Strava token refresh failed:', refreshErr);
          return;
        }
      }

      const afterTimestamp = lastSync
        ? Math.floor(new Date(lastSync).getTime() / 1000)
        : Math.floor((Date.now() - 2 * 24 * 60 * 60 * 1000) / 1000);

      const activities = await fetchStravaActivities(token, afterTimestamp);
      const newWorkouts = deduplicateWorkouts(importedWorkouts, activities);
      if (newWorkouts.length > 0) {
        addImportedWorkouts(newWorkouts);
        saveImportedToLogs(newWorkouts);
        updateIntegration('strava', {
          importedCount: (stravaConfig.importedCount ?? 0) + newWorkouts.length,
        });
      }
      updateIntegration('strava', {
        lastSyncAt: new Date().toISOString(),
        lastSuccessfulSyncAt: new Date().toISOString(),
        error: undefined,
      });
      console.log(`[Home] Strava auto-sync complete: ${newWorkouts.length} new workouts`);
    } catch (err) {
      console.warn('[Home] Strava auto-sync failed:', err);
      updateIntegration('strava', {
        error: err instanceof Error ? err.message : 'Auto-sync failed',
      });
    } finally {
      autoSyncRunning.current = false;
    }
  }, [integrations?.strava, importedWorkouts, addImportedWorkouts, updateIntegration, saveImportedToLogs]);

  useEffect(() => {
    if (!dataReady || reconciliationDone.current) return;
    if (importedWorkouts.length === 0) {
      reconciliationDone.current = true;
      return;
    }

    reconciliationDone.current = true;
    console.log('[Home] Running startup reconciliation for', importedWorkouts.length, 'imported workouts');

    let savedCount = 0;
    for (const iw of importedWorkouts) {
      const config = workoutConfigs.find((c) => c.id === iw.type);
      const fallback = config ?? workoutConfigs.find((c) => c.id === 'run') ?? workoutConfigs[0];
      if (!fallback) continue;

      const existingLog = getDailyLog(iw.date);
      const alreadySaved = existingLog.workouts.some(
        (w) => w.externalId === iw.sourceId && w.sourceProvider === iw.source
      );
      if (alreadySaved) continue;

      const activeConfig = config ?? fallback;
      const distUnit = activeConfig.distanceUnit;
      const distanceInUnit = convertDistance(iw.distance, 'km', distUnit);

      let avgSpeed: number | undefined;
      if (iw.avgSpeedKmh && iw.avgSpeedKmh > 0) {
        const speedInUnit = convertDistance(iw.avgSpeedKmh, 'km', distUnit);
        avgSpeed = Math.round(speedInUnit * 100) / 100;
      }

      const workout: Workout = {
        id: iw.id,
        type: config ? iw.type : fallback.id,
        distance: Math.round(distanceInUnit * 100) / 100,
        time: iw.time,
        elevation: iw.elevation,
        avgSpeed,
        laps: iw.laps,
        sourceProvider: iw.source,
        externalId: iw.sourceId,
      };
      saveWorkout(iw.date, workout);
      savedCount++;
      console.log('[Home] Reconciled imported workout:', iw.date, workout.type, 'dist:', workout.distance, distUnit);
    }
    console.log('[Home] Reconciliation complete:', savedCount, 'workouts saved to daily logs');
  }, [dataReady, importedWorkouts, workoutConfigs, getDailyLog, saveWorkout]);

  useEffect(() => {
    if (!dataReady) return;
    const timer = setTimeout(() => performStravaAutoSync(), 3000);
    const interval = setInterval(performStravaAutoSync, 12 * 60 * 60 * 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [dataReady, performStravaAutoSync]);

  const dateKey = formatDate(selectedDate);
  const dailyLog = getDailyLog(dateKey);

  const eventName = activeEvent?.name ?? profile.eventName;
  const eventDate = activeEvent?.eventDate ?? profile.eventDate;
  const hasEventDate = eventDate && eventDate.trim().length > 0;
  const daysLeft = hasEventDate ? daysUntil(eventDate) : null;

  const eventDisplayParts = useMemo(() => {
    if (!eventName || eventName === 'Fitness') return null;
    const eventType = activeEvent?.type ?? '';
    if (eventType === 'Ironman 70.3') {
      return { prefix: 'Ironman', suffix: '70.3' };
    }
    if (eventType === 'Ironman') {
      return { prefix: 'Ironman', suffix: '' };
    }
    const parts = eventName.split(' ');
    if (parts.length > 1) {
      return { prefix: parts.slice(0, -1).join(' '), suffix: parts[parts.length - 1] };
    }
    return { prefix: eventName, suffix: '' };
  }, [eventName, activeEvent]);

  const getWorkoutForType = useCallback(
    (typeId: string): Workout | undefined => {
      return dailyLog.workouts.find((w) => w.type === typeId);
    },
    [dailyLog.workouts]
  );

  const handleSaveWorkout = useCallback(
    (workout: Workout) => {
      saveWorkout(dateKey, workout);

      const isNewWorkout = !dailyLog.workouts.find((w) => w.id === workout.id);
      if (
        isNewWorkout &&
        profile.showProgressPopup &&
        activeGoalEvent &&
        activeGoalEvent.distances.length > 0
      ) {
        setTimeout(() => setShowProgressSheet(true), 600);
      }
    },
    [saveWorkout, dateKey, dailyLog.workouts, profile.showProgressPopup, activeGoalEvent]
  );

  const handleDeleteWorkout = useCallback(
    (workoutId: string) => {
      deleteWorkout(dateKey, workoutId);
    },
    [deleteWorkout, dateKey]
  );

  const handleToggleSupplement = useCallback(
    (supplementId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toggleSupplement(dateKey, supplementId);
    },
    [toggleSupplement, dateKey]
  );

  const handleToggleRecovery = useCallback(
    (optionId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toggleRecovery(dateKey, optionId);
    },
    [toggleRecovery, dateKey]
  );

  const { getLatestWhoopMetrics } = useAuth();

  const rawWhoopMetrics = useMemo(() => {
    return getWhoopMetricsForDate(dateKey);
  }, [getWhoopMetricsForDate, dateKey]);

  const whoopMetrics = useMemo(() => {
    if (rawWhoopMetrics && hasRealMetrics(rawWhoopMetrics)) return rawWhoopMetrics;
    return null;
  }, [rawWhoopMetrics]);

  const latestWhoopFallback = useMemo(() => {
    if (whoopMetrics) return null;
    const latest = getLatestWhoopMetrics();
    if (latest && hasRealMetrics(latest)) return latest;
    return null;
  }, [whoopMetrics, getLatestWhoopMetrics]);

  const whoopConnected = integrations?.whoop?.status === 'connected';

  const supplementsTaken = dailyLog.supplementsTaken;
  const recoveryCompleted = dailyLog.recoveryCompleted;

  const weeklyRecoveryCounts = useMemo(() => {
    const weekDates = getWeekDates(selectedDate);
    const counts: Record<string, number> = {};
    for (const d of weekDates) {
      const key = formatDate(d);
      const log = dailyLogs[key];
      if (!log) continue;
      for (const rid of log.recoveryCompleted) {
        counts[rid] = (counts[rid] ?? 0) + 1;
      }
    }
    return counts;
  }, [selectedDate, dailyLogs]);

  const selectedDayProgress = useMemo(() => {
    if (!activeGoalEvent || activeGoalEvent.distances.length === 0) return null;

    const results: { discipline: string; logged: number; goal: number; unit: string; percent: number; color: string; emoji: string }[] = [];

    for (const gd of activeGoalEvent.distances) {
      const config = workoutConfigs.find((c) => c.id === gd.discipline);
      if (!config) continue;

      const dayWorkouts = dailyLog.workouts.filter((w) => w.type === gd.discipline);
      let loggedInGoalUnit = 0;
      for (const w of dayWorkouts) {
        if (config.fields.includes('distance')) {
          loggedInGoalUnit += convertDistance(w.distance, config.distanceUnit, gd.unit);
        }
      }

      const percent = gd.distance > 0 ? Math.min((loggedInGoalUnit / gd.distance) * 100, 100) : 0;
      const unitShort = gd.unit === 'meters' ? 'm' : gd.unit === 'km' ? 'km' : gd.unit === 'yards' ? 'yd' : 'mi';

      results.push({
        discipline: gd.discipline,
        logged: Math.round(loggedInGoalUnit * 100) / 100,
        goal: gd.distance,
        unit: unitShort,
        percent: Math.round(percent * 10) / 10,
        color: config.color,
        emoji: config.emoji,
      });
    }

    return results.length > 0 ? results : null;
  }, [activeGoalEvent, dailyLog, workoutConfigs]);

  const monthLabel = `${getMonthName(selectedDate).toUpperCase().substring(0, 3)} ${selectedDate.getFullYear()}`;

  return (
    <LinearGradient
      colors={[Colors.gradientStart, Colors.gradientMid, Colors.gradientEnd]}
      style={styles.container}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => {}} tintColor={Colors.accent} />}
      >
        <View style={styles.headerSection}>
          <View style={styles.eventHeaderCard}>
            <LinearGradient
              colors={['rgba(15,21,40,0.95)', 'rgba(20,29,53,0.9)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.eventCardInner}>
              <View style={styles.eventCardTopRow}>
                <View style={styles.monthPill}>
                  <Text style={styles.monthPillText}>{monthLabel}</Text>
                </View>
                <Text style={styles.trainingLogLabel}>Training Log</Text>
                <TouchableOpacity
                  style={styles.summaryBtn}
                  onPress={() => setShowWeeklySummary(true)}
                  testID="weekly-summary-btn"
                >
                  <BarChart3 size={16} color={Colors.accent} />
                </TouchableOpacity>
              </View>

              {eventDisplayParts ? (
                <View style={styles.eventNameRow}>
                  <Text style={styles.eventNamePrefix}>{eventDisplayParts.prefix}</Text>
                  {eventDisplayParts.suffix ? (
                    <Text style={styles.eventNameSuffix}>{` ${eventDisplayParts.suffix}`}</Text>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.eventNamePrefix}>Training Log</Text>
              )}

              <View style={styles.eventCardDivider} />

              {hasEventDate && daysLeft !== null && daysLeft > 0 ? (
                <Text style={styles.countdownText}>
                  {`${daysLeft} days to go `}🔥
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <WeekCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />

        {selectedDayProgress ? (
          <>
            <Text style={styles.sectionTitle}>{isTodayUtil(selectedDate) ? "TODAY'S" : formatDate(selectedDate).toUpperCase()} RACE PROGRESS</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowProgressSheet(true)}
            >
              <GlassCard accentColor={Colors.accent}>
                <View style={styles.progressHeader}>
                  <Target size={16} color={Colors.accent} />
                  <Text style={styles.progressTitle}>{eventName}</Text>
                </View>
                {selectedDayProgress.map((p) => (
                  <View key={p.discipline} style={styles.progressRow}>
                    <View style={styles.progressRowTop}>
                      <Text style={styles.progressEmoji}>{p.emoji}</Text>
                      <Text style={styles.progressLabel}>
                        {p.logged} / {p.goal} {p.unit}
                      </Text>
                      <Text style={[styles.progressPercent, { color: p.color }]}>
                        {p.percent}%
                      </Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            backgroundColor: p.color,
                            width: `${Math.min(p.percent, 100)}%` as `${number}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </GlassCard>
            </TouchableOpacity>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>WORKOUTS</Text>

        {workoutConfigs.map((config) => (
          <WorkoutCard
  key={getWorkoutForType(config.id)?.id ?? config.id}
  config={config}
  workout={getWorkoutForType(config.id)}
  onSave={handleSaveWorkout}
  onDelete={handleDeleteWorkout}
/>
        ))}

        {supplements.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>SUPPLEMENTS</Text>
            <GlassCard accentColor={Colors.supplement}>
              {supplements.map((s) => {
                const taken = supplementsTaken.includes(s.id);
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.checkRow}
                    onPress={() => handleToggleSupplement(s.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, taken ? styles.checkboxChecked : undefined]}>
                      {taken ? <Check size={12} color="#FFFFFF" /> : null}
                    </View>
                    <Text style={[styles.checkLabel, taken && styles.checkLabelDone]}>
                      {s.name}
                    </Text>
                    <Text style={styles.checkDose}>{s.dose}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => setShowSupplementModal(true)}
                testID="add-supplement-btn"
              >
                <Plus size={16} color={Colors.supplement} />
                <Text style={styles.addBtnText}>Add Supplement</Text>
              </TouchableOpacity>
            </GlassCard>
          </>
        ) : null}

        {whoopConnected ? (
          <>
            <Text style={styles.sectionTitle}>WHOOP RECOVERY</Text>
            {whoopMetrics ? (
              <GlassCard accentColor={Colors.whoop}>
                <View style={styles.whoopPanelHeader}>
                  <Zap size={16} color={Colors.whoop} />
                  <Text style={styles.whoopPanelTitle}>WHOOP</Text>
                  {whoopMetrics.manualOverride ? (
                    <View style={styles.whoopOverrideBadge}>
                      <Text style={styles.whoopOverrideBadgeText}>Manual</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.whoopStatsRow}>
                  <View style={styles.whoopStatItem}>
                    <Text style={styles.whoopStatValue}>
                      {whoopMetrics.recoveryScore > 0 ? `${whoopMetrics.recoveryScore}%` : '—'}
                    </Text>
                    <Text style={styles.whoopStatLabel}>Recovery</Text>
                  </View>
                  <View style={styles.whoopStatDivider} />
                  <View style={styles.whoopStatItem}>
                    <Text style={styles.whoopStatValue}>
                      {whoopMetrics.rawStrain > 0 ? whoopMetrics.strain : '—'}
                    </Text>
                    <Text style={styles.whoopStatLabel}>Strain</Text>
                  </View>
                  <View style={styles.whoopStatDivider} />
                  <View style={styles.whoopStatItem}>
                    <View style={styles.whoopSleepRow}>
                      <Moon size={12} color={Colors.whoop} />
                      <Text style={styles.whoopStatValue}>
                        {whoopMetrics.sleepDurationSeconds > 0 ? formatSleepDuration(whoopMetrics.sleepDurationSeconds) : '—'}
                      </Text>
                    </View>
                    <Text style={styles.whoopStatLabel}>Sleep</Text>
                  </View>
                </View>
                {whoopMetrics.recoveryScore > 0 ? (
                  <View style={styles.whoopSuggestionBar}>
                    <Activity size={13} color={Colors.whoop} />
                    <Text style={styles.whoopSuggestionText}>
                      {getRecoveryIntensitySuggestion(whoopMetrics.recoveryScore)}
                    </Text>
                  </View>
                ) : null}
              </GlassCard>
            ) : latestWhoopFallback ? (
              <GlassCard accentColor={Colors.whoop}>
                <View style={styles.whoopPanelHeader}>
                  <Zap size={16} color={Colors.whoop} />
                  <Text style={styles.whoopPanelTitle}>WHOOP</Text>
                  <View style={styles.whoopOverrideBadge}>
                    <Text style={styles.whoopOverrideBadgeText}>Latest: {latestWhoopFallback.date}</Text>
                  </View>
                </View>
                <View style={styles.whoopStatsRow}>
                  <View style={styles.whoopStatItem}>
                    <Text style={styles.whoopStatValue}>
                      {latestWhoopFallback.recoveryScore > 0 ? `${latestWhoopFallback.recoveryScore}%` : '—'}
                    </Text>
                    <Text style={styles.whoopStatLabel}>Recovery</Text>
                  </View>
                  <View style={styles.whoopStatDivider} />
                  <View style={styles.whoopStatItem}>
                    <Text style={styles.whoopStatValue}>
                      {latestWhoopFallback.rawStrain > 0 ? latestWhoopFallback.strain : '—'}
                    </Text>
                    <Text style={styles.whoopStatLabel}>Strain</Text>
                  </View>
                  <View style={styles.whoopStatDivider} />
                  <View style={styles.whoopStatItem}>
                    <View style={styles.whoopSleepRow}>
                      <Moon size={12} color={Colors.whoop} />
                      <Text style={styles.whoopStatValue}>
                        {latestWhoopFallback.sleepDurationSeconds > 0 ? formatSleepDuration(latestWhoopFallback.sleepDurationSeconds) : '—'}
                      </Text>
                    </View>
                    <Text style={styles.whoopStatLabel}>Sleep</Text>
                  </View>
                </View>
                <Text style={styles.whoopNoData}>No WHOOP data for selected day — showing latest</Text>
              </GlassCard>
            ) : (
              <GlassCard accentColor={Colors.whoop}>
                <View style={styles.whoopPanelHeader}>
                  <Zap size={16} color={Colors.whoop} />
                  <Text style={styles.whoopPanelTitle}>WHOOP</Text>
                </View>
                <Text style={styles.whoopNoData}>No WHOOP data available yet</Text>
              </GlassCard>
            )}
          </>
        ) : null}

        {recoveryOptions.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>RECOVERY</Text>
            <GlassCard accentColor={Colors.recovery}>
              {recoveryOptions.map((r) => {
                const done = recoveryCompleted.includes(r.id);
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={styles.checkRow}
                    onPress={() => handleToggleRecovery(r.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkboxRecovery, done ? styles.checkboxRecoveryChecked : undefined]}>
                      {done ? <Check size={12} color="#FFFFFF" /> : null}
                    </View>
                    <Text style={[styles.checkLabel, done && styles.checkLabelDone]}>
                      {r.name}
                    </Text>
                    {r.weeklyGoal && r.weeklyGoal > 0 && !r.trackOnly ? (
                      <Text style={styles.checkDose}>
                        {weeklyRecoveryCounts[r.id] ?? 0}/{r.weeklyGoal}
                      </Text>
                    ) : r.trackOnly ? (
                      <Text style={styles.checkDoseTracked}>Tracked</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={styles.addBtnRecovery}
                onPress={() => setShowRecoveryModal(true)}
                testID="add-recovery-btn"
              >
                <Plus size={16} color={Colors.recovery} />
                <Text style={styles.addBtnTextRecovery}>Add Recovery</Text>
              </TouchableOpacity>
            </GlassCard>
          </>
        ) : null}

        <View style={{ height: 32 }} />
      </ScrollView>

      <SupplementModal
        visible={showSupplementModal}
        onClose={() => setShowSupplementModal(false)}
        onAdd={addSupplement}
        existing={supplements}
      />
      <RecoveryModal
        visible={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        onAdd={addRecoveryOption}
        existing={recoveryOptions}
      />
      <WeeklySummaryModal
        visible={showWeeklySummary}
        onClose={() => setShowWeeklySummary(false)}
        dailyLogs={dailyLogs}
        supplementsCount={supplements.length}
        recoveryOptions={recoveryOptions}
        initialDate={selectedDate}
        workoutConfigs={workoutConfigs}
      />
      {activeGoalEvent && activeGoalEvent.distances.length > 0 ? (
        <ProgressBottomSheet
          visible={showProgressSheet}
          onClose={() => setShowProgressSheet(false)}
          goalEvent={activeGoalEvent}
          dayLog={dailyLog}
          workoutConfigs={workoutConfigs}
          isToday={isTodayUtil(selectedDate)}
          dateLabel={formatDate(selectedDate)}
        />
      ) : null}
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
  headerSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  eventHeaderCard: {
    borderRadius: 20,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  eventCardInner: {
    padding: 20,
  },
  eventCardTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 14,
  },
  monthPill: {
    backgroundColor: 'rgba(94,159,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  monthPillText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.accent,
    letterSpacing: 0.8,
  },
  trainingLogLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textTertiary,
    flex: 1,
  },
  summaryBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  eventNameRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    marginBottom: 4,
  },
  eventNamePrefix: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
  },
  eventNameSuffix: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.accent,
  },
  eventCardDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 12,
  },
  countdownText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  progressHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  progressRow: {
    marginBottom: 10,
  },
  progressRowTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 6,
  },
  progressEmoji: {
    fontSize: 14,
  },
  progressLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    flex: 1,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.backgroundCard,
    overflow: 'hidden' as const,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  checkRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 10,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.supplement + '60',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  checkboxChecked: {
    backgroundColor: Colors.supplement,
    borderColor: Colors.supplement,
  },
  checkboxRecovery: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.recovery + '60',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  checkboxRecoveryChecked: {
    backgroundColor: Colors.recovery,
    borderColor: Colors.recovery,
  },
  checkLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.textPrimary,
    flex: 1,
  },
  checkLabelDone: {
    color: Colors.textSecondary,
    textDecorationLine: 'line-through' as const,
  },
  checkDose: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  checkDoseTracked: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontStyle: 'italic' as const,
  },
  addBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 12,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.supplement + '30',
    borderStyle: 'dashed' as const,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.supplement,
  },
  addBtnRecovery: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 12,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.recovery + '30',
    borderStyle: 'dashed' as const,
  },
  addBtnTextRecovery: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.recovery,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center' as const,
    paddingVertical: 8,
  },
  whoopPanelHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 14,
  },
  whoopPanelTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.whoop,
    letterSpacing: 1,
    flex: 1,
  },
  whoopOverrideBadge: {
    backgroundColor: Colors.warning + '20',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  whoopOverrideBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.warning,
  },
  whoopStatsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-around' as const,
    marginBottom: 14,
  },
  whoopStatItem: {
    alignItems: 'center' as const,
    flex: 1,
  },
  whoopStatValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
  },
  whoopStatLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 4,
    fontWeight: '500' as const,
  },
  whoopStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  whoopSleepRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  whoopSuggestionBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.whoopDark,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  whoopSuggestionText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.whoop,
  },
  whoopNoData: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center' as const,
    paddingVertical: 12,
  },
});
