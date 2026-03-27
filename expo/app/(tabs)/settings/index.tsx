import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Trash2, Plus, X, ChevronRight, Star, Calendar, Minus, Zap, Heart, Activity, Users, Cloud, User, Bell } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { WorkoutConfig } from '@/constants/types';
import { useTraining } from '@/providers/TrainingProvider';
import GlassCard from '@/components/GlassCard';
import SupplementModal from '@/components/SupplementModal';
import RecoveryModal from '@/components/RecoveryModal';
import AddWorkoutModal from '@/components/AddWorkoutModal';
import EditWorkoutModal from '@/components/EditWorkoutModal';
import CalendarPickerModal from '@/components/CalendarPickerModal';
import { useAuth } from '@/providers/AuthProvider';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    profile,
    updateProfile,
    supplements,
    addSupplement,
    removeSupplement,
    recoveryOptions,
    addRecoveryOption,
    removeRecoveryOption,
    updateRecoveryOption,
    workoutConfigs,
    addWorkoutConfig,
    removeWorkoutConfig,
    updateWorkoutConfig,
    clearAllData,
    activeEvent,
    events,
  } = useTraining();
  const { integrations, isSignedIn, account } = useAuth();

  const connectedCount = [
    integrations?.healthkit,
    integrations?.strava,
    integrations?.whoop,
  ].filter(i => i?.status === 'connected').length;

  const [showSupplementModal, setShowSupplementModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutConfig | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleClear = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your training data, supplements, and settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            clearAllData();
          },
        },
      ]
    );
  };

  const handleRemoveWorkout = (id: string, name: string) => {
    Alert.alert(
      `Remove ${name}?`,
      'This will remove this workout type from your list. Existing logged workouts will remain in history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            removeWorkoutConfig(id);
          },
        },
      ]
    );
  };

  const handleToggleProgressPopup = (value: boolean) => {
    updateProfile({ showProgressPopup: value });
  };

  const handleDateSelect = (dateStr: string) => {
    updateProfile({ eventDate: dateStr });
  };

  const handleDateReset = () => {
    updateProfile({ eventDate: '' });
  };

  const handleRecoveryGoalChange = (id: string, delta: number) => {
    const opt = recoveryOptions.find((r) => r.id === id);
    if (!opt || opt.trackOnly) return;
    const current = opt.weeklyGoal ?? 3;
    const next = Math.max(0, Math.min(7, current + delta));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (next === 0) {
      updateRecoveryOption(id, { weeklyGoal: 0, trackOnly: true });
    } else {
      updateRecoveryOption(id, { weeklyGoal: next, trackOnly: false });
    }
  };

  const handleToggleTrackOnly = (id: string) => {
    const opt = recoveryOptions.find((r) => r.id === id);
    if (!opt) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (opt.trackOnly) {
      updateRecoveryOption(id, { weeklyGoal: 3, trackOnly: false });
    } else {
      updateRecoveryOption(id, { weeklyGoal: 0, trackOnly: true });
    }
  };

  const handleRemoveRecovery = (id: string, name: string) => {
    Alert.alert(
      `Remove ${name}?`,
      'This will remove this recovery option.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            removeRecoveryOption(id);
          },
        },
      ]
    );
  };

  return (
    <LinearGradient
      colors={[Colors.gradientStart, Colors.gradientMid, Colors.gradientEnd]}
      style={styles.container}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Settings</Text>

        <Text style={styles.sectionTitle}>EVENT</Text>
        <GlassCard>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Active Event</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => router.push('/events' as never)}
              activeOpacity={0.7}
              testID="settings-active-event"
            >
              <View style={styles.pickerBtnLeft}>
                {activeEvent ? (
                  <>
                    <Star size={14} color={Colors.accent} />
                    <Text style={styles.pickerBtnText}>{activeEvent.name}</Text>
                  </>
                ) : (
                  <Text style={styles.pickerBtnTextDim}>No active event</Text>
                )}
              </View>
              <ChevronRight size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.manageEventsBtn}
            onPress={() => router.push('/events' as never)}
            activeOpacity={0.7}
          >
            <Calendar size={16} color={Colors.accent} />
            <Text style={styles.manageEventsBtnText}>Manage Events</Text>
            <ChevronRight size={16} color={Colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Event Day</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
              testID="settings-date-picker"
            >
              <Text style={[styles.pickerBtnText, !profile.eventDate && styles.pickerBtnTextDim]}>
                {profile.eventDate || 'No date set'}
              </Text>
              <Calendar size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={styles.switchLabelText}>Show progress after workout</Text>
              <Text style={styles.switchLabelSub}>Bottom sheet with race progress</Text>
            </View>
            <Switch
              value={profile.showProgressPopup}
              onValueChange={handleToggleProgressPopup}
              trackColor={{ false: Colors.inputBackground, true: Colors.accent + '60' }}
              thumbColor={profile.showProgressPopup ? Colors.accent : Colors.textTertiary}
            />
          </View>
        </GlassCard>

        <Text style={styles.sectionTitle}>WORKOUTS</Text>
        <GlassCard accentColor={Colors.accent}>
          {workoutConfigs.length === 0 ? (
            <Text style={styles.emptyText}>No workouts configured</Text>
          ) : (
            workoutConfigs.map((w) => {
              const fieldsSummary = w.fields.filter(f => f !== 'time').map(f =>
                w.fieldLabels?.[f] || (f === 'distance' ? `Distance (${w.distanceUnit})` : f === 'laps' ? 'Laps' : f === 'elevation' ? 'Elevation' : f === 'avgSpeed' ? 'Avg Speed' : f.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()))
              ).join(', ');
              return (
                <View key={w.id} style={styles.listItem}>
                  <TouchableOpacity
                    style={styles.listItemTap}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setEditingWorkout(w);
                    }}
                    activeOpacity={0.6}
                  >
                    <View style={styles.listItemLeft}>
                      <Text style={styles.workoutEmoji}>{w.emoji}</Text>
                      <View style={styles.listItemInfo}>
                        <Text style={styles.listItemName}>{w.name}</Text>
                        <Text style={styles.listItemDose} numberOfLines={1}>
                          {fieldsSummary}
                        </Text>
                      </View>
                    </View>
                    <ChevronRight size={16} color={Colors.textTertiary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleRemoveWorkout(w.id, w.name)}
                  >
                    <X size={16} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
          <TouchableOpacity
            style={styles.addListBtn}
            onPress={() => setShowWorkoutModal(true)}
          >
            <Plus size={16} color={Colors.accent} />
            <Text style={[styles.addListBtnText, { color: Colors.accent }]}>
              Add Workout Type
            </Text>
          </TouchableOpacity>
        </GlassCard>

        <Text style={styles.sectionTitle}>SUPPLEMENTS</Text>
        <GlassCard accentColor={Colors.supplement}>
          {supplements.length === 0 ? (
            <Text style={styles.emptyText}>No supplements configured</Text>
          ) : (
            supplements.map((s) => (
              <View key={s.id} style={styles.listItem}>
                <View style={styles.listItemLeft}>
                  <View>
                    <Text style={styles.listItemName}>{s.name}</Text>
                    <Text style={styles.listItemDose}>{s.dose}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    removeSupplement(s.id);
                  }}
                >
                  <X size={16} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            ))
          )}
          <TouchableOpacity
            style={styles.addListBtn}
            onPress={() => setShowSupplementModal(true)}
          >
            <Plus size={16} color={Colors.supplement} />
            <Text style={[styles.addListBtnText, { color: Colors.supplement }]}>
              Add Supplement
            </Text>
          </TouchableOpacity>
        </GlassCard>

        <Text style={styles.sectionTitle}>RECOVERY OPTIONS</Text>
        <GlassCard accentColor={Colors.recovery}>
          {recoveryOptions.length === 0 ? (
            <Text style={styles.emptyText}>No recovery options configured</Text>
          ) : (
            recoveryOptions.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.recoveryListItem}
                onLongPress={() => handleRemoveRecovery(r.id, r.name)}
                activeOpacity={0.7}
              >
                <Text style={styles.recoveryItemName}>{r.name}</Text>
                {r.trackOnly ? (
                  <TouchableOpacity
                    style={styles.trackOnlyBadge}
                    onPress={() => handleToggleTrackOnly(r.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.trackOnlyText}>Tracked</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.goalStepper}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleRecoveryGoalChange(r.id, -1)}
                    >
                      <Minus size={14} color={Colors.recovery} />
                    </TouchableOpacity>
                    <Text style={styles.goalValue}>{r.weeklyGoal ?? 3}x</Text>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleRecoveryGoalChange(r.id, 1)}
                    >
                      <Plus size={14} color={Colors.recovery} />
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity
            style={styles.addListBtn}
            onPress={() => setShowRecoveryModal(true)}
          >
            <Plus size={16} color={Colors.recovery} />
            <Text style={[styles.addListBtnText, { color: Colors.recovery }]}>
              Add Recovery Option
            </Text>
          </TouchableOpacity>
        </GlassCard>

        <Text style={styles.sectionTitle}>INTEGRATIONS & ACCOUNT</Text>
        <GlassCard>
          <TouchableOpacity
            style={styles.settingsLinkRow}
            onPress={() => router.push('/integrations' as never)}
            activeOpacity={0.7}
            testID="settings-integrations"
          >
            <View style={[styles.settingsLinkIcon, { backgroundColor: Colors.stravaDark }]}>
              <Activity size={18} color={Colors.strava} />
            </View>
            <View style={styles.settingsLinkText}>
              <Text style={styles.settingsLinkTitle}>Integrations</Text>
              <Text style={styles.settingsLinkSubtitle}>
                {connectedCount} connected
              </Text>
            </View>
            <ChevronRight size={16} color={Colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.settingsLinkDivider} />

          <TouchableOpacity
            style={styles.settingsLinkRow}
            onPress={() => router.push('/account' as never)}
            activeOpacity={0.7}
            testID="settings-account"
          >
            <View style={[styles.settingsLinkIcon, { backgroundColor: Colors.googleDark }]}>
              <Cloud size={18} color={Colors.google} />
            </View>
            <View style={styles.settingsLinkText}>
              <Text style={styles.settingsLinkTitle}>Account & Cloud Sync</Text>
              <Text style={styles.settingsLinkSubtitle}>
                {isSignedIn ? account?.email ?? 'Connected' : 'Not signed in'}
              </Text>
            </View>
            <ChevronRight size={16} color={Colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.settingsLinkDivider} />

          <TouchableOpacity
            style={styles.settingsLinkRow}
            onPress={() => router.push('/friends' as never)}
            activeOpacity={0.7}
            testID="settings-friends"
          >
            <View style={[styles.settingsLinkIcon, { backgroundColor: Colors.socialDark }]}>
              <Users size={18} color={Colors.social} />
            </View>
            <View style={styles.settingsLinkText}>
              <Text style={styles.settingsLinkTitle}>Friends & Social</Text>
              <Text style={styles.settingsLinkSubtitle}>Manage contacts & privacy</Text>
            </View>
            <ChevronRight size={16} color={Colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.settingsLinkDivider} />

          <View style={styles.settingsLinkRow}>
            <View style={[styles.settingsLinkIcon, { backgroundColor: Colors.accent + '15' }]}>
              <Bell size={18} color={Colors.accent} />
            </View>
            <View style={styles.settingsLinkText}>
              <Text style={styles.settingsLinkTitle}>Notifications</Text>
              <Text style={styles.settingsLinkSubtitle}>Friend requests & activity syncs</Text>
            </View>
          </View>
        </GlassCard>

        <Text style={styles.sectionTitle}>DATA</Text>
        <TouchableOpacity style={styles.dangerBtn} onPress={handleClear} testID="clear-data-btn">
          <Trash2 size={18} color={Colors.danger} />
          <Text style={styles.dangerBtnText}>Clear All Training Data</Text>
        </TouchableOpacity>

        <View style={{ height: 48 }} />
      </ScrollView>

      <SupplementModal
        visible={showSupplementModal}
        onClose={() => setShowSupplementModal(false)}
        onAdd={addSupplement}
        existing={supplements}
      />
      <RecoveryModal
        visible={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        onAdd={addRecoveryOption}
        existing={recoveryOptions}
      />
      <AddWorkoutModal
        visible={showWorkoutModal}
        onClose={() => setShowWorkoutModal(false)}
        onAdd={addWorkoutConfig}
        existing={workoutConfigs}
      />
      <EditWorkoutModal
        visible={editingWorkout !== null}
        onClose={() => setEditingWorkout(null)}
        config={editingWorkout}
        onSave={updateWorkoutConfig}
      />
      <CalendarPickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={handleDateSelect}
        onReset={handleDateReset}
        currentDate={profile.eventDate}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  pickerBtn: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  pickerBtnLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    flex: 1,
  },
  pickerBtnText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '500' as const,
  },
  pickerBtnTextDim: {
    color: Colors.textTertiary,
    fontSize: 16,
    fontWeight: '500' as const,
  },
  manageEventsBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 12,
    marginBottom: 14,
    borderRadius: 10,
    backgroundColor: Colors.accent + '10',
    paddingHorizontal: 14,
  },
  manageEventsBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.accent,
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingTop: 4,
  },
  switchLabel: {
    flex: 1,
    marginRight: 12,
  },
  switchLabelText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  switchLabelSub: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  listItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    gap: 6,
  },
  listItemTap: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 8,
  },
  listItemLeft: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  listItemInfo: {
    flex: 1,
  },
  workoutEmoji: {
    fontSize: 22,
  },
  listItemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  listItemDose: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,82,82,0.1)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  addListBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 12,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed' as const,
  },
  addListBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center' as const,
    paddingVertical: 8,
  },
  dangerBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,82,82,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,82,82,0.2)',
  },
  dangerBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.danger,
  },
  recoveryListItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  recoveryItemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    flex: 1,
  },
  trackOnlyBadge: {
    backgroundColor: Colors.recoveryDark,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  trackOnlyText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    fontStyle: 'italic' as const,
  },
  goalStepper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.recoveryDark,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  goalValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.recovery,
    minWidth: 28,
    textAlign: 'center' as const,
  },
  settingsLinkRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 10,
  },
  settingsLinkIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  settingsLinkText: {
    flex: 1,
  },
  settingsLinkTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  settingsLinkSubtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  settingsLinkDivider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginVertical: 2,
  },
});
