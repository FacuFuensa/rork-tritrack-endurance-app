import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Plus, X, Star, MapPin, Calendar, ChevronLeft, Check, Trash2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { TrainingEvent, GoalEvent, GoalEventDistance, DistanceUnit, EventStatus } from '@/constants/types';
import { useTraining } from '@/providers/TrainingProvider';
import { EVENT_TYPES, CUSTOM_EVENT_TYPE } from '@/mocks/defaults';
import { daysUntil } from '@/utils/dateUtils';
import CalendarPickerModal from '@/components/CalendarPickerModal';
import GlassCard from '@/components/GlassCard';

const UNIT_OPTIONS: DistanceUnit[] = ['meters', 'km', 'yards', 'miles'];

const DISCIPLINE_PRESETS: { id: string; name: string; emoji: string; defaultUnit: DistanceUnit }[] = [
  { id: 'swim', name: 'Swim', emoji: '🏊', defaultUnit: 'meters' },
  { id: 'bike', name: 'Bike', emoji: '🚴', defaultUnit: 'miles' },
  { id: 'run', name: 'Run', emoji: '🏃', defaultUnit: 'miles' },
  { id: 'strength', name: 'Strength / Gym', emoji: '🏋️', defaultUnit: 'miles' },
  { id: 'rowing', name: 'Rowing', emoji: '🚣', defaultUnit: 'meters' },
  { id: 'walk', name: 'Walk', emoji: '🚶', defaultUnit: 'miles' },
  { id: 'hike', name: 'Hike', emoji: '🥾', defaultUnit: 'miles' },
  { id: 'climbing', name: 'Climbing', emoji: '🧗', defaultUnit: 'meters' },
  { id: 'soccer', name: 'Soccer', emoji: '⚽', defaultUnit: 'km' },
  { id: 'basketball', name: 'Basketball', emoji: '🏀', defaultUnit: 'miles' },
  { id: 'tennis', name: 'Tennis', emoji: '🎾', defaultUnit: 'miles' },
  { id: 'yoga', name: 'Yoga', emoji: '🧘', defaultUnit: 'meters' },
  { id: 'stretching', name: 'Stretching', emoji: '🤸', defaultUnit: 'meters' },
  { id: 'other', name: 'Other', emoji: '🏅', defaultUnit: 'miles' },
];

