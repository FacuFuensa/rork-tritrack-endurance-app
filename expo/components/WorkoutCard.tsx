import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  UIManager,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Clock, Trash2, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Workout, WorkoutConfig } from '@/constants/types';
import { formatTime } from '@/utils/dateUtils';
import { generateWorkoutId } from '@/utils/calculations';
import TimePickerModal from './TimePickerModal';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const STANDARD_KEYS = ['distance', 'time', 'laps', 'elevation', 'avgSpeed'];

interface WorkoutCardProps {
  config: WorkoutConfig;
  workout?: Workout;
  onSave: (workout: Workout) => void;
  onDelete?: (workoutId: string) => void;
}

function getFieldLabel(fieldKey: string, config: WorkoutConfig): string {
  if (config.fieldLabels?.[fieldKey]) return config.fieldLabels[fieldKey];
  switch (fieldKey) {
    case 'distance': {
      const unit = config.distanceUnit === 'km' ? 'km'
        : config.distanceUnit === 'meters' ? 'm'
        : config.distanceUnit === 'yards' ? 'yd'
        : 'mi';
      return `Distance (${unit})`;
    }
    case 'laps': return 'Laps';
    case 'elevation': return 'Elevation (ft)';
    case 'avgSpeed': {
      const speedUnit = config.distanceUnit === 'km' ? 'km/h'
        : config.distanceUnit === 'miles' ? 'mph'
        : config.distanceUnit === 'meters' ? 'm/s'
        : 'yd/s';
      return `Avg Speed (${speedUnit})`;
    }
    default:
      return fieldKey.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
  }
}

function getStandardValue(workout: Workout | undefined, key: string): string {
  if (!workout) return '';
  switch (key) {
    case 'distance': return workout.distance > 0 ? workout.distance.toString() : '';
    case 'laps': return workout.laps ? workout.laps.toString() : '';
    case 'elevation': return workout.elevation ? workout.elevation.toString() : '';
    case 'avgSpeed': return workout.avgSpeed ? workout.avgSpeed.toString() : '';
    default: return '';
  }
}

