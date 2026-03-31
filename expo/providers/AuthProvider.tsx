import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { supabase, isSupabaseConfigured } from '@/utils/supabase';
import { UserAccount, IntegrationConfig, IntegrationType, WhoopData, WhoopDailyMetrics, WhoopSyncState, ImportedWorkout, SourcePreferences } from '@/constants/types';
import type { Session } from '@supabase/supabase-js';

function getAuthErrorMessage(error: string): string {
  if (error.includes('Invalid login credentials')) return 'Invalid email or password. Please try again.';
  if (error.includes('Email not confirmed')) return 'Please check your email and confirm your account before signing in.';
  if (error.includes('User already registered')) return 'An account with this email already exists. Try signing in instead.';
  if (error.includes('Password should be')) return 'Password must be at least 6 characters long.';
  if (error.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
  if (error.includes('network') || error.includes('fetch')) return 'Network error. Please check your internet connection.';
  return error;
}

const LEGACY_KEYS: Record<string, string> = {
  account: 'tritrack_account',
  integrations: 'tritrack_integrations',
  whoopData: 'tritrack_whoop_data',
  whoopSync: 'tritrack_whoop_sync',
  importedWorkouts: 'tritrack_imported_workouts',
  cloudSyncEnabled: 'tritrack_cloud_sync',
  sourcePrefs: 'tritrack_source_prefs',
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
    console.log(`[AuthProvider] Migrated key ${legacyKey} -> ${namespacedKey}`);
  }
  return val;
}

const DEFAULT_WHOOP_SYNC: WhoopSyncState = {
  dailyMetrics: {},
  lastSyncTime: '',
};

const DEFAULT_INTEGRATIONS: Record<IntegrationType, IntegrationConfig> = {
  healthkit: { type: 'healthkit', status: 'disconnected', autoSync: true },
  strava: { type: 'strava', status: 'disconnected', autoSync: true },
  whoop: { type: 'whoop', status: 'disconnected', autoSync: true },
  garmin: { type: 'garmin', status: 'not_available', autoSync: false },
};

const DEFAULT_SOURCE_PREFS: SourcePreferences = {
  swim: 'strava',
  bike: 'strava',
  run: 'strava',
};

