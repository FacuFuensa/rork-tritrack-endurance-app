import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { X, Check, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { GoalEvent, GoalEventDistance, DistanceUnit } from '@/constants/types';
import { EVENT_TYPES, CUSTOM_EVENT_TYPE } from '@/mocks/defaults';

interface EventTypePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (eventName: string, goalEvent: GoalEvent) => void;
  currentEventName: string;
}

const UNIT_OPTIONS: DistanceUnit[] = ['meters', 'km', 'yards', 'miles'];

function unitShort(u: DistanceUnit): string {
  switch (u) {
    case 'meters': return 'm';
    case 'km': return 'km';
    case 'yards': return 'yd';
    case 'miles': return 'mi';
  }
}

export default function EventTypePickerModal({
  visible,
  onClose,
  onSelect,
  currentEventName,
}: EventTypePickerModalProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDistances, setCustomDistances] = useState<GoalEventDistance[]>([
    { discipline: 'run', distance: 0, unit: 'miles' },
  ]);

  const handleSelectPreset = (label: string, goalEvent: GoalEvent) => {
    onSelect(label, goalEvent);
    onClose();
  };

  const handleAddCustomDistance = () => {
    setCustomDistances((prev) => [
      ...prev,
      { discipline: '', distance: 0, unit: 'miles' },
    ]);
  };

  const handleRemoveCustomDistance = (idx: number) => {
    setCustomDistances((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateCustomDistance = (
    idx: number,
    field: keyof GoalEventDistance,
    value: string | number
  ) => {
    setCustomDistances((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleSaveCustom = () => {
    const name = customName.trim() || 'Custom Event';
    const validDistances = customDistances.filter(
      (d) => d.discipline.trim() && d.distance > 0
    );
    const goalEvent: GoalEvent = {
      type: CUSTOM_EVENT_TYPE,
      distances: validDistances,
    };
    onSelect(name, goalEvent);
    setShowCustom(false);
    setCustomName('');
    setCustomDistances([{ discipline: 'run', distance: 0, unit: 'miles' }]);
    onClose();
  };

  const handleClose = () => {
    setShowCustom(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {showCustom ? 'Custom Event' : 'Training For'}
            </Text>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {!showCustom ? (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {EVENT_TYPES.map((et) => {
                const isSelected = currentEventName === et.label;
                return (
                  <TouchableOpacity
                    key={et.label}
                    style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                    onPress={() => handleSelectPreset(et.label, et.goalEvent)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionLeft}>
                      <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                        {et.label}
                      </Text>
                      <Text style={styles.optionSub}>
                        {et.goalEvent.distances
                          .map((d) => `${d.distance}${unitShort(d.unit)} ${d.discipline}`)
                          .join(' + ')}
                      </Text>
                    </View>
                    {isSelected && <Check size={18} color={Colors.accent} />}
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => setShowCustom(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionLabel}>Custom distances…</Text>
                <ChevronRight size={18} color={Colors.textTertiary} />
              </TouchableOpacity>

              <View style={{ height: 16 }} />
            </ScrollView>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Event Name</Text>
                <TextInput
                  style={styles.input}
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder="e.g., My Race"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>

              <Text style={styles.sectionLabel}>DISTANCES</Text>
              {customDistances.map((d, idx) => (
                <View key={idx} style={styles.distRow}>
                  <TextInput
                    style={[styles.input, styles.disciplineInput]}
                    value={d.discipline}
                    onChangeText={(v) => handleUpdateCustomDistance(idx, 'discipline', v)}
                    placeholder="Discipline"
                    placeholderTextColor={Colors.textTertiary}
                  />
                  <TextInput
                    style={[styles.input, styles.distanceInput]}
                    value={d.distance > 0 ? d.distance.toString() : ''}
                    onChangeText={(v) =>
                      handleUpdateCustomDistance(idx, 'distance', parseFloat(v) || 0)
                    }
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.textTertiary}
                  />
                  <TouchableOpacity
                    style={styles.unitPicker}
                    onPress={() => {
                      const currentIdx = UNIT_OPTIONS.indexOf(d.unit);
                      const next = UNIT_OPTIONS[(currentIdx + 1) % UNIT_OPTIONS.length];
                      handleUpdateCustomDistance(idx, 'unit', next);
                    }}
                  >
                    <Text style={styles.unitText}>{unitShort(d.unit)}</Text>
                  </TouchableOpacity>
                  {customDistances.length > 1 && (
                    <TouchableOpacity
                      style={styles.removeDistBtn}
                      onPress={() => handleRemoveCustomDistance(idx)}
                    >
                      <X size={14} color={Colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity style={styles.addDistBtn} onPress={handleAddCustomDistance}>
                <Text style={styles.addDistText}>+ Add Distance</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCustom}>
                <Text style={styles.saveBtnText}>Save Custom Event</Text>
              </TouchableOpacity>

              <View style={{ height: 16 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modal: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
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
  list: {
    paddingHorizontal: 20,
  },
  optionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  optionRowSelected: {
    backgroundColor: 'rgba(94,159,255,0.08)',
    marginHorizontal: -20,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderBottomColor: 'transparent',
  },
  optionLeft: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  optionLabelSelected: {
    color: Colors.accent,
  },
  optionSub: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  distRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 10,
  },
  disciplineInput: {
    flex: 2,
  },
  distanceInput: {
    flex: 1,
    textAlign: 'right' as const,
  },
  unitPicker: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  unitText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  removeDistBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,82,82,0.1)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  addDistBtn: {
    paddingVertical: 12,
    alignItems: 'center' as const,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed' as const,
    marginBottom: 16,
  },
  addDistText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