export default React.memo(function WorkoutCard({ config, workout, onSave, onDelete }: WorkoutCardProps) {
  const [showEditor, setShowEditor] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [distance, setDistance] = useState(getStandardValue(workout, 'distance'));
  const [laps, setLaps] = useState(getStandardValue(workout, 'laps'));
  const [elevation, setElevation] = useState(getStandardValue(workout, 'elevation'));
  const [avgSpeed, setAvgSpeed] = useState(getStandardValue(workout, 'avgSpeed'));
  const [time, setTime] = useState(workout?.time ?? 0);

  const [customValues, setCustomValues] = useState<Record<string, string>>(() => {
    const cv: Record<string, string> = {};
    if (workout?.customValues) {
      for (const [k, v] of Object.entries(workout.customValues)) {
        cv[k] = v > 0 ? v.toString() : '';
      }
    }
    return cv;
  });

  const workoutIdRef = useRef(workout?.id ?? generateWorkoutId());

  useEffect(() => {
    if (workout) {
      setDistance(getStandardValue(workout, 'distance'));
      setLaps(getStandardValue(workout, 'laps'));
      setElevation(getStandardValue(workout, 'elevation'));
      setAvgSpeed(getStandardValue(workout, 'avgSpeed'));
      setTime(workout.time);
      workoutIdRef.current = workout.id;

      if (workout.customValues) {
        const cv: Record<string, string> = {};
        for (const [k, v] of Object.entries(workout.customValues)) {
          cv[k] = v > 0 ? v.toString() : '';
        }
        setCustomValues(cv);
      } else {
        setCustomValues({});
      }
    } else {
      setDistance('');
      setLaps('');
      setElevation('');
      setAvgSpeed('');
      setTime(0);
      setCustomValues({});
      workoutIdRef.current = generateWorkoutId();
    }
  }, [workout]);

  const getKeyboardType = useCallback((key: string): 'number-pad' | 'decimal-pad' => {
    if (key === 'distance' || key === 'elevation' || key === 'avgSpeed') return 'decimal-pad';
    return 'number-pad';
  }, []);

  const doSave = useCallback((overrides?: {
    dist?: number;
    t?: number;
    l?: number;
    elev?: number;
    spd?: number;
    cv?: Record<string, number>;
  }) => {
    const dist = overrides?.dist ?? (parseFloat(distance) || 0);
    const t = overrides?.t ?? time;
    const l = overrides?.l ?? (parseInt(laps) || undefined);
    const elev = overrides?.elev ?? (parseFloat(elevation) || undefined);
    const spd = overrides?.spd ?? (parseFloat(avgSpeed) || undefined);

    const cvObj: Record<string, number> = {};
    for (const [k, v] of Object.entries(customValues)) {
      const num = parseFloat(v) || 0;
      if (num > 0) cvObj[k] = num;
    }
    if (overrides?.cv) {
      for (const [k, v] of Object.entries(overrides.cv)) {
        if (v > 0) cvObj[k] = v;
        else delete cvObj[k];
      }
    }

    const hasAnyValue = dist > 0 || t > 0 || Object.values(cvObj).some((v) => v > 0);
    if (!hasAnyValue) return;

    const w: Workout = {
      id: workoutIdRef.current,
      type: config.id,
      distance: dist,
      time: t,
      laps: l,
      elevation: elev,
      avgSpeed: spd,
      customValues: Object.keys(cvObj).length > 0 ? cvObj : undefined,
    };
    console.log(`[WorkoutCard] Saving ${config.name} workout:`, w);
    onSave(w);
  }, [distance, time, laps, elevation, avgSpeed, customValues, config.id, config.name, onSave]);

  const handleOpenEditor = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowEditor(true);
  };

  const handleSaveAndClose = () => {
    doSave();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowEditor(false);
  };

  const handleTimeSet = (totalSeconds: number) => {
    setTime(totalSeconds);
  };

  const handleStandardChange = useCallback((key: string, val: string) => {
    switch (key) {
      case 'distance': setDistance(val); break;
      case 'laps': setLaps(val); break;
      case 'elevation': setElevation(val); break;
      case 'avgSpeed': setAvgSpeed(val); break;
    }
  }, []);

  const handleCustomChange = useCallback((key: string, val: string) => {
    setCustomValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const getFieldValue = useCallback((key: string): string => {
    switch (key) {
      case 'distance': return distance;
      case 'laps': return laps;
      case 'elevation': return elevation;
      case 'avgSpeed': return avgSpeed;
      default: return customValues[key] ?? '';
    }
  }, [distance, laps, elevation, avgSpeed, customValues]);

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowEditor(false);
    setDistance('');
    setLaps('');
    setElevation('');
    setAvgSpeed('');
    setTime(0);
    setCustomValues({});
    if (onDelete && workout) {
      onDelete(workout.id);
    }
    workoutIdRef.current = generateWorkoutId();
  };

  const hasData = useMemo(() => {
    return (parseFloat(distance) || 0) > 0
      || time > 0
      || Object.values(customValues).some((v) => parseFloat(v) > 0);
  }, [distance, time, customValues]);

  const summaryText = useMemo(() => {
    const parts: string[] = [];
    for (const field of config.fields) {
      if (field === 'time') {
        if (time > 0) parts.push(formatTime(time));
      } else if (STANDARD_KEYS.includes(field)) {
        const val = getFieldValue(field);
        if (val && parseFloat(val) > 0) {
          if (field === 'distance') {
            const unit = config.distanceUnit === 'km' ? 'km'
              : config.distanceUnit === 'meters' ? 'm'
              : config.distanceUnit === 'yards' ? 'yd' : 'mi';
            parts.push(`${val} ${unit}`);
          } else {
            const label = getFieldLabel(field, config);
            const shortLabel = label.replace(/\s*\(.*\)/, '');
            parts.push(`${val} ${shortLabel.toLowerCase()}`);
          }
        }
      } else {
        const val = customValues[field];
        if (val && parseFloat(val) > 0) {
          const label = config.fieldLabels?.[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
          parts.push(`${val} ${label}`);
        }
      }
    }
    return parts.slice(0, 3).join(' · ');
  }, [config, time, customValues, getFieldValue]);

  const renderField = useCallback((field: string) => {
    if (field === 'time') {
      return (
        <TouchableOpacity
          key="time"
          style={styles.timeRow}
          onPress={() => setShowTimePicker(true)}
          testID={`${config.id}-time-btn`}
        >
          <View style={styles.timeLeft}>
            <Clock size={16} color={Colors.textSecondary} />
            <Text style={styles.inputLabel}>Time</Text>
          </View>
          <Text style={styles.timeValue}>{time > 0 ? formatTime(time) : 'Set time'}</Text>
        </TouchableOpacity>
      );
    }

    const isStandard = STANDARD_KEYS.includes(field);
    const value = isStandard ? getFieldValue(field) : (customValues[field] ?? '');
    const label = getFieldLabel(field, config);
    const kbType = getKeyboardType(field);

    return (
      <View key={field} style={styles.inputRow}>
        <Text style={styles.inputLabel}>{label}</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(val) => {
            if (isStandard) {
              handleStandardChange(field, val);
            } else {
              handleCustomChange(field, val);
            }
          }}
          keyboardType={kbType}
          placeholder="0"
          placeholderTextColor={Colors.textTertiary}
          testID={`${config.id}-${field}-input`}
        />
      </View>
    );
  }, [config, time, customValues, getFieldValue, getKeyboardType, handleStandardChange, handleCustomChange]);

  return (
    <>
      <TouchableOpacity
        style={[styles.card, { borderColor: config.color + '30' }]}
        onPress={handleOpenEditor}
        activeOpacity={0.7}
        testID={`workout-card-${config.id}`}
      >
        <View style={[styles.glowBg, { backgroundColor: config.darkColor }]} />
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.emoji}>{config.emoji}</Text>
            <View>
              <Text style={[styles.label, { color: config.color }]}>{config.name}</Text>
              {hasData ? (
                <Text style={styles.summary}>{summaryText}</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.headerRight}>
            {hasData ? <View style={[styles.loggedBadge, { backgroundColor: config.color + '20' }]}>
              <Text style={[styles.loggedText, { color: config.color }]}>Logged</Text>
            </View> : null}
          </View>
        </View>
      </TouchableOpacity>

      <Modal visible={showEditor} transparent animationType="fade" onRequestClose={() => setShowEditor(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowEditor(false)}>
          <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <Text style={styles.modalEmoji}>{config.emoji}</Text>
                  <Text style={[styles.modalTitle, { color: config.color }]}>{config.name}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowEditor(false)} style={styles.modalCloseBtn}>
                  <X size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                {config.fields.map(renderField)}
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: config.color }]} onPress={handleSaveAndClose}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>

                {hasData ? (
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                    <Trash2 size={16} color={Colors.danger} />
                    <Text style={styles.deleteText}>Delete Workout</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>

        <TimePickerModal
          visible={showTimePicker}
          onClose={() => setShowTimePicker(false)}
          onSet={handleTimeSet}
          initialSeconds={time}
        />
      </Modal>
    </>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 20,
    marginBottom: 10,
    overflow: 'hidden' as const,
  },
  glowBg: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: 16,
  },
  headerLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    flex: 1,
  },
  emoji: {
    fontSize: 28,
  },
  label: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  summary: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  loggedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  loggedText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 20,
  },
  modalHeaderLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  modalEmoji: {
    fontSize: 28,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  modalBody: {
    gap: 12,
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  inputLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 100,
    textAlign: 'right' as const,
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  timeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  timeLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  modalFooter: {
    gap: 10,
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center' as const,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  deleteBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,82,82,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,82,82,0.2)',
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.danger,
  },
});
