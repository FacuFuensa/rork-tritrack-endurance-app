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
import { Supplement } from '@/constants/types';
import { COMMON_SUPPLEMENTS } from '@/mocks/defaults';

interface SupplementModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (supplement: Supplement) => void;
  existing: Supplement[];
}

export default function SupplementModal({ visible, onClose, onAdd, existing }: SupplementModalProps) {
  const [customName, setCustomName] = useState('');
  const [customDose, setCustomDose] = useState('');

  const existingNames = existing.map((s) => s.name.toLowerCase());

  const handlePresetAdd = (name: string, dose: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const id = `s_${name.toLowerCase().replace(/[\s-]/g, '_')}_${Date.now()}`;
    onAdd({ id, name, dose, isCustom: false });
    onClose();
  };

  const handleCustomAdd = () => {
    if (!customName.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const id = `s_custom_${Date.now()}`;
    onAdd({ id, name: customName.trim(), dose: customDose.trim() || '1 serving', isCustom: true });
    setCustomName('');
    setCustomDose('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Supplement</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>COMMON SUPPLEMENTS</Text>
            <View style={styles.presetGrid}>
              {COMMON_SUPPLEMENTS.map((s) => {
                const isAdded = existingNames.includes(s.name.toLowerCase());
                return (
                  <TouchableOpacity
                    key={s.name}
                    style={[styles.presetBtn, isAdded && styles.presetBtnDisabled]}
                    onPress={() => !isAdded && handlePresetAdd(s.name, s.dose)}
                    activeOpacity={isAdded ? 1 : 0.7}
                  >
                    <Text style={[styles.presetText, isAdded && styles.presetTextDisabled]}>
                      {s.name}
                    </Text>
                    <Text style={[styles.presetDose, isAdded && styles.presetTextDisabled]}>
                      {s.dose}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>CUSTOM</Text>
            <TextInput
              style={styles.input}
              value={customName}
              onChangeText={setCustomName}
              placeholder="Supplement name"
              placeholderTextColor={Colors.textTertiary}
            />
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={customDose}
              onChangeText={setCustomDose}
              placeholder="Dose (e.g., 5g, 1 tab)"
              placeholderTextColor={Colors.textTertiary}
            />
            <TouchableOpacity
              style={[styles.createBtn, !customName.trim() && styles.createBtnDisabled]}
              onPress={handleCustomAdd}
              disabled={!customName.trim()}
            >
              <Text style={styles.createBtnText}>Create Custom Supplement</Text>
            </TouchableOpacity>
          </ScrollView>

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
    maxHeight: '80%',
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
  scroll: {
    paddingHorizontal: 20,
    maxHeight: 450,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  presetGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  presetBtn: {
    backgroundColor: Colors.supplementDark,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.supplement + '30',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  presetBtnDisabled: {
    opacity: 0.4,
  },
  presetText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.supplement,
  },
  presetDose: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  presetTextDisabled: {
    color: Colors.textTertiary,
  },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  createBtn: {
    backgroundColor: Colors.supplement,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center' as const,
    marginTop: 12,
  },
  createBtnDisabled: {
    opacity: 0.5,
  },
  createBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
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
});
