import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { X, Plus, Trash2, Check, ChevronRight, Eye, EyeOff } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { WorkoutConfig, DistanceUnit } from '@/constants/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DISTANCE_UNITS: { label: string; short: string; value: DistanceUnit }[] = [
  { label: 'Meters', short: 'm', value: 'meters' },
  { label: 'Kilometers', short: 'km', value: 'km' },
  { label: 'Yards', short: 'yd', value: 'yards' },
  { label: 'Miles', short: 'mi', value: 'miles' },
];

const COMMON_STATS: { key: string; label: string }[] = [
  { key: 'distance', label: 'Distance' },
  { key: 'time', label: 'Time' },
  { key: 'laps', label: 'Laps' },
  { key: 'elevation', label: 'Elevation' },
  { key: 'avgSpeed', label: 'Avg Speed' },
  { key: 'calories', label: 'Calories' },
  { key: 'sets', label: 'Sets' },
  { key: 'reps', label: 'Reps' },
  { key: 'exercises', label: 'Exercises' },
  { key: 'rounds', label: 'Rounds' },
  { key: 'points', label: 'Points' },
  { key: 'goals', label: 'Goals' },
  { key: 'assists', label: 'Assists' },
  { key: 'shots', label: 'Shots' },
  { key: 'rebounds', label: 'Rebounds' },
  { key: 'aces', label: 'Aces' },
  { key: 'blocks', label: 'Blocks' },
  { key: 'setsWon', label: 'Sets Won' },
  { key: 'gamesWon', label: 'Games Won' },
  { key: 'score', label: 'Score' },
  { key: 'holes', label: 'Holes' },
  { key: 'putts', label: 'Putts' },
  { key: 'waves', label: 'Waves' },
  { key: 'routes', label: 'Routes' },
  { key: 'runs', label: 'Runs' },
  { key: 'strikes', label: 'Strikes' },
  { key: 'spares', label: 'Spares' },
  { key: 'games', label: 'Games' },
  { key: 'strokes', label: 'Strokes' },
  { key: 'atBats', label: 'At Bats' },
  { key: 'hits', label: 'Hits' },
  { key: 'rbis', label: 'RBIs' },
];

interface EditWorkoutModalProps {
  visible: boolean;
  onClose: () => void;
  config: WorkoutConfig | null;
  onSave: (configId: string, updates: Partial<WorkoutConfig>) => void;
}

