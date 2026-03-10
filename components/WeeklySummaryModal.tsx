import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { DailyLog, RecoveryOption, WorkoutConfig } from '@/constants/types';
import { formatTime, getWeekDates, getWeekStartDate, getWeekEndDate, formatDateRange, formatDate } from '@/utils/dateUtils';
import { calculateWeeklyStats } from '@/utils/calculations';

interface WeeklySummaryModalProps {
  visible: boolean;
  onClose: () => void;
  dailyLogs: Record<string, DailyLog>;
  supplementsCount: number;
  recoveryOptions: RecoveryOption[];
  initialDate: Date;
  workoutConfigs?: WorkoutConfig[];
}

export default function WeeklySummaryModal({
  visible,
  onClose,
  dailyLogs,
  supplementsCount,
  recoveryOptions,
  initialDate,
  workoutConfigs,
}: WeeklySummaryModalProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  React.useEffect(() => {
    if (visible) {
      setWeekOffset(0);
    }
  }, [visible]);

  const currentWeekDate = useMemo(() => {
    const d = new Date(initialDate);
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [initialDate, weekOffset]);

  const stats = useMemo(
    () => calculateWeeklyStats(dailyLogs, currentWeekDate, supplementsCount),
    [dailyLogs, currentWeekDate, supplementsCount]
  );

  const weekStart = getWeekStartDate(currentWeekDate);
  const weekEnd = getWeekEndDate(currentWeekDate);
  const rangeLabel = formatDateRange(weekStart, weekEnd);

  const isThisWeek = useMemo(() => {
    const todayStart = getWeekStartDate(new Date());
    return todayStart.getTime() === weekStart.getTime();
  }, [weekStart]);

  const recoverySummary = useMemo(() => {
    if (recoveryOptions.length === 0) return [];
    const weekDates = getWeekDates(currentWeekDate);
    const dateKeys = weekDates.map((d) => formatDate(d));

    return recoveryOptions.map((opt) => {
      let daysCompleted = 0;
      for (const key of dateKeys) {
        const log = dailyLogs[key];
        if (log && log.recoveryCompleted.includes(opt.id)) {
          daysCompleted++;
        }
      }
      return {
        id: opt.id,
        name: opt.name,
        daysCompleted,
        weeklyGoal: opt.weeklyGoal ?? 0,
        trackOnly: opt.trackOnly ?? false,
      };
    });
  }, [recoveryOptions, dailyLogs, currentWeekDate]);

  const recoveryAdherence = useMemo(() => {
    if (recoverySummary.length === 0) return 0;
    let totalCompleted = 0;
    let totalGoals = 0;
    for (const r of recoverySummary) {
      if (r.trackOnly || r.weeklyGoal <= 0) continue;
      totalCompleted += Math.min(r.daysCompleted, r.weeklyGoal);
      totalGoals += r.weeklyGoal;
    }
    return totalGoals > 0 ? Math.round((totalCompleted / totalGoals) * 100) : 0;
  }, [recoverySummary]);

  const handlePrev = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWeekOffset((o) => o - 1);
  }, []);

  const handleNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWeekOffset((o) => o + 1);
  }, []);

  const handleBackToThisWeek = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setWeekOffset(0);
  }, []);

  const isConfigVisible = useCallback((configId: string): boolean => {
    if (!workoutConfigs) return true;
    const config = workoutConfigs.find((c) => c.id === configId);
    if (!config) return true;
    return config.showInSummaries !== false;
  }, [workoutConfigs]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <View style={styles.weekNav}>
              <TouchableOpacity onPress={handlePrev} style={styles.weekNavBtn}>
                <ChevronLeft size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.weekNavCenter}>
                <Text style={styles.title}>Weekly Summary</Text>
                <Text style={styles.subtitle}>{rangeLabel}</Text>
              </View>
              <TouchableOpacity onPress={handleNext} style={styles.weekNavBtn}>
                <ChevronRight size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {!isThisWeek && (
              <TouchableOpacity onPress={handleBackToThisWeek} style={styles.backBtn}>
                <Text style={styles.backBtnText}>Back to This Week</Text>
              </TouchableOpacity>
            )}

            <View style={styles.mainStats}>
              <View style={styles.mainStat}>
                <Text style={styles.mainStatValue}>{formatTime(stats.totalTime)}</Text>
                <Text style={styles.mainStatLabel}>Total Time</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.mainStat}>
                <Text style={styles.mainStatValue}>{stats.totalDistance.toFixed(1)}</Text>
                <Text style={styles.mainStatLabel}>Total Miles</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.mainStat}>
                <Text style={styles.mainStatValue}>{stats.sessionsCount}</Text>
                <Text style={styles.mainStatLabel}>Sessions</Text>
              </View>
            </View>

            <View style={styles.breakdown}>
              {isConfigVisible('swim') && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownEmoji}>🏊</Text>
                  <Text style={[styles.breakdownLabel, { color: Colors.swim }]}>Swim</Text>
                  <Text style={styles.breakdownValue}>
                    {stats.swimDistance > 0 ? `${stats.swimDistance.toFixed(0)}m` : '\u2014'}
                  </Text>
                  <Text style={styles.breakdownTime}>
                    {stats.swimTime > 0 ? formatTime(stats.swimTime) : '\u2014'}
                  </Text>
                </View>
              )}
              {isConfigVisible('bike') && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownEmoji}>🚴</Text>
                  <Text style={[styles.breakdownLabel, { color: Colors.bike }]}>Bike</Text>
                  <Text style={styles.breakdownValue}>
                    {stats.bikeDistance > 0 ? `${stats.bikeDistance.toFixed(1)}mi` : '\u2014'}
                  </Text>
                  <Text style={styles.breakdownTime}>
                    {stats.bikeTime > 0 ? formatTime(stats.bikeTime) : '\u2014'}
                  </Text>
                </View>
              )}
              {isConfigVisible('run') && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownEmoji}>🏃</Text>
                  <Text style={[styles.breakdownLabel, { color: Colors.run }]}>Run</Text>
                  <Text style={styles.breakdownValue}>
                    {stats.runDistance > 0 ? `${stats.runDistance.toFixed(1)}mi` : '\u2014'}
                  </Text>
                  <Text style={styles.breakdownTime}>
                    {stats.runTime > 0 ? formatTime(stats.runTime) : '\u2014'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.adherenceSection}>
              <Text style={styles.adherenceLabel}>Supplement Adherence</Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(100, stats.supplementAdherence * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.adherenceValue}>
                {Math.round(stats.supplementAdherence * 100)}%
              </Text>
            </View>

            {recoverySummary.length > 0 ? (
              <View style={styles.recoverySection}>
                <View style={styles.recoverySectionHeader}>
                  <Text style={styles.recoverySectionTitle}>Recovery Summary</Text>
                  <View style={styles.recoveryAdherenceBadge}>
                    <Text style={styles.recoveryAdherenceText}>{recoveryAdherence}%</Text>
                  </View>
                </View>
                {recoverySummary.map((r) => {
                  const hasGoal = !r.trackOnly && r.weeklyGoal > 0;
                  const pct = hasGoal ? Math.min((r.daysCompleted / r.weeklyGoal) * 100, 100) : 0;
                  return (
                    <View key={r.id} style={styles.recoveryRow}>
                      <Text style={styles.recoveryName}>{r.name}</Text>
                      {hasGoal ? (
                        <View style={styles.recoveryBarContainer}>
                          <View style={styles.recoveryBarBg}>
                            <View
                              style={[
                                styles.recoveryBarFill,
                                { width: `${pct}%` },
                              ]}
                            />
                          </View>
                        </View>
                      ) : (
                        <View style={styles.recoveryBarContainer} />
                      )}
                      <Text style={styles.recoveryCount}>
                        {hasGoal ? `${r.daysCompleted}/${r.weeklyGoal}` : `${r.daysCompleted}x`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            <TouchableOpacity style={styles.ctaBtn} onPress={handleClose} testID="weekly-summary-close">
              <Text style={styles.ctaBtnText}>Done</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  modal: {
    backgroundColor: '#141B33',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorderLight,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '85%',
  },
  weekNav: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 16,
  },
  weekNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  weekNavCenter: {
    flex: 1,
    alignItems: 'center' as const,
  },
  title: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  backBtn: {
    alignSelf: 'center' as const,
    backgroundColor: Colors.accent + '20',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 14,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  mainStats: {
    flexDirection: 'row' as const,
    justifyContent: 'space-around' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  mainStat: {
    alignItems: 'center' as const,
    flex: 1,
  },
  mainStatValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
  },
  mainStatLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 4,
    fontWeight: '600' as const,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.cardBorder,
  },
  breakdown: {
    gap: 8,
    marginBottom: 20,
  },
  breakdownRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  breakdownEmoji: {
    fontSize: 20,
    width: 28,
  },
  breakdownLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    flex: 1,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    minWidth: 60,
    textAlign: 'right' as const,
  },
  breakdownTime: {
    fontSize: 13,
    color: Colors.textSecondary,
    minWidth: 60,
    textAlign: 'right' as const,
  },
  adherenceSection: {
    marginBottom: 20,
  },
  adherenceLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.inputBackground,
    borderRadius: 4,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: 8,
    backgroundColor: Colors.supplement,
    borderRadius: 4,
  },
  adherenceValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.supplement,
    textAlign: 'right' as const,
    marginTop: 4,
  },
  recoverySection: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.recovery + '20',
  },
  recoverySectionHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  recoverySectionTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.recovery,
  },
  recoveryAdherenceBadge: {
    backgroundColor: Colors.recoveryDark,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  recoveryAdherenceText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: Colors.recovery,
  },
  recoveryRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
    gap: 10,
  },
  recoveryName: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    width: 90,
  },
  recoveryBarContainer: {
    flex: 1,
  },
  recoveryBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  recoveryBarFill: {
    height: 6,
    backgroundColor: Colors.recovery,
    borderRadius: 3,
  },
  recoveryCount: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    minWidth: 32,
    textAlign: 'right' as const,
  },
  ctaBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center' as const,
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
});
