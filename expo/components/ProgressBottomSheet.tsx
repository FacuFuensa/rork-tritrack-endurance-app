import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Target, Clock, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { GoalEvent, GoalEventDistance, DailyLog, WorkoutConfig } from '@/constants/types';
import { convertDistance } from '@/utils/calculations';
import { formatTime } from '@/utils/dateUtils';

interface ProgressBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  goalEvent: GoalEvent;
  dayLog: DailyLog;
  workoutConfigs: WorkoutConfig[];
  isToday?: boolean;
  dateLabel?: string;
}

interface DisciplineProgress {
  discipline: string;
  logged: number;
  goal: number;
  unit: string;
  percent: number;
  projectedFinishTime: number | null;
}

function unitShort(u: string): string {
  switch (u) {
    case 'meters': return 'm';
    case 'km': return 'km';
    case 'yards': return 'yd';
    case 'miles': return 'mi';
    default: return u;
  }
}

export default function ProgressBottomSheet({
  visible,
  onClose,
  goalEvent,
  dayLog,
  workoutConfigs,
  isToday = true,
  dateLabel,
}: ProgressBottomSheetProps) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const screenHeight = Dimensions.get('window').height;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, slideAnim]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  const progress = useMemo((): DisciplineProgress[] => {
    return goalEvent.distances.map((gd: GoalEventDistance) => {
      const config = workoutConfigs.find((c) => c.id === gd.discipline);
      const dayWorkouts = dayLog.workouts.filter((w) => w.type === gd.discipline);

      let loggedInGoalUnit = 0;
      let totalTime = 0;

      for (const w of dayWorkouts) {
        if (config && config.fields.includes('distance')) {
          loggedInGoalUnit += convertDistance(w.distance, config.distanceUnit, gd.unit);
        }
        totalTime += w.time;
      }

      const percent = gd.distance > 0 ? Math.min((loggedInGoalUnit / gd.distance) * 100, 100) : 0;

      let projectedFinishTime: number | null = null;
      if (loggedInGoalUnit > 0 && totalTime > 0 && gd.distance > 0) {
        const pace = totalTime / loggedInGoalUnit;
        projectedFinishTime = Math.round(pace * gd.distance);
      }

      return {
        discipline: gd.discipline,
        logged: Math.round(loggedInGoalUnit * 100) / 100,
        goal: gd.distance,
        unit: unitShort(gd.unit),
        percent: Math.round(percent * 10) / 10,
        projectedFinishTime,
      };
    });
  }, [goalEvent, dayLog, workoutConfigs]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenHeight * 0.5, 0],
  });

  const getEmojiForDiscipline = (discipline: string): string => {
    const config = workoutConfigs.find((c) => c.id === discipline);
    return config?.emoji ?? '🏋️';
  };

  const getColorForDiscipline = (discipline: string): string => {
    const config = workoutConfigs.find((c) => c.id === discipline);
    return config?.color ?? Colors.accent;
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY }] },
          ]}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.handle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleRow}>
                <Target size={20} color={Colors.accent} />
                <Text style={styles.sheetTitle}>{isToday ? "Today's" : (dateLabel ?? '')} Race Progress</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
                <X size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {progress.map((p) => {
              const color = getColorForDiscipline(p.discipline);
              return (
                <View key={p.discipline} style={styles.disciplineRow}>
                  <View style={styles.disciplineTop}>
                    <Text style={styles.disciplineEmoji}>
                      {getEmojiForDiscipline(p.discipline)}
                    </Text>
                    <Text style={[styles.disciplineName, { color }]}>
                      {p.discipline.charAt(0).toUpperCase() + p.discipline.slice(1)}
                    </Text>
                    <Text style={styles.disciplineValues}>
                      {p.logged} / {p.goal} {p.unit}
                    </Text>
                  </View>

                  <View style={styles.barBg}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          backgroundColor: color,
                          width: `${Math.min(p.percent, 100)}%` as `${number}%`,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.disciplineBottom}>
                    <Text style={styles.percentText}>{p.percent}%</Text>
                    {p.projectedFinishTime !== null && (
                      <View style={styles.projectedRow}>
                        <Clock size={12} color={Colors.textTertiary} />
                        <Text style={styles.projectedText}>
                          Projected: {formatTime(p.projectedFinishTime)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            <TouchableOpacity style={styles.doneBtn} onPress={handleClose}>
              <Text style={styles.doneBtnText}>Got it 💪</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.backgroundLight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textTertiary,
    alignSelf: 'center' as const,
    marginTop: 12,
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  sheetTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  disciplineRow: {
    marginBottom: 18,
  },
  disciplineTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 8,
  },
  disciplineEmoji: {
    fontSize: 18,
  },
  disciplineName: {
    fontSize: 15,
    fontWeight: '700' as const,
    flex: 1,
  },
  disciplineValues: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  barBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.backgroundCard,
    overflow: 'hidden' as const,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  disciplineBottom: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginTop: 6,
  },
  percentText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
  },
  projectedRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  projectedText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
  },
  doneBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center' as const,
    marginTop: 4,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