export const [AuthProvider, useAuth] = createContextHook(() => {
  const queryClient = useQueryClient();

  const [account, setAccount] = useState<UserAccount | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [integrations, setIntegrations] = useState<Record<IntegrationType, IntegrationConfig>>(DEFAULT_INTEGRATIONS);
  const [whoopData, setWhoopData] = useState<WhoopData | null>(null);
  const [whoopSync, setWhoopSync] = useState<WhoopSyncState>(DEFAULT_WHOOP_SYNC);
  const [importedWorkouts, setImportedWorkouts] = useState<ImportedWorkout[]>([]);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState<boolean>(false);
  const [sourcePreferences, setSourcePreferences] = useState<SourcePreferences>(DEFAULT_SOURCE_PREFS);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const userId = session?.user?.id ?? null;
  const storageScope = useMemo(() => getStorageScope(userId), [userId]);
  const storageScopeRef = useRef<string>('guest');
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    storageScopeRef.current = storageScope;
  }, [storageScope]);

  const resetAuthDataToDefaults = useCallback(() => {
    console.log('[AuthProvider] Resetting auth data to defaults');
    setIntegrations(DEFAULT_INTEGRATIONS);
    setWhoopData(null);
    setWhoopSync(DEFAULT_WHOOP_SYNC);
    setImportedWorkouts([]);
    setCloudSyncEnabled(false);
    setSourcePreferences(DEFAULT_SOURCE_PREFS);
  }, []);

  useEffect(() => {
    const prev = prevUserIdRef.current;
    prevUserIdRef.current = userId;

    if (prev !== null && prev !== userId) {
      console.log(`[AuthProvider] User changed from ${prev} to ${userId}, resetting data`);
      resetAuthDataToDefaults();
      queryClient.removeQueries({ queryKey: ['tritrack-auth-data'] });
      queryClient.removeQueries({ queryKey: ['tritrack-auth-data', prev] });
      queryClient.removeQueries({ queryKey: ['tritrack-auth-data', storageScope] });
    }
  }, [queryClient, resetAuthDataToDefaults, storageScope, userId]);

  const persistMutation = useMutation({
    mutationFn: async ({ key, data }: { key: string; data: unknown }) => {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    },
    onError: (error) => {
      console.error('[AuthProvider] Persist error:', error);
    },
  });

  const persist = useCallback((base: string, data: unknown) => {
    const scope = storageScopeRef.current;
    const key = storageKey(scope, base);
    persistMutation.mutate({ key, data });
  }, [persistMutation]);

  const buildAccountFromSession = useCallback((s: Session): UserAccount => {
    return {
      id: s.user.id,
      email: s.user.email ?? '',
      displayName: s.user.user_metadata?.full_name ?? s.user.user_metadata?.display_name ?? s.user.email?.split('@')[0] ?? 'Athlete',
      provider: 'email',
      createdAt: s.user.created_at,
      lastLoginAt: new Date().toISOString(),
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const configured = isSupabaseConfigured();
    console.log('[AuthProvider] Initializing auth. Supabase configured:', configured);

    if (!configured) {
      console.warn('[AuthProvider] Supabase not configured, skipping auth init');
      setAuthLoading(false);
      return;
    }

    const initSession = async () => {
      try {
        const { data: { session: s }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('[AuthProvider] getSession error:', error.message);
        }
        if (!mounted) return;

        console.log('[AuthProvider] Initial session:', s ? 'exists' : 'none');
        setSession(s);
        if (s?.user) {
          const acc = buildAccountFromSession(s);
          setAccount(acc);
        }
      } catch (err) {
        console.error('[AuthProvider] Session init error:', err);
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    };

    void initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      console.log('[AuthProvider] Auth state changed:', event, s ? 'session exists' : 'no session');
      setSession(s);
      if (s?.user) {
        const acc = buildAccountFromSession(s);
        setAccount(acc);
      } else {
        setAccount(null);
      }

      if (event === 'SIGNED_IN') {
        console.log('[AuthProvider] User signed in:', s?.user?.email);
        setCloudSyncEnabled(true);
      } else if (event === 'SIGNED_OUT') {
        console.log('[AuthProvider] User signed out');
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('[AuthProvider] Token refreshed');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [buildAccountFromSession]);

  const dataQuery = useQuery({
    queryKey: ['tritrack-auth-data', storageScope],
    queryFn: async () => {
      console.log('[AuthProvider] Loading auth data for scope:', storageScope);

      const scopedKey = (base: string) => storageKey(storageScope, base);

      const [intg, wd, ws, iw, cs, sp] = await Promise.all([
        getWithFallback(scopedKey('integrations'), LEGACY_KEYS.integrations),
        getWithFallback(scopedKey('whoop_data'), LEGACY_KEYS.whoopData),
        getWithFallback(scopedKey('whoop_sync'), LEGACY_KEYS.whoopSync),
        getWithFallback(scopedKey('imported_workouts'), LEGACY_KEYS.importedWorkouts),
        getWithFallback(scopedKey('cloud_sync'), LEGACY_KEYS.cloudSyncEnabled),
        getWithFallback(scopedKey('source_prefs'), LEGACY_KEYS.sourcePrefs),
      ]);
      return {
        integrations: intg ? JSON.parse(intg) : DEFAULT_INTEGRATIONS,
        whoopData: wd ? JSON.parse(wd) : null,
        whoopSync: ws ? JSON.parse(ws) : DEFAULT_WHOOP_SYNC,
        importedWorkouts: iw ? JSON.parse(iw) : [],
        cloudSyncEnabled: cs ? JSON.parse(cs) : false,
        sourcePreferences: sp ? JSON.parse(sp) : DEFAULT_SOURCE_PREFS,
      };
    },
    enabled: !authLoading,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!authLoading && dataQuery.data) {
      console.log('[AuthProvider] User data loaded');
      const loadedIntegrations = dataQuery.data.integrations ?? {};
      const mergedIntegrations: Record<IntegrationType, IntegrationConfig> = {
        healthkit: { ...DEFAULT_INTEGRATIONS.healthkit, ...(loadedIntegrations.healthkit ?? {}) },
        strava: { ...DEFAULT_INTEGRATIONS.strava, ...(loadedIntegrations.strava ?? {}) },
        whoop: { ...DEFAULT_INTEGRATIONS.whoop, ...(loadedIntegrations.whoop ?? {}) },
        garmin: { ...DEFAULT_INTEGRATIONS.garmin, ...(loadedIntegrations.garmin ?? {}) },
      };
      setIntegrations(mergedIntegrations);
      setWhoopData(dataQuery.data.whoopData ?? null);
      setWhoopSync(dataQuery.data.whoopSync ?? DEFAULT_WHOOP_SYNC);
      setImportedWorkouts(dataQuery.data.importedWorkouts ?? []);
      setCloudSyncEnabled(dataQuery.data.cloudSyncEnabled ?? false);
      setSourcePreferences(dataQuery.data.sourcePreferences ?? DEFAULT_SOURCE_PREFS);
    }
  }, [authLoading, dataQuery.data]);

  const signUpWithEmail = useCallback(async (email: string, password: string, displayName: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please set up your environment variables.');
    }
    console.log('[AuthProvider] Signing up with email:', email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });
    if (error) {
      console.error('[AuthProvider] Sign up error:', error.message);
      throw new Error(getAuthErrorMessage(error.message));
    }
    console.log('[AuthProvider] Sign up successful, user:', data.user?.id);
    if (data.user && !data.session) {
      await AsyncStorage.setItem('tritrack_is_new_signup', 'true');
      return { needsConfirmation: true };
    }
    await AsyncStorage.setItem('tritrack_is_new_signup', 'true');
    setCloudSyncEnabled(true);
    return { needsConfirmation: false };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please set up your environment variables.');
    }
    console.log('[AuthProvider] Signing in with email:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      console.error('[AuthProvider] Sign in error:', error.message);
      throw new Error(getAuthErrorMessage(error.message));
    }
    console.log('[AuthProvider] Sign in successful, user:', data.user?.id);
    setCloudSyncEnabled(true);
    return data;
  }, []);

  const signOut = useCallback(async (keepLocal: boolean = true) => {
    console.log('[AuthProvider] Signing out, keepLocal:', keepLocal);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[AuthProvider] Sign out error:', error.message);
      }
    } catch (err) {
      console.error('[AuthProvider] Sign out exception:', err);
    }

    setAccount(null);
    setSession(null);
    resetAuthDataToDefaults();

    queryClient.clear();
    console.log('[AuthProvider] Query cache cleared');

    console.log('[AuthProvider] Sign out complete');
  }, [resetAuthDataToDefaults, queryClient]);

  const resetPassword = useCallback(async (email: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please set up your environment variables.');
    }
    console.log('[AuthProvider] Sending password reset to:', email);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      console.error('[AuthProvider] Reset password error:', error.message);
      throw new Error(getAuthErrorMessage(error.message));
    }
    console.log('[AuthProvider] Password reset email sent');
  }, []);

  const updateAccount = useCallback((updates: Partial<UserAccount>) => {
    setAccount((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      return next;
    });
  }, []);

  const toggleCloudSync = useCallback((enabled: boolean) => {
    setCloudSyncEnabled(enabled);
    persist('cloud_sync', enabled);
    console.log('[AuthProvider] Cloud sync:', enabled);
  }, [persist]);

  const updateIntegration = useCallback((type: IntegrationType, updates: Partial<IntegrationConfig>) => {
    setIntegrations((prev) => {
      const next = { ...prev, [type]: { ...prev[type], ...updates } };
      persist('integrations', next);
      console.log('[AuthProvider] Integration updated:', type, updates.status);
      return next;
    });
  }, [persist]);

  const updateWhoopData = useCallback((data: WhoopData) => {
    setWhoopData(data);
    persist('whoop_data', data);
    console.log('[AuthProvider] WHOOP data updated');
  }, [persist]);

  const updateWhoopSync = useCallback((updater: (prev: WhoopSyncState) => WhoopSyncState) => {
    setWhoopSync((prev) => {
      const next = updater(prev);
      persist('whoop_sync', next);
      console.log('[AuthProvider] WHOOP sync state updated, dates:', Object.keys(next.dailyMetrics).length);
      return next;
    });
  }, [persist]);

  const getWhoopMetricsForDate = useCallback((date: string): WhoopDailyMetrics | null => {
    return whoopSync.dailyMetrics[date] ?? null;
  }, [whoopSync]);

  const getLatestWhoopMetrics = useCallback((): WhoopDailyMetrics | null => {
    const entries = Object.values(whoopSync.dailyMetrics);
    if (entries.length === 0) return null;
    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    const withData = sorted.find(
      (m) => m.recoveryScore > 0 || m.rawStrain > 0 || m.sleepDurationSeconds > 0
    );
    return withData ?? sorted[0];
  }, [whoopSync]);

  const setManualOverride = useCallback((date: string, metrics: Partial<Pick<WhoopDailyMetrics, 'recoveryScore' | 'strain' | 'sleepDurationSeconds'>>) => {
    setWhoopSync((prev) => {
      const existing = prev.dailyMetrics[date];
      if (!existing) return prev;
      const updated: WhoopDailyMetrics = {
        ...existing,
        ...metrics,
        manualOverride: true,
      };
      const next: WhoopSyncState = {
        ...prev,
        dailyMetrics: { ...prev.dailyMetrics, [date]: updated },
      };
      persist('whoop_sync', next);
      console.log('[AuthProvider] Manual override set for date:', date);
      return next;
    });
  }, [persist]);

  const clearManualOverride = useCallback((date: string) => {
    setWhoopSync((prev) => {
      const existing = prev.dailyMetrics[date];
      if (!existing) return prev;
      const restored: WhoopDailyMetrics = {
        ...existing,
        recoveryScore: Math.round(existing.rawRecovery),
        strain: existing.rawStrain.toFixed(1),
        sleepDurationSeconds: existing.rawSleepSeconds,
        manualOverride: false,
      };
      const next: WhoopSyncState = {
        ...prev,
        dailyMetrics: { ...prev.dailyMetrics, [date]: restored },
      };
      persist('whoop_sync', next);
      console.log('[AuthProvider] Manual override cleared for date:', date, '- restored WHOOP values');
      return next;
    });
  }, [persist]);

  const addImportedWorkouts = useCallback((workouts: ImportedWorkout[]) => {
    setImportedWorkouts((prev) => {
      const existingIds = new Set(prev.map((w) => `${w.source}_${w.sourceId}`));
      const newOnes = workouts.filter((w) => !existingIds.has(`${w.source}_${w.sourceId}`));
      if (newOnes.length === 0) return prev;
      const next = [...prev, ...newOnes];
      persist('imported_workouts', next);
      console.log(`[AuthProvider] Added ${newOnes.length} imported workouts`);
      return next;
    });
  }, [persist]);

  const isSignedIn = useMemo(() => account !== null && session !== null, [account, session]);

  const updateSourcePreference = useCallback((discipline: keyof SourcePreferences, source: IntegrationType) => {
    setSourcePreferences((prev) => {
      const next = { ...prev, [discipline]: source };
      persist('source_prefs', next);
      console.log('[AuthProvider] Source preference updated:', discipline, '->', source);
      return next;
    });
  }, [persist]);

  const isConfigured = useMemo(() => isSupabaseConfigured(), []);

  return useMemo(() => ({
    isConfigured,
    account,
    session,
    isSignedIn,
    signUpWithEmail,
    signInWithEmail,
    signOut,
    resetPassword,
    updateAccount,
    cloudSyncEnabled,
    toggleCloudSync,
    integrations,
    updateIntegration,
    whoopData,
    updateWhoopData,
    whoopSync,
    updateWhoopSync,
    getWhoopMetricsForDate,
    getLatestWhoopMetrics,
    setManualOverride,
    clearManualOverride,
    importedWorkouts,
    addImportedWorkouts,
    sourcePreferences,
    updateSourcePreference,
    authReady: !authLoading,
    storageScope,
    isLoading: authLoading || dataQuery.isLoading,
  }), [
    account,
    session,
    isSignedIn,
    signUpWithEmail,
    signInWithEmail,
    signOut,
    resetPassword,
    updateAccount,
    cloudSyncEnabled,
    toggleCloudSync,
    integrations,
    updateIntegration,
    whoopData,
    updateWhoopData,
    whoopSync,
    updateWhoopSync,
    getWhoopMetricsForDate,
    getLatestWhoopMetrics,
    setManualOverride,
    clearManualOverride,
    importedWorkouts,
    addImportedWorkouts,
    sourcePreferences,
    updateSourcePreference,
    authLoading,
    dataQuery.isLoading,
    isConfigured,
    storageScope,
  ]);
});
