import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import { Check, RotateCcw, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

interface CalendarPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (dateStr: string) => void;
  onReset?: () => void;
  currentDate?: string;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const SCROLL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function generateYears(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current - 10; y <= current + 10; y++) {
    years.push(y);
  }
  return years;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function generateDays(count: number): number[] {
  const days: number[] = [];
  for (let d = 1; d <= count; d++) {
    days.push(d);
  }
  return days;
}

function parseDateStr(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }
  return { year: y, month: m - 1, day: d };
}

interface WheelColumnProps {
  data: { label: string; value: number }[];
  selectedValue: number;
  onValueChange: (value: number) => void;
  width: number;
}

function WheelColumn({ data, selectedValue, onValueChange, width }: WheelColumnProps) {
  const scrollRef = useRef<ScrollView>(null);
  const isScrollingRef = useRef(false);
  const paddingItems = Math.floor(VISIBLE_ITEMS / 2);

  const selectedIndex = data.findIndex((item) => item.value === selectedValue);
  const initialOffset = selectedIndex >= 0 ? selectedIndex * ITEM_HEIGHT : 0;

  useEffect(() => {
    if (!isScrollingRef.current && scrollRef.current) {
      const idx = data.findIndex((item) => item.value === selectedValue);
      if (idx >= 0) {
        scrollRef.current.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
      }
    }
  }, [selectedValue, data]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        const idx = data.findIndex((item) => item.value === selectedValue);
        if (idx >= 0) {
          scrollRef.current.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      isScrollingRef.current = false;
      const offsetY = e.nativeEvent.contentOffset.y;
      let index = Math.round(offsetY / ITEM_HEIGHT);
      index = Math.max(0, Math.min(index, data.length - 1));

      const snappedOffset = index * ITEM_HEIGHT;
      if (Math.abs(offsetY - snappedOffset) > 1) {
        scrollRef.current?.scrollTo({ y: snappedOffset, animated: true });
      }

      const newValue = data[index]?.value;
      if (newValue !== undefined && newValue !== selectedValue) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onValueChange(newValue);
      }
    },
    [data, selectedValue, onValueChange],
  );

  const handleScrollBegin = useCallback(() => {
    isScrollingRef.current = true;
  }, []);

  const renderPadding = () => {
    const items = [];
    for (let i = 0; i < paddingItems; i++) {
      items.push(<View key={`pad-${i}`} style={{ height: ITEM_HEIGHT }} />);
    }
    return items;
  };

  return (
    <View style={[styles.wheelContainer, { width, height: SCROLL_HEIGHT }]}>
      <View style={styles.selectionHighlight} pointerEvents="none" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate={Platform.OS === 'web' ? 0.95 : 'fast'}
        contentOffset={{ x: 0, y: initialOffset }}
        onScrollBeginDrag={handleScrollBegin}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={(e) => {
          if (Platform.OS === 'web') {
            handleScrollEnd(e);
          }
        }}
        scrollEventThrottle={16}
        nestedScrollEnabled
      >
        {renderPadding()}
        {data.map((item, idx) => {
          const isSelected = item.value === selectedValue;
          return (
            <TouchableOpacity
              key={`${item.value}-${idx}`}
              style={styles.wheelItem}
              activeOpacity={0.7}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onValueChange(item.value);
                scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
              }}
            >
              <Text
                style={[
                  styles.wheelItemText,
                  isSelected && styles.wheelItemTextSelected,
                  !isSelected && styles.wheelItemTextDimmed,
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        {renderPadding()}
      </ScrollView>
    </View>
  );
}

export default function CalendarPickerModal({
  visible,
  onClose,
  onSelect,
  onReset,
  currentDate,
}: CalendarPickerModalProps) {
  const initial = currentDate ? parseDateStr(currentDate) : (() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  })();

  const [selectedYear, setSelectedYear] = useState(initial.year);
  const [selectedMonth, setSelectedMonth] = useState(initial.month);
  const [selectedDay, setSelectedDay] = useState(initial.day);

  const years = React.useMemo(() => generateYears(), []);

  useEffect(() => {
    if (visible) {
      const d = currentDate ? parseDateStr(currentDate) : (() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
      })();
      setSelectedYear(d.year);
      setSelectedMonth(d.month);
      setSelectedDay(d.day);
    }
  }, [visible, currentDate]);

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);

  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [selectedYear, selectedMonth, daysInMonth, selectedDay]);

  const yearData = React.useMemo(
    () => years.map((y) => ({ label: String(y), value: y })),
    [years],
  );

  const monthData = React.useMemo(
    () => MONTHS.map((m, i) => ({ label: m, value: i })),
    [],
  );

  const dayData = React.useMemo(
    () => generateDays(daysInMonth).map((d) => ({ label: String(d).padStart(2, '0'), value: d })),
    [daysInMonth],
  );

  const handleConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    onSelect(dateStr);
    onClose();
  }, [selectedYear, selectedMonth, selectedDay, onSelect, onClose]);

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onReset?.();
    onClose();
  }, [onReset, onClose]);

  const formattedPreview = `${MONTHS[selectedMonth]} ${selectedDay}, ${selectedYear}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Date</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.previewDate}>{formattedPreview}</Text>

          <View style={styles.wheelsRow}>
            <WheelColumn
              data={monthData}
              selectedValue={selectedMonth}
              onValueChange={setSelectedMonth}
              width={140}
            />
            <WheelColumn
              data={dayData}
              selectedValue={selectedDay}
              onValueChange={setSelectedDay}
              width={70}
            />
            <WheelColumn
              data={yearData}
              selectedValue={selectedYear}
              onValueChange={setSelectedYear}
              width={90}
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Check size={18} color="#FFFFFF" />
              <Text style={styles.confirmBtnText}>Confirm</Text>
            </TouchableOpacity>

            {onReset && (
              <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                <RotateCcw size={14} color={Colors.textSecondary} />
                <Text style={styles.resetBtnText}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>
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
    padding: 20,
    width: '90%',
    maxWidth: 380,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  previewDate: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.accent,
    textAlign: 'center' as const,
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  wheelsRow: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginBottom: 20,
  },
  wheelContainer: {
    overflow: 'hidden' as const,
    borderRadius: 12,
  },
  selectionHighlight: {
    position: 'absolute' as const,
    top: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
    left: 4,
    right: 4,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(94, 159, 255, 0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(94, 159, 255, 0.25)',
    zIndex: 1,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  wheelItemText: {
    fontSize: 18,
    fontWeight: '500' as const,
    color: Colors.textPrimary,
  },
  wheelItemTextSelected: {
    fontWeight: '700' as const,
    color: '#FFFFFF',
    fontSize: 20,
  },
  wheelItemTextDimmed: {
    color: Colors.textTertiary,
    fontSize: 16,
  },
  actions: {
    gap: 10,
    alignItems: 'center' as const,
  },
  confirmBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    width: '100%',
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  resetBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 8,
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
});
