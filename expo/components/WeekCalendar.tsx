import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { getWeekDates, getDayName, isSameDay, isToday, formatDate, getWeekStartDate, formatShortDate } from '@/utils/dateUtils';
import { useTraining } from '@/providers/TrainingProvider';

interface WeekCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export default React.memo(function WeekCalendar({ selectedDate, onSelectDate }: WeekCalendarProps) {
  const { dailyLogs } = useTraining();
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

  const isCurrentWeek = useMemo(() => {
    const todayWeekStart = getWeekStartDate(new Date());
    const selectedWeekStart = getWeekStartDate(selectedDate);
    return todayWeekStart.getTime() === selectedWeekStart.getTime();
  }, [selectedDate]);

  const weekLabel = useMemo(() => {
    if (isCurrentWeek) return null;
    const start = weekDates[0];
    return `Week of ${formatShortDate(start)}`;
  }, [isCurrentWeek, weekDates]);

  const handleSelect = useCallback((date: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectDate(date);
  }, [onSelectDate]);

  const handlePrevWeek = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prev = new Date(selectedDate);
    prev.setDate(selectedDate.getDate() - 7);
    onSelectDate(prev);
  }, [selectedDate, onSelectDate]);

  const handleNextWeek = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = new Date(selectedDate);
    next.setDate(selectedDate.getDate() + 7);
    onSelectDate(next);
  }, [selectedDate, onSelectDate]);

  const handleBackToToday = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelectDate(new Date());
  }, [onSelectDate]);

  return (
    <View style={styles.container}>
      {weekLabel ? (
        <View style={styles.weekLabelRow}>
          <Text style={styles.weekLabelText}>{weekLabel}</Text>
          <TouchableOpacity onPress={handleBackToToday} style={styles.todayBtn}>
            <Text style={styles.todayBtnText}>Today</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.navRow}>
        <TouchableOpacity onPress={handlePrevWeek} style={styles.navBtn} testID="week-prev">
          <ChevronLeft size={20} color={Colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.row}>
          {weekDates.map((date, index) => {
            const selected = isSameDay(date, selectedDate);
            const today = isToday(date);
            const dateKey = formatDate(date);
            const hasWorkouts = dailyLogs[dateKey]?.workouts?.length > 0;

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCell,
                  selected && styles.selectedCell,
                  today && !selected && styles.todayCell,
                ]}
                onPress={() => handleSelect(date)}
                activeOpacity={0.7}
                testID={`week-day-${index}`}
              >
                <Text style={[styles.dayName, selected && styles.selectedText]}>
                  {getDayName(date)}
                </Text>
                <Text style={[
                  styles.dayNumber,
                  selected && styles.selectedText,
                  today && !selected && styles.todayText,
                ]}>
                  {date.getDate()}
                </Text>
                {hasWorkouts ? <View style={[styles.dot, selected ? styles.dotSelected : undefined]} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity onPress={handleNextWeek} style={styles.navBtn} testID="week-next">
          <ChevronRight size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  weekLabelRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  weekLabelText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  todayBtn: {
    backgroundColor: Colors.accent + '20',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  navRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  navBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  row: {
    flex: 1,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },
  dayCell: {
    alignItems: 'center' as const,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    minWidth: 38,
  },
  selectedCell: {
    backgroundColor: Colors.accent,
  },
  todayCell: {
    borderWidth: 1.5,
    borderColor: Colors.accent + '50',
  },
  dayName: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  dayNumber: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  selectedText: {
    color: '#FFFFFF',
  },
  todayText: {
    color: Colors.accent,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent,
    marginTop: 4,
  },
  dotSelected: {
    backgroundColor: '#FFFFFF',
  },
});
