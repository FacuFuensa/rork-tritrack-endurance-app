import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import {
  UserProfile,
  Supplement,
  RecoveryOption,
  DailyLog,
  Workout,
  WorkoutConfig,
  GoalEvent,
  TrainingEvent,
} from '@/constants/types';
import {
  DEFAULT_PROFILE,
  DEFAULT_SUPPLEMENTS,
  DEFAULT_RECOVERY,
  DEFAULT_WORKOUT_CONFIGS,
} from '@/mocks/defaults';
import { getEmptyDailyLog, convertDistance, convertSpeed } from '@/utils/calculations';
import { useAuth } from '@/providers/AuthProvider';

const LEGACY_KEYS: Record<string, string> = {
  profile: 'tritrack_profile',
  supplements: 'tritrack_supplements',
  recovery: 'tritrack_recovery',
  logs: 'tritrack_logs',
  workoutConfigs: 'tritrack_workout_configs',
  events: 'tritrack_events',
  hasSeenEventOnboarding: 'tritrack_has_seen_event_onboarding',
};

function storageKey(scope: string, base: string): string {
  return `tritrack:${scope}:${base}`;
}

function getStorageScope(userId: string | null): string {
  return userId ?? 'guest';
}

async function getWithFallback(namespacedKey: string, legacyKey: string): Promise<string | null> {
  let val = await AsyncStorage.getItem(namespacedKey);
  if (val !== null) return val;
  val = await AsyncStorage.getItem(legacyKey);
  if (val !== null) {
    AsyncStorage.setItem(namespacedKey, val).catch(() => {});
    AsyncStorage.removeItem(legacyKey).catch(() => {});
    console.log(`[TrainingProvider] Migrated key ${legacyKey} -> ${namespacedKey}`);
  }
  return val;
}

interface StoredData {
  profile: UserProfile;
  supplements: Supplement[];
  recoveryOptions: RecoveryOption[];
  dailyLogs: Record<string, DailyLog>;
  workoutConfigs: WorkoutConfig[];
  events: TrainingEvent[];
  hasSeenEventOnboarding: boolean;
}

