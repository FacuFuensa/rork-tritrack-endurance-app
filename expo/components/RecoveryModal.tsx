import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
  Switch,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { RecoveryOption } from '@/constants/types';
import { RECOVERY_PRESETS } from '@/mocks/defaults';

interface RecoveryModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (option: RecoveryOption) => void;
  existing: RecoveryOption[];
}

export default function RecoveryModal({ visible, onClose, onAdd, existing }: RecoveryModalProps) {
  const existingNames = existing.map((r) => r.name.toLowerCase());
  const [trackOnly, setTrackOnly] = useState(false);

  const handleAdd = (name: string) => {
    if (existingNames.includes(name.toLowerCase())) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const id = `r_${name.toLowerCase().replace(/[\s]/g, '_')}_${Date.now()}`;
    onAdd({ id, name, weeklyGoal: trackOnly ? 0 : 3, trackOnly });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Recovery Option</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.trackOnlyRow}>
              <Text style={styles.trackOnlyLabel}>Track only (no weekly goal)</Text>
              <Switch
                value={trackOnly}
                onValueChange={setTrackOnly}
                trackColor={{ false: Colors.inputBackground, true: Colors.recovery + '60' }}
                thumbColor={trackOnly ? Colors.recovery : Colors.textTertiary}
              />
            </View>
            <View style={styles.presetGrid}>
              {RECOVERY_PRESETS.map((name) => {
                const isAdded = existingNames.includes(name.toLowerCase());
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.presetBtn, isAdded && styles.presetBtnDisabled]}
                    onPress={() => handleAdd(name)}
                    activeOpacity={isAdded ? 1 : 0.7}
                  >
                    <Text style={[styles.presetText, isAdded && styles.presetTextDisabled]}>
                      {name}
                    </Text>
                    {isAdded && <Text style={styles.addedLabel}>Added</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
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
    width: '90%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    padding: 20,
    paddingTop: 12,
  },
  presetGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 10,
  },
  presetBtn: {
    backgroundColor: Colors.recoveryDark,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.recovery + '30',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  presetBtnDisabled: {
    opacity: 0.4,
  },
  presetText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.recovery,
  },
  presetTextDisabled: {
    color: Colors.textTertiary,
  },
  addedLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  cancelBtn: {
    padding: 16,
    alignItems: 'center' as const,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  trackOnlyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 14,
    paddingVertical: 4,
  },
  trackOnlyLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
});
