import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart3 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useTraining } from '@/providers/TrainingProvider';
import { formatDate, formatTime, getWeekDates, getDayName, getMonthName, getWeekStartDate } from '@/utils/dateUtils';
import GlassCard from '@/components/GlassCard';
import ProgressBottomSheet from '@/components/ProgressBottomSheet';
import WeeklySummaryModal from '@/components/WeeklySummaryModal';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { dailyLogs, workoutConfigs, activeGoalEvent, activeEvent, profile, supplements, recoveryOptions } = useTraining();

  const [progressDate, setProgressDate] = useState<string | null>(null);
  const [summaryWeekDate, setSummaryWeekDate] = useState<Date | null>(null);

  const configMap = useMemo(() => {
    const map: Record<string, { emoji: string; distanceUnit: string; fields: string[]; fieldLabels?: Record<string, string> }> = {};
    for (const c of workoutConfigs) {
      map[c.id] = { emoji: c.emoji, distanceUnit: c.distanceUnit, fields: c.fields, fieldLabels: c.fieldLabels };
    }
    return map;
  }, [workoutConfigs]);

  const weeks = useMemo(() => {
    const result: { weekStart: Date; dates: Date[] }[] = [];
    const today = new Date();

    for (let w = 0; w < 8; w++) {
      const refDate = new Date(today);
      refDate.setDate(today.getDate() - w * 7);
      const dates = getWeekDates(refDate);
      result.push({ weekStart: dates[0], dates });
    }
    return result;
  }, []);

  const getWeekTotals = useCallback((dates: Date[]) => {
    let totalTime = 0;
    let totalDistance = 0;
    let sessions = 0;

    for (const d of dates) {
      const key = formatDate(d);
      const log = dailyLogs[key];
      if (!log) continue;
      for (const w of log.workouts) {
        totalTime += w.time;
        sessions++;
        const cfg = configMap[w.type];
        if (cfg && cfg.fields.includes('distance')) {
          if (cfg.distanceUnit === 'meters') {
            totalDistance += w.distance * 0.000621371;
          } else if (cfg.distanceUnit === 'km') {
            totalDistance += w.distance * 0.621371;
          } else if (cfg.distanceUnit === 'yards') {
            totalDistance += w.distance * 0.000568182;
          } else {
            totalDistance += w.distance;
          }
        }
      }
    }
    return { totalTime, totalDistance, sessions };
  }, [dailyLogs, configMap]);

  const getWorkoutSummary = useCallback((w: typeof dailyLogs[string]['workouts'][number]) => {
    const cfg = configMap[w.type];
    if (!cfg) return w.distance > 0 ? `${w.distance}` : '';

    const parts: string[] = [];

    if (cfg.fields.includes('distance') && w.distance > 0) {
      const unit = cfg.distanceUnit === 'meters' ? 'm'
        : cfg.distanceUnit === 'km' ? 'km'
        : cfg.distanceUnit === 'yards' ? 'yd' : 'mi';
      parts.push(`${w.distance}${unit}`);
    }

    if (w.customValues) {
      const customFields = cfg.fields.filter((f) => !['distance', 'time', 'laps', 'elevation', 'avgSpeed'].includes(f));
      for (const field of customFields.slice(0, 2)) {
        const val = w.customValues[field];
        if (val && val > 0) {
          const label = cfg.fieldLabels?.[field] || field;
          parts.push(`${val} ${label}`);
        }
      }
    }

    return parts.join(' \u00B7 ');
  }, [configMap]);

  const getWorkoutEmoji = useCallback((type: string) => {
    return configMap[type]?.emoji ?? '🏋️';
  }, [configMap]);

  const handleDayPress = useCallback((dateKey: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setProgressDate(dateKey);
  }, []);

  const handleWeeklySummary = useCallback((weekDate: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSummaryWeekDate(weekDate);
  }, []);

  const progressDayLog = useMemo(() => {
    if (!progressDate) return null;
    return dailyLogs[progressDate] ?? { date: progressDate, workouts: [], supplementsTaken: [], recoveryCompleted: [] };
  }, [progressDate, dailyLogs]);

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
        <Text style={styles.headerTitle}>History</Text>

        {weeks.map((week, weekIdx) => {
          const totals = getWeekTotals(week.dates);
          const weekLabel = weekIdx === 0
            ? 'This Week'
            : weekIdx === 1
              ? 'Last Week'
              : `${getMonthName(week.weekStart)} ${week.weekStart.getDate()}`;

          const reversedDates = [...week.dates].reverse();

          return (
            <View key={weekIdx} style={styles.weekSection}>
              <View style={styles.weekHeader}>
                <Text style={styles.weekLabel}>{weekLabel}</Text>
                <View style={styles.weekHeaderRight}>
                  {totals.sessions > 0 ? (
                    <View style={styles.weekTotals}>
                      <Text style={styles.weekTotalText}>
                        {formatTime(totals.totalTime)}
                      </Text>
                      <Text style={styles.weekTotalDivider}>{'\u00B7'}</Text>
                      <Text style={styles.weekTotalText}>
                        {totals.totalDistance.toFixed(1)} mi
                      </Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={styles.summaryBtn}
                    onPress={() => handleWeeklySummary(week.weekStart)}
                  >
                    <BarChart3 size={14} color={Colors.accent} />
                  </TouchableOpacity>
                </View>
              </View>

              <GlassCard>
                {reversedDates.map((date, dayIdx) => {
                  const key = formatDate(date);
                  const log = dailyLogs[key];
                  const hasWorkouts = log && log.workouts.length > 0;
                  const isToday = formatDate(date) === formatDate(new Date());

                  return (
                    <TouchableOpacity
                      key={dayIdx}
                      style={[
                        styles.dayRow,
                        dayIdx < 6 && styles.dayRowBorder,
                      ]}
                      onPress={() => handleDayPress(key)}
                      activeOpacity={0.6}
                    >
                      <View style={styles.dayLeft}>
                        <Text
                          style={[
                            styles.dayName,
                            isToday && styles.dayNameToday,
                          ]}
                        >
                          {getDayName(date)}
                        </Text>
                        <Text style={styles.dayDate}>{date.getDate()}</Text>
                      </View>
                      <View style={styles.dayRight}>
                        {hasWorkouts ? (
                          log.workouts.map((w) => {
                            const summary = getWorkoutSummary(w);
                            return (
                              <View key={w.id} style={styles.workoutBadge}>
                                <Text style={styles.workoutBadgeEmoji}>
                                  {getWorkoutEmoji(w.type)}
                                </Text>
                                <Text style={styles.workoutBadgeText}>
                                  {summary}
                                  {summary && w.time > 0 ? ' \u00B7 ' : ''}
                                  {w.time > 0 ? formatTime(w.time) : ''}
                                  {!summary && w.time <= 0 ? 'Logged' : ''}
                                </Text>
                              </View>
                            );
                          })
                        ) : (
                          <Text style={styles.restText}>Rest</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </GlassCard>
            </View>
          );
        })}

        <View style={{ height: 32 }} />
      </ScrollView>

      {activeGoalEvent && activeGoalEvent.distances.length > 0 && progressDayLog ? (
        <ProgressBottomSheet
          visible={progressDate !== null}
          onClose={() => setProgressDate(null)}
          goalEvent={activeGoalEvent}
          dayLog={progressDayLog}
          workoutConfigs={workoutConfigs}
          isToday={progressDate === formatDate(new Date())}
          dateLabel={progressDate ?? ''}
        />
      ) : progressDate !== null ? (
        <ProgressBottomSheet
          visible={true}
          onClose={() => setProgressDate(null)}
          goalEvent={{ type: '', distances: [] }}
          dayLog={progressDayLog ?? { date: progressDate, workouts: [], supplementsTaken: [], recoveryCompleted: [] }}
          workoutConfigs={workoutConfigs}
          isToday={false}
          dateLabel={progressDate}
        />
      ) : null}

      {summaryWeekDate ? (
        <WeeklySummaryModal
          visible={true}
          onClose={() => setSummaryWeekDate(null)}
          dailyLogs={dailyLogs}
          supplementsCount={supplements.length}
          recoveryOptions={recoveryOptions}
          initialDate={summaryWeekDate}
          workoutConfigs={workoutConfigs}
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
  headerTitle: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  weekSection: {
    marginBottom: 8,
  },
  weekHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  weekLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  weekHeaderRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  weekTotals: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  weekTotalText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  weekTotalDivider: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  summaryBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  dayRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 10,
  },
  dayRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  dayLeft: {
    width: 50,
    alignItems: 'center' as const,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },
  dayNameToday: {
    color: Colors.accent,
  },
  dayDate: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dayRight: {
    flex: 1,
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
    paddingLeft: 12,
  },
  workoutBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  workoutBadgeEmoji: {
    fontSize: 14,
  },
  workoutBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  restText: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontStyle: 'italic' as const,
  },
});