export const [TrainingProvider, useTraining] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { account, session, authReady } = useAuth();

  const userId = account?.id ?? session?.user?.id ?? null;
  const storageScope = useMemo(() => getStorageScope(userId), [userId]);
  const storageScopeRef = useRef<string>('guest');
  const prevUserIdRef = useRef<string | null>(null);

  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [supplements, setSupplements] = useState<Supplement[]>(DEFAULT_SUPPLEMENTS);
  const [recoveryOptions, setRecoveryOptions] = useState<RecoveryOption[]>(DEFAULT_RECOVERY);
  const [dailyLogs, setDailyLogs] = useState<Record<string, DailyLog>>({});
  const [workoutConfigs, setWorkoutConfigs] = useState<WorkoutConfig[]>(DEFAULT_WORKOUT_CONFIGS);
  const [events, setEvents] = useState<TrainingEvent[]>([]);
  const [hasSeenEventOnboarding, setHasSeenEventOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    storageScopeRef.current = storageScope;
  }, [storageScope]);

  const resetToDefaults = useCallback(() => {
    console.log('[TrainingProvider] Resetting to defaults');
    setProfile(DEFAULT_PROFILE);
    setSupplements(DEFAULT_SUPPLEMENTS);
    setRecoveryOptions(DEFAULT_RECOVERY);
    setDailyLogs({});
    setWorkoutConfigs(DEFAULT_WORKOUT_CONFIGS);
    setEvents([]);
    setHasSeenEventOnboarding(null);
  }, []);

  useEffect(() => {
    const prev = prevUserIdRef.current;
    prevUserIdRef.current = userId;

    if (prev !== null && prev !== userId) {
      console.log(`[TrainingProvider] User changed from ${prev} to ${userId}, resetting`);
      resetToDefaults();
      queryClient.removeQueries({ queryKey: ['tritrack-training-data'] });
      queryClient.removeQueries({ queryKey: ['tritrack-training-data', prev] });
      queryClient.removeQueries({ queryKey: ['tritrack-training-data', storageScope] });
    }

    if (userId === null && prev !== null) {
      console.log('[TrainingProvider] User signed out, resetting');
      resetToDefaults();
    }
  }, [queryClient, resetToDefaults, storageScope, userId]);

  const dataQuery = useQuery<StoredData | null>({
    queryKey: ['tritrack-training-data', storageScope],
    queryFn: async () => {
      console.log('[TrainingProvider] Loading data for scope:', storageScope);

      const scopedKey = (base: string) => storageKey(storageScope, base);

      const [p, s, r, l, wc, ev, onb] = await Promise.all([
        getWithFallback(scopedKey('profile'), LEGACY_KEYS.profile),
        getWithFallback(scopedKey('supplements'), LEGACY_KEYS.supplements),
        getWithFallback(scopedKey('recovery'), LEGACY_KEYS.recovery),
        getWithFallback(scopedKey('logs'), LEGACY_KEYS.logs),
        getWithFallback(scopedKey('workout_configs'), LEGACY_KEYS.workoutConfigs),
        getWithFallback(scopedKey('events'), LEGACY_KEYS.events),
        getWithFallback(scopedKey('has_seen_event_onboarding'), LEGACY_KEYS.hasSeenEventOnboarding),
      ]);

      const parsedProfile = p ? JSON.parse(p) : DEFAULT_PROFILE;
      if (parsedProfile.raceDate && !parsedProfile.eventDate) {
        parsedProfile.eventDate = parsedProfile.raceDate;
        delete parsedProfile.raceDate;
      }
      if (parsedProfile.showProgressPopup === undefined) {
        parsedProfile.showProgressPopup = true;
      }
      if (parsedProfile.activeEventId === undefined) {
        parsedProfile.activeEventId = '';
      }
      if (parsedProfile.onboardingComplete === undefined) {
        parsedProfile.onboardingComplete = true;
      }

      return {
        profile: parsedProfile,
        supplements: s ? JSON.parse(s) : DEFAULT_SUPPLEMENTS,
        recoveryOptions: r ? JSON.parse(r) : DEFAULT_RECOVERY,
        dailyLogs: l ? JSON.parse(l) : {},
        workoutConfigs: wc ? JSON.parse(wc) : DEFAULT_WORKOUT_CONFIGS,
        events: ev ? JSON.parse(ev) : [],
        hasSeenEventOnboarding: onb === 'true',
      };
    },
    enabled: authReady,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (authReady && dataQuery.data) {
      console.log('[TrainingProvider] Data loaded, syncing to state');
      setProfile(dataQuery.data.profile);
      setSupplements(dataQuery.data.supplements);
      setRecoveryOptions(dataQuery.data.recoveryOptions);
      setDailyLogs(dataQuery.data.dailyLogs);
      setWorkoutConfigs(dataQuery.data.workoutConfigs);
      setEvents(dataQuery.data.events);
      setHasSeenEventOnboarding(dataQuery.data.hasSeenEventOnboarding);
    }
  }, [authReady, dataQuery.data]);

  const persistMutation = useMutation({
    mutationFn: async ({ key, data }: { key: string; data: unknown }) => {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    },
    onError: (error) => {
      console.log('[TrainingProvider] Persist error:', error);
    },
  });

  const persist = useCallback((base: string, data: unknown) => {
    const key = storageKey(storageScopeRef.current, base);
    persistMutation.mutate({ key, data });
  }, [persistMutation]);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...updates };
      persist('profile', next);
      return next;
    });
  }, [persist]);

  const addSupplement = useCallback((supplement: Supplement) => {
    setSupplements((prev) => {
      const exists = prev.find((s) => s.id === supplement.id);
      if (exists) return prev;
      const next = [...prev, supplement];
      persist('supplements', next);
      return next;
    });
  }, [persist]);

  const removeSupplement = useCallback((id: string) => {
    setSupplements((prev) => {
      const next = prev.filter((s) => s.id !== id);
      persist('supplements', next);
      return next;
    });
  }, [persist]);

  const addRecoveryOption = useCallback((option: RecoveryOption) => {
    setRecoveryOptions((prev) => {
      const exists = prev.find((r) => r.id === option.id);
      if (exists) return prev;
      const withGoal = { ...option, weeklyGoal: option.trackOnly ? 0 : (option.weeklyGoal ?? 3) };
      const next = [...prev, withGoal];
      persist('recovery', next);
      return next;
    });
  }, [persist]);

  const removeRecoveryOption = useCallback((id: string) => {
    setRecoveryOptions((prev) => {
      const next = prev.filter((r) => r.id !== id);
      persist('recovery', next);
      return next;
    });
  }, [persist]);

  const updateRecoveryOption = useCallback((id: string, updates: Partial<RecoveryOption>) => {
    setRecoveryOptions((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...updates };
      persist('recovery', next);
      console.log('[TrainingProvider] Updated recovery option:', id, updates);
      return next;
    });
  }, [persist]);

  const addWorkoutConfig = useCallback((config: WorkoutConfig) => {
    setWorkoutConfigs((prev) => {
      const exists = prev.find((w) => w.id === config.id);
      if (exists) return prev;
      const next = [...prev, config];
      persist('workout_configs', next);
      console.log('[TrainingProvider] Added workout config:', config.name);
      return next;
    });
  }, [persist]);

  const removeWorkoutConfig = useCallback((id: string) => {
    setWorkoutConfigs((prev) => {
      const next = prev.filter((w) => w.id !== id);
      persist('workout_configs', next);
      console.log('[TrainingProvider] Removed workout config:', id);
      return next;
    });
  }, [persist]);

  const updateWorkoutConfig = useCallback((configId: string, updates: Partial<WorkoutConfig>) => {
    setWorkoutConfigs((prev) => {
      const idx = prev.findIndex((c) => c.id === configId);
      if (idx < 0) return prev;
      const oldConfig = prev[idx];
      const updated = { ...oldConfig, ...updates };
      const next = [...prev];
      next[idx] = updated;
      persist('workout_configs', next);

      if (updates.distanceUnit && updates.distanceUnit !== oldConfig.distanceUnit) {
        const fromUnit = oldConfig.distanceUnit;
        const toUnit = updates.distanceUnit;
        console.log(`[TrainingProvider] Converting ${configId} from ${fromUnit} to ${toUnit}`);
        setDailyLogs((prevLogs) => {
          let changed = false;
          const newLogs: Record<string, DailyLog> = {};
          for (const [date, log] of Object.entries(prevLogs)) {
            const hasWorkout = log.workouts.some((w) => w.type === configId);
            if (!hasWorkout) {
              newLogs[date] = log;
              continue;
            }
            changed = true;
            newLogs[date] = {
              ...log,
              workouts: log.workouts.map((w) => {
                if (w.type !== configId) return w;
                return {
                  ...w,
                  distance: convertDistance(w.distance, fromUnit, toUnit),
                  avgSpeed: w.avgSpeed ? convertSpeed(w.avgSpeed, fromUnit, toUnit) : undefined,
                };
              }),
            };
          }
          if (changed) {
            persist('logs', newLogs);
            return newLogs;
          }
          return prevLogs;
        });
      }

      console.log('[TrainingProvider] Updated workout config:', configId, updates);
      return next;
    });
  }, [persist]);

  const addEvent = useCallback((event: TrainingEvent) => {
    setEvents((prev) => {
      const next = [...prev, event];
      persist('events', next);
      console.log('[TrainingProvider] Added event:', event.name);
      return next;
    });
  }, [persist]);

  const updateEvent = useCallback((eventId: string, updates: Partial<TrainingEvent>) => {
    setEvents((prev) => {
      const idx = prev.findIndex((e) => e.id === eventId);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...updates };
      persist('events', next);
      console.log('[TrainingProvider] Updated event:', eventId);
      return next;
    });
  }, [persist]);

  const deleteEvent = useCallback((eventId: string) => {
    setEvents((prev) => {
      const next = prev.filter((e) => e.id !== eventId);
      persist('events', next);
      console.log('[TrainingProvider] Deleted event:', eventId);
      return next;
    });
    setProfile((prev) => {
      if (prev.activeEventId === eventId) {
        const next = { ...prev, activeEventId: '' };
        persist('profile', next);
        return next;
      }
      return prev;
    });
  }, [persist]);

  const setActiveEventId = useCallback((eventId: string) => {
    updateProfile({ activeEventId: eventId });
    const event = events.find((e) => e.id === eventId);
    if (event) {
      updateProfile({
        activeEventId: eventId,
        eventName: event.name,
        eventDate: event.eventDate,
        goalEvent: event.goalEvent,
      });
    } else {
      updateProfile({
        activeEventId: '',
        eventName: 'Fitness',
        eventDate: '',
        goalEvent: undefined,
      });
    }
    console.log('[TrainingProvider] Active event set to:', eventId);
  }, [events, updateProfile]);

  const activeEvent = useMemo((): TrainingEvent | null => {
    if (!profile.activeEventId) return null;
    return events.find((e) => e.id === profile.activeEventId) ?? null;
  }, [events, profile.activeEventId]);

  const activeGoalEvent = useMemo((): GoalEvent | undefined => {
    if (activeEvent) return activeEvent.goalEvent;
    return profile.goalEvent;
  }, [activeEvent, profile.goalEvent]);

  const getDailyLog = useCallback((date: string): DailyLog => {
    return dailyLogs[date] ?? getEmptyDailyLog(date);
  }, [dailyLogs]);

  const updateDailyLog = useCallback((date: string, updater: (log: DailyLog) => DailyLog) => {
    setDailyLogs((prev) => {
      const current = prev[date] ?? getEmptyDailyLog(date);
      const updated = updater(current);
      const next = { ...prev, [date]: updated };
      persist('logs', next);
      return next;
    });
  }, [persist]);

  const saveWorkout = useCallback((date: string, workout: Workout) => {
    updateDailyLog(date, (log) => {
      const idx = log.workouts.findIndex((w) => w.id === workout.id);
      const workouts = [...log.workouts];
      if (idx >= 0) {
        workouts[idx] = workout;
      } else {
        workouts.push(workout);
      }
      return { ...log, workouts };
    });
  }, [updateDailyLog]);

  const deleteWorkout = useCallback((date: string, workoutId: string) => {
    updateDailyLog(date, (log) => ({
      ...log,
      workouts: log.workouts.filter((w) => w.id !== workoutId),
    }));
  }, [updateDailyLog]);

  const toggleSupplement = useCallback((date: string, supplementId: string) => {
    updateDailyLog(date, (log) => {
      const taken = log.supplementsTaken.includes(supplementId)
        ? log.supplementsTaken.filter((id) => id !== supplementId)
        : [...log.supplementsTaken, supplementId];
      return { ...log, supplementsTaken: taken };
    });
  }, [updateDailyLog]);

  const toggleRecovery = useCallback((date: string, optionId: string) => {
    updateDailyLog(date, (log) => {
      const completed = log.recoveryCompleted.includes(optionId)
        ? log.recoveryCompleted.filter((id) => id !== optionId)
        : [...log.recoveryCompleted, optionId];
      return { ...log, recoveryCompleted: completed };
    });
  }, [updateDailyLog]);

  const clearAllData = useCallback(async () => {
    if (!userId) return;
    try {
      const scopedKey = (base: string) => storageKey(storageScope, base);
      await Promise.all([
        AsyncStorage.removeItem(scopedKey('profile')),
        AsyncStorage.removeItem(scopedKey('supplements')),
        AsyncStorage.removeItem(scopedKey('recovery')),
        AsyncStorage.removeItem(scopedKey('logs')),
        AsyncStorage.removeItem(scopedKey('workout_configs')),
        AsyncStorage.removeItem(scopedKey('events')),
        AsyncStorage.removeItem(scopedKey('has_seen_event_onboarding')),
      ]);
      resetToDefaults();
      queryClient.invalidateQueries({ queryKey: ['tritrack-training-data'] });
      console.log('[TrainingProvider] All data cleared for user:', userId);
    } catch (e) {
      console.log('[TrainingProvider] Clear error:', e);
    }
  }, [queryClient, resetToDefaults, storageScope, userId]);

  const markEventOnboardingSeen = useCallback(async () => {
    console.log('[TrainingProvider] Marking event onboarding as seen');
    setHasSeenEventOnboarding(true);
    const key = storageKey(storageScopeRef.current, 'has_seen_event_onboarding');
    await AsyncStorage.setItem(key, 'true');
  }, []);

  const isDataReady = authReady && dataQuery.data !== undefined;

  return {
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
    dailyLogs,
    getDailyLog,
    saveWorkout,
    deleteWorkout,
    toggleSupplement,
    toggleRecovery,
    clearAllData,
    isLoading: authReady ? dataQuery.isLoading : true,
    dataReady: isDataReady,
    events,
    addEvent,
    updateEvent,
    deleteEvent,
    activeEvent,
    activeGoalEvent,
    setActiveEventId,
    hasSeenEventOnboarding,
    markEventOnboardingSeen,
  });
}, [
  activeEvent,
  activeGoalEvent,
  addEvent,
  addRecoveryOption,
  addSupplement,
  addWorkoutConfig,
  clearAllData,
  dailyLogs,
  dataQuery.isLoading,
  deleteEvent,
  deleteWorkout,
  events,
  getDailyLog,
  hasSeenEventOnboarding,
  isDataReady,
  markEventOnboardingSeen,
  profile,
  recoveryOptions,
  removeRecoveryOption,
  removeSupplement,
  removeWorkoutConfig,
  saveWorkout,
  supplements,
  toggleRecovery,
  toggleSupplement,
  updateDailyLog,
  updateEvent,
  updateProfile,
  updateRecoveryOption,
  updateWorkoutConfig,
  workoutConfigs,
  authReady,
]);
});
