import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Target, Calendar, ChevronRight, Sparkles } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { TrainingEvent, GoalEvent, EventStatus } from '@/constants/types';
import { useTraining } from '@/providers/TrainingProvider';
import { EVENT_TYPES } from '@/mocks/defaults';
import CalendarPickerModal from '@/components/CalendarPickerModal';

type OnboardingStep = 'welcome' | 'type' | 'details' | 'done';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { updateProfile, addEvent, setActiveEventId, markEventOnboardingSeen } = useTraining();

  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [selectedType, setSelectedType] = useState<{ label: string; goalEvent: GoalEvent } | null>(null);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventStatus, setEventStatus] = useState<EventStatus>('interested');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateProfile({ onboardingComplete: true });
    markEventOnboardingSeen();
    router.replace('/(tabs)/(home)' as never);
  }, [updateProfile, markEventOnboardingSeen, router]);

  const handleNotYet = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateProfile({
      onboardingComplete: true,
      eventName: 'Fitness',
      eventDate: '',
      goalEvent: undefined,
      activeEventId: '',
    });
    markEventOnboardingSeen();
    router.replace('/(tabs)/(home)' as never);
  }, [updateProfile, markEventOnboardingSeen, router]);

  const handleYes = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('type');
  }, []);

  const handleSelectType = useCallback((et: { label: string; goalEvent: GoalEvent }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedType(et);
    setEventName(et.label);
    setStep('details');
  }, []);

  const handleFinish = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (selectedType) {
      const name = eventName.trim() || selectedType.label;
      const newEvent: TrainingEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: selectedType.label,
        name,
        eventDate,
        location: '',
        notes: '',
        status: eventStatus,
        goalEvent: selectedType.goalEvent,
      };
      addEvent(newEvent);
      setActiveEventId(newEvent.id);
      updateProfile({
        onboardingComplete: true,
        eventName: name,
        eventDate,
        goalEvent: selectedType.goalEvent,
        activeEventId: newEvent.id,
      });
    } else {
      updateProfile({ onboardingComplete: true });
    }

    markEventOnboardingSeen();
    router.replace('/(tabs)/(home)' as never);
  }, [selectedType, eventName, eventDate, eventStatus, addEvent, setActiveEventId, updateProfile, markEventOnboardingSeen, router]);

  const stepIndicator = (
    <View style={styles.stepDots}>
      {['welcome', 'type', 'details'].map((s, i) => (
        <View
          key={s}
          style={[
            styles.dot,
            (step === s || (step === 'done' && i === 2)) && styles.dotActive,
          ]}
        />
      ))}
    </View>
  );

  return (
    <LinearGradient
      colors={[Colors.gradientStart, Colors.gradientMid, Colors.gradientEnd]}
      style={styles.container}
    >
      <View style={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipBtnText}>Skip</Text>
        </TouchableOpacity>

        {step === 'welcome' && (
          <View style={styles.stepContent}>
            <View style={styles.iconCircle}>
              <Target size={32} color={Colors.accent} />
            </View>
            <Text style={styles.welcomeTitle}>Welcome to TriTrack</Text>
            <Text style={styles.welcomeSubtitle}>
              Your personal training companion for races, goals, and everyday fitness.
            </Text>

            {stepIndicator}

            <Text style={styles.questionText}>
              Are you training for a specific event?
            </Text>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleYes}>
              <Text style={styles.primaryBtnText}>Yes, I have an event in mind</Text>
              <ChevronRight size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={handleNotYet}>
              <Text style={styles.secondaryBtnText}>Not yet (just tracking fitness)</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'type' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>What are you training for?</Text>
            {stepIndicator}

            <ScrollView style={styles.typeScroll} showsVerticalScrollIndicator={false}>
              {EVENT_TYPES.map((et) => (
                <TouchableOpacity
                  key={et.label}
                  style={styles.typeCard}
                  onPress={() => handleSelectType(et)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.typeCardLabel}>{et.label}</Text>
                  <Text style={styles.typeCardSub}>
                    {et.goalEvent.distances.map((d) => {
                      const u = d.unit === 'meters' ? 'm' : d.unit === 'km' ? 'km' : d.unit === 'yards' ? 'yd' : 'mi';
                      return `${d.distance}${u} ${d.discipline}`;
                    }).join(' + ')}
                  </Text>
                </TouchableOpacity>
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        )}

        {step === 'details' && selectedType && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Event Details</Text>
            {stepIndicator}

            <ScrollView style={styles.detailsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Event Name</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={eventName}
                  onChangeText={setEventName}
                  placeholder={selectedType.label}
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Event Day (optional)</Text>
                <TouchableOpacity style={styles.fieldInputBtn} onPress={() => setShowDatePicker(true)}>
                  <Text style={[styles.fieldInputText, !eventDate && styles.fieldPlaceholder]}>
                    {eventDate || 'Select date...'}
                  </Text>
                  <Calendar size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Status</Text>
                <View style={styles.statusRow}>
                  <TouchableOpacity
                    style={[styles.statusBtn, eventStatus === 'interested' && styles.statusBtnActiveWarn]}
                    onPress={() => setEventStatus('interested')}
                  >
                    <Text style={[styles.statusBtnText, eventStatus === 'interested' && styles.statusBtnTextActive]}>
                      Interested
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.statusBtn, eventStatus === 'confirmed' && styles.statusBtnActiveGreen]}
                    onPress={() => setEventStatus('confirmed')}
                  >
                    <Text style={[styles.statusBtnText, eventStatus === 'confirmed' && styles.statusBtnTextActive]}>
                      Confirmed
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}>
                <Sparkles size={18} color="#FFFFFF" />
                <Text style={styles.finishBtnText}>All set! Let's go</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        )}
      </View>

      <CalendarPickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={(d) => setEventDate(d)}
        onReset={() => setEventDate('')}
        currentDate={eventDate}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  skipBtn: {
    alignSelf: 'flex-end' as const,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  stepContent: {
    flex: 1,
    justifyContent: 'center' as const,
  },
  stepDots: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: 8,
    marginVertical: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textTertiary,
  },
  dotActive: {
    backgroundColor: Colors.accent,
    width: 24,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent + '15',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    alignSelf: 'center' as const,
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
    textAlign: 'center' as const,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginTop: 8,
    lineHeight: 22,
  },
  questionText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    textAlign: 'center' as const,
    marginBottom: 20,
  },
  primaryBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    alignItems: 'center' as const,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.backgroundCard,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
    textAlign: 'center' as const,
  },
  typeScroll: {
    flex: 1,
  },
  typeCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
    marginBottom: 10,
  },
  typeCardLabel: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  typeCardSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  detailsScroll: {
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '500' as const,
  },
  fieldInputBtn: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  fieldInputText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.textPrimary,
  },
  fieldPlaceholder: {
    color: Colors.textTertiary,
  },
  statusRow: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  statusBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    alignItems: 'center' as const,
    backgroundColor: Colors.inputBackground,
  },
  statusBtnActiveWarn: {
    borderColor: Colors.warning,
    backgroundColor: Colors.warning + '15',
  },
  statusBtnActiveGreen: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '15',
  },
  statusBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  statusBtnTextActive: {
    color: Colors.textPrimary,
  },
  finishBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 12,
  },
  finishBtnText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
