import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
  TextInput,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

interface TimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSet: (totalSeconds: number) => void;
  initialSeconds?: number;
}

export default function TimePickerModal({ visible, onClose, onSet, initialSeconds = 0 }: TimePickerModalProps) {
  const [hoursStr, setHoursStr] = useState('00');
  const [minutesStr, setMinutesStr] = useState('00');
  const [secondsStr, setSecondsStr] = useState('00');

  const minRef = useRef<TextInput | null>(null);
  const secRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (visible) {
      const h = Math.floor(initialSeconds / 3600);
      const m = Math.floor((initialSeconds % 3600) / 60);
      const s = initialSeconds % 60;
      setHoursStr(String(h).padStart(2, '0'));
      setMinutesStr(String(m).padStart(2, '0'));
      setSecondsStr(String(s).padStart(2, '0'));
    }
  }, [visible, initialSeconds]);

  const parseVal = (str: string, max: number): number => {
    const num = parseInt(str, 10);
    if (isNaN(num) || num < 0) return 0;
    if (num > max) return max;
    return num;
  };

  const formatVal = (str: string, max: number): string => {
    const num = parseVal(str, max);
    return String(num).padStart(2, '0');
  };

  const adjust = (
    currentStr: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    delta: number,
    max: number
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const current = parseVal(currentStr, max);
    let next = current + delta;
    if (next < 0) next = max;
    if (next > max) next = 0;
    setter(String(next).padStart(2, '0'));
  };

  const handleSet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const h = parseVal(hoursStr, 23);
    const m = parseVal(minutesStr, 59);
    const s = parseVal(secondsStr, 59);
    const total = h * 3600 + m * 60 + s;
    onSet(total);
    onClose();
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSet(0);
    onClose();
  };

  const handleBlur = (
    str: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    max: number
  ) => {
    setter(formatVal(str, max));
  };

  const renderColumn = (
    label: string,
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    max: number,
    ref?: React.RefObject<TextInput | null>,
    nextRef?: React.RefObject<TextInput | null>
  ) => (
    <View style={styles.column}>
      <Text style={styles.columnLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.adjustBtn}
        onPress={() => adjust(value, setter, 1, max)}
        testID={`time-${label}-up`}
      >
        <Text style={styles.adjustText}>+</Text>
      </TouchableOpacity>
      <TextInput
        ref={ref}
        style={styles.valueInput}
        value={value}
        onChangeText={(text) => {
          const cleaned = text.replace(/[^0-9]/g, '');
          if (cleaned.length <= 2) {
            setter(cleaned);
          }
        }}
        onBlur={() => handleBlur(value, setter, max)}
        onSubmitEditing={() => {
          handleBlur(value, setter, max);
          nextRef?.current?.focus();
        }}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
        returnKeyType={nextRef ? 'next' : 'done'}
        testID={`time-${label}-input`}
      />
      <TouchableOpacity
        style={styles.adjustBtn}
        onPress={() => adjust(value, setter, -1, max)}
        testID={`time-${label}-down`}
      >
        <Text style={styles.adjustText}>{'\u2212'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Set Time</Text>

          <View style={styles.pickerRow}>
            {renderColumn('HRS', hoursStr, setHoursStr, 23, undefined, minRef)}
            <Text style={styles.separator}>:</Text>
            {renderColumn('MIN', minutesStr, setMinutesStr, 59, minRef, secRef)}
            <Text style={styles.separator}>:</Text>
            {renderColumn('SEC', secondsStr, setSecondsStr, 59, secRef)}
          </View>

          <TouchableOpacity style={styles.setBtn} onPress={handleSet} testID="time-set-btn">
            <Text style={styles.setBtnText}>Set Time {'\u2713'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
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
    padding: 28,
    width: '85%',
    maxWidth: 340,
    alignItems: 'center' as const,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    marginBottom: 24,
  },
  pickerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 28,
  },
  column: {
    alignItems: 'center' as const,
  },
  columnLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    marginBottom: 8,
    letterSpacing: 1,
  },
  adjustBtn: {
    width: 48,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.inputBackground,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  adjustText: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  valueInput: {
    width: 64,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginVertical: 6,
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    textAlign: 'center' as const,
    fontVariant: ['tabular-nums'] as const,
  },
  separator: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    marginHorizontal: 6,
    marginTop: 20,
  },
  setBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center' as const,
    marginBottom: 10,
  },
  setBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  clearBtn: {
    paddingVertical: 10,
  },
  clearBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
});