function unitShort(u: DistanceUnit): string {
  switch (u) {
    case 'meters': return 'm';
    case 'km': return 'km';
    case 'yards': return 'yd';
    case 'miles': return 'mi';
  }
}

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { events, addEvent, updateEvent, deleteEvent, activeEvent, setActiveEventId, profile } = useTraining();

  const [showEditor, setShowEditor] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TrainingEvent | null>(null);

  const [eventType, setEventType] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [eventStatus, setEventStatus] = useState<EventStatus>('interested');
  const [goalEvent, setGoalEvent] = useState<GoalEvent>({ type: '', distances: [] });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [customDistances, setCustomDistances] = useState<GoalEventDistance[]>([
    { discipline: 'run', distance: 0, unit: 'miles' },
  ]);
  const [showDisciplinePicker, setShowDisciplinePicker] = useState(false);

  const openNewEvent = useCallback(() => {
    setEditingEvent(null);
    setEventType('');
    setEventName('');
    setEventDate('');
    setEventLocation('');
    setEventNotes('');
    setEventStatus('interested');
    setGoalEvent({ type: '', distances: [] });
    setCustomDistances([{ discipline: 'run', distance: 0, unit: 'miles' }]);
    setShowTypePicker(true);
  }, []);

  const openEditEvent = useCallback((event: TrainingEvent) => {
    setEditingEvent(event);
    setEventType(event.type);
    setEventName(event.name);
    setEventDate(event.eventDate);
    setEventLocation(event.location);
    setEventNotes(event.notes);
    setEventStatus(event.status);
    setGoalEvent(event.goalEvent);
    if (event.goalEvent.type === CUSTOM_EVENT_TYPE) {
      setCustomDistances(event.goalEvent.distances.length > 0 ? event.goalEvent.distances : [{ discipline: 'run', distance: 0, unit: 'miles' }]);
    }
    setShowEditor(true);
  }, []);

  const handleSelectType = useCallback((label: string, ge: GoalEvent) => {
    setEventType(label);
    setGoalEvent(ge);
    setShowTypePicker(false);
    setShowEditor(true);
  }, []);

  const handleSelectCustomType = useCallback(() => {
    setEventType(CUSTOM_EVENT_TYPE);
    setGoalEvent({ type: CUSTOM_EVENT_TYPE, distances: [] });
    setShowTypePicker(false);
    setShowEditor(true);
  }, []);

  const handleSave = useCallback(() => {
    const name = eventName.trim();
    if (!name) {
      Alert.alert('Required', 'Please enter an event name.');
      return;
    }

    let finalGoalEvent = goalEvent;
    if (eventType === CUSTOM_EVENT_TYPE) {
      const validDistances = customDistances.filter((d) => d.discipline.trim() && d.distance > 0);
      finalGoalEvent = { type: CUSTOM_EVENT_TYPE, distances: validDistances };
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (editingEvent) {
      updateEvent(editingEvent.id, {
        type: eventType,
        name,
        eventDate,
        location: eventLocation.trim(),
        notes: eventNotes.trim(),
        status: eventStatus,
        goalEvent: finalGoalEvent,
      });
    } else {
      const newEvent: TrainingEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: eventType,
        name,
        eventDate,
        location: eventLocation.trim(),
        notes: eventNotes.trim(),
        status: eventStatus,
        goalEvent: finalGoalEvent,
      };
      addEvent(newEvent);
      if (events.length === 0) {
        setActiveEventId(newEvent.id);
      }
    }

    setShowEditor(false);
  }, [editingEvent, eventType, eventName, eventDate, eventLocation, eventNotes, eventStatus, goalEvent, customDistances, updateEvent, addEvent, events.length, setActiveEventId]);

  const handleDelete = useCallback((id: string, name: string) => {
    Alert.alert(`Delete "${name}"?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteEvent(id);
        },
      },
    ]);
  }, [deleteEvent]);

  const handleSetActive = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveEventId(id);
  }, [setActiveEventId]);

  return (
    <LinearGradient
      colors={[Colors.gradientStart, Colors.gradientMid, Colors.gradientEnd]}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Events</Text>
        <TouchableOpacity onPress={openNewEvent} style={styles.addHeaderBtn}>
          <Plus size={20} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {events.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🏁</Text>
            <Text style={styles.emptyTitle}>No events yet</Text>
            <Text style={styles.emptySubtitle}>Create your first event to start tracking race progress</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openNewEvent}>
              <Plus size={18} color="#FFFFFF" />
              <Text style={styles.emptyBtnText}>Create Event</Text>
            </TouchableOpacity>
          </View>
        ) : (
          events.map((event) => {
            const isActive = profile.activeEventId === event.id;
            const days = event.eventDate ? daysUntil(event.eventDate) : null;
            return (
              <TouchableOpacity key={event.id} activeOpacity={0.7} onPress={() => openEditEvent(event)}>
                <GlassCard accentColor={isActive ? Colors.accent : undefined}>
                  <View style={styles.eventCardHeader}>
                    <View style={styles.eventCardLeft}>
                      <Text style={styles.eventCardName}>{event.name}</Text>
                      <Text style={styles.eventCardType}>{event.type}</Text>
                    </View>
                    <View style={styles.eventCardRight}>
                      {isActive ? (
                        <View style={styles.activeBadge}>
                          <Star size={12} color={Colors.accent} />
                          <Text style={styles.activeBadgeText}>Active</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.setActiveBtn}
                          onPress={() => handleSetActive(event.id)}
                        >
                          <Text style={styles.setActiveBtnText}>Set Active</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <View style={styles.eventCardDetails}>
                    {event.eventDate ? (
                      <View style={styles.detailRow}>
                        <Calendar size={13} color={Colors.textTertiary} />
                        <Text style={styles.detailText}>
                          {event.eventDate}{days !== null && days > 0 ? ` (${days} days)` : ''}
                        </Text>
                      </View>
                    ) : null}
                    {event.location ? (
                      <View style={styles.detailRow}>
                        <MapPin size={13} color={Colors.textTertiary} />
                        <Text style={styles.detailText}>{event.location}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.eventCardFooter}>
                    <View style={[styles.statusBadge, event.status === 'confirmed' ? styles.statusConfirmed : styles.statusInterested]}>
                      <Text style={[styles.statusText, event.status === 'confirmed' ? styles.statusTextConfirmed : styles.statusTextInterested]}>
                        {event.status === 'confirmed' ? 'Confirmed' : 'Interested'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteCardBtn}
                      onPress={() => handleDelete(event.id, event.name)}
                    >
                      <Trash2 size={14} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </GlassCard>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={showTypePicker} transparent animationType="fade" onRequestClose={() => setShowTypePicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowTypePicker(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Event Type</Text>
              <TouchableOpacity onPress={() => setShowTypePicker(false)} style={styles.modalClose}>
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.typeList} showsVerticalScrollIndicator={false}>
              {EVENT_TYPES.map((et) => (
                <TouchableOpacity
                  key={et.label}
                  style={styles.typeRow}
                  onPress={() => handleSelectType(et.label, et.goalEvent)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.typeLabel}>{et.label}</Text>
                  <Text style={styles.typeSub}>
                    {et.goalEvent.distances.map((d) => `${d.distance}${unitShort(d.unit)} ${d.discipline}`).join(' + ')}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.typeRow} onPress={handleSelectCustomType} activeOpacity={0.7}>
                <Text style={styles.typeLabel}>Custom</Text>
                <Text style={styles.typeSub}>Define your own distances</Text>
              </TouchableOpacity>
              <View style={{ height: 16 }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showEditor} transparent animationType="slide" onRequestClose={() => setShowEditor(false)}>
        <View style={[styles.editorContainer, { paddingTop: insets.top }]}>
          <LinearGradient colors={[Colors.gradientStart, Colors.gradientMid, Colors.gradientEnd]} style={StyleSheet.absoluteFill} />
          <View style={styles.editorHeader}>
            <TouchableOpacity onPress={() => setShowEditor(false)} style={styles.editorCloseBtn}>
              <X size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.editorTitle}>{editingEvent ? 'Edit Event' : 'New Event'}</Text>
            <TouchableOpacity onPress={handleSave} style={styles.editorSaveBtn}>
              <Check size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.editorScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.editorScrollContent}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Event Type</Text>
              <TouchableOpacity
                style={styles.fieldInput}
                onPress={() => { setShowEditor(false); setTimeout(() => setShowTypePicker(true), 300); }}
              >
                <Text style={[styles.fieldInputText, !eventType && styles.fieldPlaceholder]}>
                  {eventType || 'Select type...'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Event Name *</Text>
              <TextInput
                style={styles.fieldInput}
                value={eventName}
                onChangeText={setEventName}
                placeholder="e.g., Galveston 70.3"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Event Day</Text>
              <TouchableOpacity style={styles.fieldInput} onPress={() => setShowDatePicker(true)}>
                <Text style={[styles.fieldInputText, !eventDate && styles.fieldPlaceholder]}>
                  {eventDate || 'Select date...'}
                </Text>
                <Calendar size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Location</Text>
              <TextInput
                style={styles.fieldInput}
                value={eventLocation}
                onChangeText={setEventLocation}
                placeholder="e.g., Galveston, TX"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.fieldInput, styles.notesInput]}
                value={eventNotes}
                onChangeText={setEventNotes}
                placeholder="Any notes..."
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.statusToggle}>
                <TouchableOpacity
                  style={[styles.statusOption, eventStatus === 'interested' && styles.statusOptionActive]}
                  onPress={() => setEventStatus('interested')}
                >
                  <Text style={[styles.statusOptionText, eventStatus === 'interested' && styles.statusOptionTextActive]}>
                    Interested
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.statusOption, eventStatus === 'confirmed' && styles.statusOptionActiveConfirmed]}
                  onPress={() => setEventStatus('confirmed')}
                >
                  <Text style={[styles.statusOptionText, eventStatus === 'confirmed' && styles.statusOptionTextActive]}>
                    Confirmed
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {eventType === CUSTOM_EVENT_TYPE && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Disciplines & Distances</Text>
                {customDistances.map((d, idx) => {
                  const preset = DISCIPLINE_PRESETS.find((p) => p.id === d.discipline);
                  const displayName = preset ? preset.name : d.discipline;
                  const displayEmoji = preset ? preset.emoji : '🏅';
                  return (
                    <View key={idx} style={styles.distCard}>
                      <View style={styles.distCardHeader}>
                        <Text style={styles.distCardEmoji}>{displayEmoji}</Text>
                        <Text style={styles.distCardName}>{displayName || 'Select discipline'}</Text>
                        {customDistances.length > 1 && (
                          <TouchableOpacity
                            style={styles.removeDistBtn}
                            onPress={() => setCustomDistances((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            <X size={14} color={Colors.danger} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={styles.distCardFields}>
                        <View style={styles.distFieldGroup}>
                          <Text style={styles.distFieldLabel}>Goal distance</Text>
                          <TextInput
                            style={styles.distFieldInput}
                            value={d.distance > 0 ? d.distance.toString() : ''}
                            onChangeText={(v) => {
                              const next = [...customDistances];
                              next[idx] = { ...next[idx], distance: parseFloat(v) || 0 };
                              setCustomDistances(next);
                            }}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={Colors.textTertiary}
                          />
                        </View>
                        <TouchableOpacity
                          style={styles.unitPickerBtn}
                          onPress={() => {
                            const next = [...customDistances];
                            const curIdx = UNIT_OPTIONS.indexOf(d.unit);
                            next[idx] = { ...next[idx], unit: UNIT_OPTIONS[(curIdx + 1) % UNIT_OPTIONS.length] };
                            setCustomDistances(next);
                          }}
                        >
                          <Text style={styles.unitPickerText}>{unitShort(d.unit)}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
                <TouchableOpacity
                  style={styles.addDistBtn}
                  onPress={() => setShowDisciplinePicker(true)}
                >
                  <Plus size={16} color={Colors.accent} />
                  <Text style={styles.addDistText}>Add Discipline</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: 48 }} />
          </ScrollView>
        </View>

        <CalendarPickerModal
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          onSelect={(d) => setEventDate(d)}
          onReset={() => setEventDate('')}
          currentDate={eventDate}
        />

        <Modal visible={showDisciplinePicker} transparent animationType="fade" onRequestClose={() => setShowDisciplinePicker(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowDisciplinePicker(false)}>
            <Pressable style={styles.disciplineModalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choose Discipline</Text>
                <TouchableOpacity onPress={() => setShowDisciplinePicker(false)} style={styles.modalClose}>
                  <X size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.disciplineList} showsVerticalScrollIndicator={false}>
                <View style={styles.disciplineGrid}>
                  {DISCIPLINE_PRESETS.map((preset) => {
                    const alreadyAdded = customDistances.some((d) => d.discipline === preset.id);
                    return (
                      <TouchableOpacity
                        key={preset.id}
                        style={[styles.disciplineChip, alreadyAdded && styles.disciplineChipDisabled]}
                        onPress={() => {
                          if (alreadyAdded) return;
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          const emptyIdx = customDistances.findIndex((d) => !d.discipline || d.discipline === '');
                          if (emptyIdx >= 0) {
                            const next = [...customDistances];
                            next[emptyIdx] = { discipline: preset.id, distance: 0, unit: preset.defaultUnit };
                            setCustomDistances(next);
                          } else {
                            setCustomDistances((prev) => [...prev, { discipline: preset.id, distance: 0, unit: preset.defaultUnit }]);
                          }
                          setShowDisciplinePicker(false);
                        }}
                        activeOpacity={alreadyAdded ? 1 : 0.7}
                      >
                        <Text style={styles.disciplineChipEmoji}>{preset.emoji}</Text>
                        <Text style={[styles.disciplineChipText, alreadyAdded && styles.disciplineChipTextDisabled]}>
                          {preset.name}
                        </Text>
                        {alreadyAdded && <Text style={styles.disciplineAddedLabel}>Added</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={{ height: 16 }} />
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
  },
  addHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  emptyState: {
    alignItems: 'center' as const,
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  emptyBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  eventCardHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 10,
  },
  eventCardLeft: {
    flex: 1,
  },
  eventCardRight: {},
  eventCardName: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  eventCardType: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  activeBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: Colors.accent + '20',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  setActiveBtn: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  setActiveBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  eventCardDetails: {
    gap: 6,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  eventCardFooter: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusInterested: {
    backgroundColor: Colors.warning + '20',
  },
  statusConfirmed: {
    backgroundColor: Colors.success + '20',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  statusTextInterested: {
    color: Colors.warning,
  },
  statusTextConfirmed: {
    color: Colors.success,
  },
  deleteCardBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,82,82,0.1)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center' as const,
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    maxHeight: '75%',
    overflow: 'hidden' as const,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  typeList: {
    paddingHorizontal: 20,
  },
  typeRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  typeLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  typeSub: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  editorContainer: {
    flex: 1,
  },
  editorHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  editorCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  editorTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
  },
  editorSaveBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  editorScroll: {
    flex: 1,
  },
  editorScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
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
    fontSize: 15,
    fontWeight: '500' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  fieldInputText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.textPrimary,
    flex: 1,
  },
  fieldPlaceholder: {
    color: Colors.textTertiary,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top' as const,
  },
  statusToggle: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    alignItems: 'center' as const,
    backgroundColor: Colors.inputBackground,
  },
  statusOptionActive: {
    borderColor: Colors.warning,
    backgroundColor: Colors.warning + '15',
  },
  statusOptionActiveConfirmed: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '15',
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  statusOptionTextActive: {
    color: Colors.textPrimary,
  },
  distRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 8,
  },
  unitPickerBtn: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  unitPickerText: {
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
  distCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
    marginBottom: 10,
  },
  distCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 10,
  },
  distCardEmoji: {
    fontSize: 20,
  },
  distCardName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    flex: 1,
  },
  distCardFields: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  distFieldGroup: {
    flex: 1,
  },
  distFieldLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  distFieldInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  addDistBtn: {
    flexDirection: 'row' as const,
    paddingVertical: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed' as const,
  },
  addDistText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  disciplineModalContent: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    maxHeight: '75%',
    overflow: 'hidden' as const,
  },
  disciplineList: {
    paddingHorizontal: 20,
  },
  disciplineGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 10,
  },
  disciplineChip: {
    backgroundColor: Colors.accent + '12',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  disciplineChipDisabled: {
    opacity: 0.4,
  },
  disciplineChipEmoji: {
    fontSize: 18,
  },
  disciplineChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  disciplineChipTextDisabled: {
    color: Colors.textTertiary,
  },
  disciplineAddedLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginLeft: 2,
  },
});
