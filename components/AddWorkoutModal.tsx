import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { WorkoutConfig, DistanceUnit } from '@/constants/types';
import { PRESET_WORKOUTS, WORKOUT_COLORS, SPORT_FIELD_CONFIGS } from '@/mocks/defaults';

interface AddWorkoutModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (config: WorkoutConfig) => void;
  existing: WorkoutConfig[];
}

const DISTANCE_UNITS: { label: string; value: DistanceUnit }[] = [
  { label: 'Meters', value: 'meters' },
  { label: 'Kilometers', value: 'km' },
  { label: 'Yards', value: 'yards' },
  { label: 'Miles', value: 'miles' },
];

export default function AddWorkoutModal({ visible, onClose, onAdd, existing }: AddWorkoutModalProps) {
  const [customName, setCustomName] = useState('');
  const [customEmoji, setCustomEmoji] = useState('🏋️');
  const [selectedUnit, setSelectedUnit] = useState<DistanceUnit>('miles');
  const [selectedColor, setSelectedColor] = useState(WORKOUT_COLORS[0]);

  const existingIds = existing.map((w) => w.id);

  const handlePresetAdd = (preset: { name: string; emoji: string }) => {
    const id = preset.name.toLowerCase().replace(/\s+/g, '_');
    if (existingIds.includes(id)) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const colorIdx = existing.length % WORKOUT_COLORS.length;
    const sportConfig = SPORT_FIELD_CONFIGS[preset.name];
    const config: WorkoutConfig = {
      id,
      name: preset.name,
      emoji: preset.emoji,
      color: WORKOUT_COLORS[colorIdx],
      darkColor: WORKOUT_COLORS[colorIdx] + '25',
      distanceUnit: sportConfig?.fields.includes('distance') ? 'miles' : 'miles',
      fields: sportConfig?.fields ?? ['distance', 'time'],
      fieldLabels: sportConfig?.fieldLabels ?? {},
    };
    onAdd(config);
    onClose();
  };

  const handleCustomAdd = () => {
    if (!customName.trim()) return;
    const id = 'custom_' + customName.trim().toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const sportConfig = SPORT_FIELD_CONFIGS[customName.trim()];
    const config: WorkoutConfig = {
      id,
      name: customName.trim(),
      emoji: customEmoji,
      color: selectedColor,
      darkColor: selectedColor + '25',
      distanceUnit: selectedUnit,
      fields: sportConfig?.fields ?? ['distance', 'time'],
      fieldLabels: sportConfig?.fieldLabels ?? {},
    };
    onAdd(config);
    setCustomName('');
    setCustomEmoji('🏋️');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <View style={styles.modalHeader}>
              <Text style={styles.title}>Add Workout</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>QUICK ADD</Text>
            <View style={styles.presetsGrid}>
              {PRESET_WORKOUTS.map((preset) => {
                const id = preset.name.toLowerCase().replace(/\s+/g, '_');
                const alreadyAdded = existingIds.includes(id);
                return (
                  <TouchableOpacity
                    key={preset.name}
                    style={[styles.presetChip, alreadyAdded && styles.presetChipDisabled]}
                    onPress={() => handlePresetAdd(preset)}
                    disabled={alreadyAdded}
                  >
                    <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                    <Text style={[styles.presetName, alreadyAdded && styles.presetNameDisabled]}>
                      {preset.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>CUSTOM WORKOUT</Text>
            <View style={styles.customSection}>
              <View style={styles.customRow}>
                <TextInput
                  style={styles.emojiInput}
                  value={customEmoji}
                  onChangeText={(t) => setCustomEmoji(t.slice(-2) || '🏋️')}
                  placeholder="🏋️"
                  placeholderTextColor={Colors.textTertiary}
                />
                <TextInput
                  style={styles.nameInput}
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder="Workout name"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>

              <Text style={styles.subLabel}>Distance Unit</Text>
              <View style={styles.unitRow}>
                {DISTANCE_UNITS.map((u) => (
                  <TouchableOpacity
                    key={u.value}
                    style={[styles.unitChip, selectedUnit === u.value && styles.unitChipActive]}
                    onPress={() => setSelectedUnit(u.value)}
                  >
                    <Text style={[styles.unitChipText, selectedUnit === u.value && styles.unitChipTextActive]}>
                      {u.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.subLabel}>Color</Text>
              <View style={styles.colorRow}>
                {WORKOUT_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorDot, { backgroundColor: c }, selectedColor === c && styles.colorDotActive]}
                    onPress={() => setSelectedColor(c)}
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[styles.createBtn, !customName.trim() && styles.createBtnDisabled]}
                onPress={handleCustomAdd}
                disabled={!customName.trim()}
              >
                <Text style={styles.createBtnText}>Create Custom Workout</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
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
    width: '92%',
    maxWidth: 420,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 4,
  },
  presetsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 20,
  },
  presetChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  presetChipDisabled: {
    opacity: 0.35,
  },
  presetEmoji: {
    fontSize: 16,
  },
  presetName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  presetNameDisabled: {
    color: Colors.textTertiary,
  },
  customSection: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
    marginBottom: 16,
  },
  customRow: {
    flexDirection: 'row' as const,
    gap: 10,
    marginBottom: 14,
  },
  emojiInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    width: 52,
    height: 44,
    textAlign: 'center' as const,
    fontSize: 22,
    color: Colors.textPrimary,
  },
  nameInput: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 14,
    height: 44,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  unitRow: {
    flexDirection: 'row' as const,
    gap: 6,
    marginBottom: 14,
  },
  unitChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center' as const,
  },
  unitChipActive: {
    backgroundColor: Colors.accent + '20',
    borderColor: Colors.accent,
  },
  unitChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
  },
  unitChipTextActive: {
    color: Colors.accent,
  },
  colorRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 10,
    marginBottom: 16,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotActive: {
    borderColor: '#FFFFFF',
  },
  createBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center' as const,
  },
  createBtnDisabled: {
    opacity: 0.4,
  },
  createBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  cancelBtn: {
    alignItems: 'center' as const,
    paddingVertical: 14,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
});