export default React.memo(function EditWorkoutModal({
  visible,
  onClose,
  config,
  onSave,
}: EditWorkoutModalProps) {
  const [fields, setFields] = useState<string[]>([]);
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({});
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('miles');
  const [showInSummaries, setShowInSummaries] = useState(true);
  const [customStatName, setCustomStatName] = useState('');
  const [showAddStat, setShowAddStat] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  const hasDistance = fields.includes('distance');

  useEffect(() => {
    if (visible && config) {
      setFields([...config.fields]);
      setFieldLabels({ ...(config.fieldLabels ?? {}) });
      setDistanceUnit(config.distanceUnit);
      setShowInSummaries(config.showInSummaries !== false);
      setShowAddStat(false);
      setCustomStatName('');
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, config]);

  const handleClose = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onClose());
  }, [fadeAnim, onClose]);

  const handleSave = useCallback(() => {
    if (!config) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updates: Partial<WorkoutConfig> = {
      fields,
      fieldLabels,
      distanceUnit,
      showInSummaries,
    };
    onSave(config.id, updates);
    handleClose();
  }, [config, fields, fieldLabels, distanceUnit, showInSummaries, onSave, handleClose]);

  const removeField = useCallback((field: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFields((prev) => prev.filter((f) => f !== field));
    setFieldLabels((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const addField = useCallback((key: string, label: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFields((prev) => {
      if (prev.includes(key)) return prev;
      return [...prev, key];
    });
    if (label && !['distance', 'time', 'laps', 'elevation', 'avgSpeed'].includes(key)) {
      setFieldLabels((prev) => ({ ...prev, [key]: label }));
    }
  }, []);

  const addCustomStat = useCallback(() => {
    const name = customStatName.trim();
    if (!name) return;
    const key = name.toLowerCase().replace(/\s+/g, '');
    addField(key, name);
    setCustomStatName('');
    setShowAddStat(false);
  }, [customStatName, addField]);

  const getFieldDisplayLabel = useCallback((key: string): string => {
    if (fieldLabels[key]) return fieldLabels[key];
    const common = COMMON_STATS.find((s) => s.key === key);
    if (common) return common.label;
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
  }, [fieldLabels]);

  const availableStats = COMMON_STATS.filter((s) => !fields.includes(s.key));

  if (!config) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.backdrop} onPress={handleClose} activeOpacity={1} />
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [40, 0],
                }),
              }],
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.headerInfo}>
              <Text style={styles.headerEmoji}>{config.emoji}</Text>
              <Text style={styles.headerTitle}>{config.name}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {hasDistance && (
              <>
                <Text style={styles.sectionLabel}>DISTANCE UNIT</Text>
                <View style={styles.unitRow}>
                  {DISTANCE_UNITS.map((u) => (
                    <TouchableOpacity
                      key={u.value}
                      style={[
                        styles.unitChip,
                        distanceUnit === u.value && { backgroundColor: config.color + '25', borderColor: config.color },
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setDistanceUnit(u.value);
                      }}
                    >
                      <Text style={[
                        styles.unitChipShort,
                        distanceUnit === u.value && { color: config.color },
                      ]}>
                        {u.short}
                      </Text>
                      <Text style={[
                        styles.unitChipLabel,
                        distanceUnit === u.value && { color: config.color },
                      ]}>
                        {u.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {distanceUnit !== config.distanceUnit && (
                  <View style={styles.conversionNote}>
                    <Text style={styles.conversionText}>
                      Past logged data will be auto-converted from {config.distanceUnit} to {distanceUnit}
                    </Text>
                  </View>
                )}
              </>
            )}

            <Text style={styles.sectionLabel}>CURRENT STATS</Text>
            <View style={styles.currentFieldsList}>
              {fields.map((field) => (
                <View key={field} style={styles.fieldRow}>
                  <View style={styles.fieldInfo}>
                    <View style={[styles.fieldDot, { backgroundColor: config.color }]} />
                    <Text style={styles.fieldName}>{getFieldDisplayLabel(field)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.fieldRemoveBtn}
                    onPress={() => removeField(field)}
                  >
                    <Trash2 size={14} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              {fields.length === 0 && (
                <Text style={styles.emptyText}>No stats configured</Text>
              )}
            </View>

            <Text style={styles.sectionLabel}>ADD STAT</Text>
            <View style={styles.addStatsGrid}>
              {availableStats.slice(0, 12).map((stat) => (
                <TouchableOpacity
                  key={stat.key}
                  style={styles.addStatChip}
                  onPress={() => addField(stat.key, stat.label)}
                >
                  <Plus size={12} color={config.color} />
                  <Text style={[styles.addStatChipText, { color: config.color }]}>{stat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.summaryToggleRow}>
              <View style={styles.summaryToggleLeft}>
                {showInSummaries ? (
                  <Eye size={16} color={Colors.accent} />
                ) : (
                  <EyeOff size={16} color={Colors.textTertiary} />
                )}
                <View>
                  <Text style={styles.summaryToggleLabel}>Show in summaries</Text>
                  <Text style={styles.summaryToggleSub}>Weekly Summary & Profile stats</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.summaryToggleBtn,
                  showInSummaries && styles.summaryToggleBtnActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowInSummaries(!showInSummaries);
                }}
              >
                <View
                  style={[
                    styles.summaryToggleThumb,
                    showInSummaries && styles.summaryToggleThumbActive,
                  ]}
                />
              </TouchableOpacity>
            </View>

            {!showAddStat ? (
              <TouchableOpacity
                style={styles.customStatBtn}
                onPress={() => setShowAddStat(true)}
              >
                <Plus size={14} color={Colors.textSecondary} />
                <Text style={styles.customStatBtnText}>Custom Stat</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.customStatRow}>
                <TextInput
                  style={styles.customStatInput}
                  value={customStatName}
                  onChangeText={setCustomStatName}
                  placeholder="Stat name (e.g. Sprints)"
                  placeholderTextColor={Colors.textTertiary}
                  autoFocus
                  onSubmitEditing={addCustomStat}
                />
                <TouchableOpacity
                  style={[styles.customStatAdd, { backgroundColor: config.color + '20' }]}
                  onPress={addCustomStat}
                >
                  <Plus size={16} color={config.color} />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: config.color }]}
              onPress={handleSave}
            >
              <Check size={18} color="#fff" />
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backdrop: {
    flex: 1,
  },
  container: {
    backgroundColor: Colors.backgroundLight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '50%',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderBottomWidth: 0,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textTertiary,
    alignSelf: 'center' as const,
    marginTop: 10,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  headerInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  headerEmoji: {
    fontSize: 26,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 16,
  },
  unitRow: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  unitChip: {
    flex: 1,
    alignItems: 'center' as const,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.inputBackground,
  },
  unitChipShort: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Colors.textTertiary,
    marginBottom: 2,
  },
  unitChipLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
  },
  conversionNote: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,183,77,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,183,77,0.2)',
  },
  conversionText: {
    fontSize: 12,
    color: Colors.warning,
    fontWeight: '500' as const,
  },
  currentFieldsList: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden' as const,
  },
  fieldRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  fieldInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  fieldDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  fieldName: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.textPrimary,
  },
  fieldRemoveBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255,82,82,0.08)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center' as const,
    paddingVertical: 16,
  },
  addStatsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  addStatChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.inputBackground,
  },
  addStatChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  customStatBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed' as const,
  },
  customStatBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  customStatRow: {
    flexDirection: 'row' as const,
    gap: 8,
    marginTop: 14,
  },
  customStatInput: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  summaryToggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  summaryToggleLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    flex: 1,
  },
  summaryToggleLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  summaryToggleSub: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  summaryToggleBtn: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.inputBackground,
    justifyContent: 'center' as const,
    paddingHorizontal: 3,
  },
  summaryToggleBtnActive: {
    backgroundColor: Colors.accent + '40',
  },
  summaryToggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.textTertiary,
  },
  summaryToggleThumbActive: {
    backgroundColor: Colors.accent,
    alignSelf: 'flex-end' as const,
  },
  customStatAdd: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  footer: {
    flexDirection: 'row' as const,
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
