import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  RefreshCw,
  ChevronLeft,
  Wifi,
  WifiOff,
  Clock,
  Shield,
  AlertTriangle,
  Link,
  Unlink,
  ChevronRight,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { IntegrationType, IntegrationStatus, IntegrationConfig, ImportedWorkout, Workout } from '@/constants/types';
import { useAuth } from '@/providers/AuthProvider';
import { useTraining } from '@/providers/TrainingProvider';
import { convertDistance } from '@/utils/calculations';
import {
  connectHealthKit,
  disconnectHealthKit,
  fetchHealthKitWorkouts,
  connectStrava,
  disconnectStrava,
  fetchStravaActivities,
  refreshStravaToken,
  connectWhoop,
  disconnectWhoop,
  fetchWhoopDailyRecords,
  refreshWhoopToken,
  connectGarmin,
  disconnectGarmin,
  getRecoveryIntensitySuggestion,
  isStravaConfigured,
  isWhoopConfigured,
} from '@/utils/integrations';
import { deduplicateWorkouts } from '@/utils/dedup';
import { mapWhoopRawToDaily, mergeWhoopMetrics, formatSleepDuration, hasRealMetrics } from '@/utils/whoopMapper';
import { sendActivitySyncNotification } from '@/utils/notifications';

const STRAVA_LOGO = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Strava_Logo.svg/512px-Strava_Logo.svg.png';
const WHOOP_LOGO = 'https://images.squarespace-cdn.com/content/v1/5f1ae9458f525b5ca9e5aa46/1610121902498-HRG1V6I42V76X1AK4NID/WHOOP_Logo_White.png';
const GARMIN_LOGO = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Garmin_logo.svg/512px-Garmin_logo.svg.png';
const APPLE_HEALTH_LOGO = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Apple_Health_Icon.svg/512px-Apple_Health_Icon.svg.png';

interface IntegrationCardProps {
  type: IntegrationType;
  title: string;
  subtitle: string;
  logoUri: string;
  accentColor: string;
  status: IntegrationStatus;
  lastSync?: string;
  autoSync: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => void;
  onToggleAutoSync: () => void;
  isSyncing: boolean;
  errorMessage?: string;
  importedCount?: number;
  notConfigured?: boolean;
  configMessage?: string;
}

function StatusBadge({ status, isSyncing, accentColor }: { status: IntegrationStatus; isSyncing: boolean; accentColor: string }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isSyncing) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isSyncing, pulseAnim]);

  if (isSyncing) {
    return (
      <Animated.View style={[styles.statusBadge, { backgroundColor: accentColor + '20', opacity: pulseAnim }]}>
        <ActivityIndicator size="small" color={accentColor} />
        <Text style={[styles.statusBadgeText, { color: accentColor }]}>Syncing</Text>
      </Animated.View>
    );
  }

  const isConnected = status === 'connected';
  const isError = status === 'error' || status === 'needs_reauth';
  const isConnecting = status === 'connecting';

  if (isConnected) {
    return (
      <View style={[styles.statusBadge, { backgroundColor: Colors.success + '18' }]}>
        <View style={[styles.statusIndicatorDot, { backgroundColor: Colors.success }]} />
        <Text style={[styles.statusBadgeText, { color: Colors.success }]}>Connected</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.statusBadge, { backgroundColor: Colors.danger + '18' }]}>
        <View style={[styles.statusIndicatorDot, { backgroundColor: Colors.danger }]} />
        <Text style={[styles.statusBadgeText, { color: Colors.danger }]}>
          {status === 'needs_reauth' ? 'Reconnect' : 'Error'}
        </Text>
      </View>
    );
  }

  if (isConnecting) {
    return (
      <View style={[styles.statusBadge, { backgroundColor: Colors.warning + '18' }]}>
        <ActivityIndicator size="small" color={Colors.warning} />
        <Text style={[styles.statusBadgeText, { color: Colors.warning }]}>Connecting</Text>
      </View>
    );
  }

  return (
    <View style={[styles.statusBadge, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
      <View style={[styles.statusIndicatorDot, { backgroundColor: Colors.textTertiary }]} />
      <Text style={[styles.statusBadgeText, { color: Colors.textTertiary }]}>Not Connected</Text>
    </View>
  );
}

function IntegrationCard({
  title,
  subtitle,
  logoUri,
  accentColor,
  status,
  lastSync,
  autoSync,
  onConnect,
  onDisconnect,
  onSync,
  onToggleAutoSync,
  isSyncing,
  errorMessage,
  importedCount,
  notConfigured,
  configMessage,
}: IntegrationCardProps) {
  const isConnected = status === 'connected';
  const isError = status === 'error' || status === 'needs_reauth';
  const isNotAvailable = status === 'not_available';
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 8 }).start();
  }, [scaleAnim]);

  return (
    <Animated.View style={[styles.integrationCard, { transform: [{ scale: scaleAnim }] }]}>
      <View style={[styles.cardAccentStripe, { backgroundColor: accentColor }]} />

      <View style={styles.cardInner}>
        <View style={styles.cardTopRow}>
          <View style={[styles.logoContainer, { backgroundColor: accentColor + '12' }]}>
            <Image
              source={{ uri: logoUri }}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.cardTitleArea}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>{subtitle}</Text>
          </View>

          <StatusBadge status={status} isSyncing={isSyncing} accentColor={accentColor} />
        </View>

        {isError && errorMessage ? (
          <View style={styles.errorBanner}>
            <AlertTriangle size={13} color={Colors.danger} />
            <Text style={styles.errorBannerText} numberOfLines={2}>{errorMessage}</Text>
          </View>
        ) : null}

        {notConfigured && !isConnected ? (
          <View style={styles.configBanner}>
            <AlertTriangle size={13} color={Colors.warning} />
            <Text style={styles.configBannerText} numberOfLines={2}>
              {configMessage || 'Credentials not configured'}
            </Text>
          </View>
        ) : null}

        {isConnected && lastSync ? (
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Clock size={11} color={Colors.textTertiary} />
              <Text style={styles.metaText}>
                {new Date(lastSync).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            {importedCount !== undefined && importedCount > 0 ? (
              <View style={styles.metaItem}>
                <Text style={[styles.metaText, { color: accentColor, fontWeight: '600' as const }]}>
                  {importedCount} imported
                </Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              {autoSync ? (
                <Wifi size={11} color={Colors.success} />
              ) : (
                <WifiOff size={11} color={Colors.textTertiary} />
              )}
              <Text style={[styles.metaText, autoSync ? { color: Colors.success } : null]}>
                {autoSync ? 'Auto-sync' : 'Manual sync'}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.cardDivider} />

        {isConnected || isError ? (
          <View style={styles.connectedActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: accentColor + '12', borderColor: accentColor + '25' }]}
              onPress={status === 'needs_reauth' ? onConnect : onSync}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={isSyncing}
              activeOpacity={0.7}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={accentColor} />
              ) : (
                <RefreshCw size={15} color={accentColor} />
              )}
              <Text style={[styles.actionButtonText, { color: accentColor }]}>
                {isSyncing ? 'Syncing...' : status === 'needs_reauth' ? 'Reconnect' : 'Sync'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }]}
              onPress={onToggleAutoSync}
              activeOpacity={0.7}
            >
              {autoSync ? (
                <Wifi size={14} color={Colors.success} />
              ) : (
                <WifiOff size={14} color={Colors.textTertiary} />
              )}
              <Text style={[styles.actionButtonText, { color: autoSync ? Colors.success : Colors.textTertiary }]}>
                {autoSync ? 'Auto' : 'Manual'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.disconnectButton]}
              onPress={onDisconnect}
              activeOpacity={0.7}
            >
              <Unlink size={14} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        ) : isNotAvailable ? (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: accentColor + '15', borderColor: accentColor + '30' }]}
            onPress={onConnect}
            activeOpacity={0.7}
          >
            <ChevronRight size={16} color={accentColor} />
            <Text style={[styles.primaryButtonText, { color: accentColor }]}>Learn More</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: accentColor }]}
            onPress={onConnect}
            disabled={status === 'connecting'}
            activeOpacity={0.8}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            {status === 'connecting' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Link size={16} color="#FFFFFF" />
                <Text style={styles.connectButtonText}>Connect</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

export default function IntegrationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    integrations,
    updateIntegration,
    whoopData,
    updateWhoopData,
    whoopSync,
    updateWhoopSync,
    getLatestWhoopMetrics,
    importedWorkouts,
    addImportedWorkouts,
  } = useAuth();
  const { workoutConfigs, saveWorkout, getDailyLog } = useTraining();
  const [syncingType, setSyncingType] = useState<IntegrationType | null>(null);

  const safeIntegration = useCallback((type: IntegrationType): IntegrationConfig => {
    return integrations?.[type] ?? { type, status: 'disconnected' as IntegrationStatus, autoSync: false };
  }, [integrations]);

  const latestWhoopMetrics = useMemo(() => getLatestWhoopMetrics(), [getLatestWhoopMetrics]);
  const hasRealWhoopData = useMemo(() => hasRealMetrics(latestWhoopMetrics), [latestWhoopMetrics]);

  const saveImportedWorkoutsToDailyLogs = useCallback((imported: ImportedWorkout[]) => {
    console.log('[Integrations] Saving', imported.length, 'imported workouts to daily logs');
    const savedInThisBatch = new Set<string>();
    let savedCount = 0;

    for (const iw of imported) {
      const batchKey = `${iw.source}_${iw.sourceId}`;
      if (savedInThisBatch.has(batchKey)) continue;

      const config = workoutConfigs.find((c) => c.id === iw.type);
      const fallbackConfig = config ?? workoutConfigs.find((c) => c.id === 'run') ?? workoutConfigs[0];
      if (!fallbackConfig) {
        console.log('[Integrations] No workout configs at all, skipping:', iw.type);
        continue;
      }

      const activeConfig = config ?? fallbackConfig;
      const existingLog = getDailyLog(iw.date);
      const alreadySaved = existingLog.workouts.some(
        (w) => w.externalId === iw.sourceId && w.sourceProvider === iw.source
      );
      if (alreadySaved) {
        console.log('[Integrations] Already in daily log:', iw.sourceId);
        continue;
      }

      const distUnit = activeConfig.distanceUnit;
      const distanceInUnit = convertDistance(iw.distance, 'km', distUnit);

      let avgSpeed: number | undefined;
      if (iw.avgSpeedKmh && iw.avgSpeedKmh > 0) {
        const speedInUnit = convertDistance(iw.avgSpeedKmh, 'km', distUnit);
        avgSpeed = Math.round(speedInUnit * 100) / 100;
      }

      const workout: Workout = {
        id: iw.id,
        type: config ? iw.type : fallbackConfig.id,
        distance: Math.round(distanceInUnit * 100) / 100,
        time: iw.time,
        elevation: iw.elevation,
        avgSpeed,
        laps: iw.laps,
        sourceProvider: iw.source,
        externalId: iw.sourceId,
      };

      saveWorkout(iw.date, workout);
      savedInThisBatch.add(batchKey);
      savedCount++;
      console.log('[Integrations] Saved to daily log:', iw.date, workout.type, workout.distance, distUnit);
    }
    console.log('[Integrations] Batch save complete:', savedCount, 'of', imported.length, 'saved to daily logs');
  }, [workoutConfigs, getDailyLog, saveWorkout]);

  const performWhoopSync = useCallback(async (accessToken: string) => {
    console.log('[Integrations] Performing WHOOP per-date sync...');
    const rawRecords = await fetchWhoopDailyRecords(accessToken, 14);
    console.log('[Integrations] Fetched', rawRecords.length, 'WHOOP daily records');

    if (rawRecords.length === 0) {
      console.log('[Integrations] No WHOOP records returned');
      updateWhoopSync((prev) => ({
        ...prev,
        lastSyncTime: new Date().toISOString(),
        lastSyncError: 'No data returned from WHOOP',
      }));
      return 0;
    }

    const mappedRecords = rawRecords.map(mapWhoopRawToDaily);

    updateWhoopSync((prev) => ({
      ...prev,
      dailyMetrics: mergeWhoopMetrics(prev.dailyMetrics, mappedRecords),
      lastSyncTime: new Date().toISOString(),
      lastSyncError: undefined,
    }));

    const latestWithData = rawRecords.find(
      (r) => r.rawRecoveryScore > 0 || r.rawStrain > 0 || r.rawSleepDurationSeconds > 0
    );
    if (latestWithData) {
      updateWhoopData({
        recoveryScore: Math.round(latestWithData.rawRecoveryScore),
        strain: Math.round(latestWithData.rawStrain * 10) / 10,
        sleepScore: 0,
        hrv: 0,
        lastUpdated: new Date().toISOString(),
      });
      console.log('[Integrations] WHOOP data updated with real values:', {
        recovery: latestWithData.rawRecoveryScore,
        strain: latestWithData.rawStrain,
        sleep: latestWithData.rawSleepDurationSeconds,
        date: latestWithData.date,
      });
    } else {
      console.log('[Integrations] No WHOOP records with real data found');
    }

    return rawRecords.length;
  }, [updateWhoopSync, updateWhoopData]);

  const handleConnectHealthKit = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      updateIntegration('healthkit', { status: 'connecting' });
      await connectHealthKit();
      updateIntegration('healthkit', { status: 'connected', lastSyncAt: new Date().toISOString() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      updateIntegration('healthkit', { status: 'disconnected', error: undefined });
      const message = err instanceof Error ? err.message : 'Failed to connect to Apple Health';
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Apple Health', message);
    }
  }, [updateIntegration]);

  const handleConnectStrava = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (!isStravaConfigured()) {
        Alert.alert(
          'Strava Not Configured',
          'Strava integration requires API credentials.\n\nPlease set EXPO_PUBLIC_STRAVA_CLIENT_ID and EXPO_PUBLIC_STRAVA_CLIENT_SECRET in your environment.\n\nGet credentials at: strava.com/settings/api'
        );
        return;
      }
      updateIntegration('strava', { status: 'connecting' });
      const result = await connectStrava();
      updateIntegration('strava', {
        status: 'connected',
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        userId: result.userId,
        lastSyncAt: new Date().toISOString(),
        tokenExpiresAt: new Date(result.expiresAt * 1000).toISOString(),
        error: undefined,
      });
      try {
        setSyncingType('strava');
        const twoDaysAgo = Math.floor((Date.now() - 2 * 24 * 60 * 60 * 1000) / 1000);
        const activities = await fetchStravaActivities(result.accessToken, twoDaysAgo);
        const newWorkouts = deduplicateWorkouts(importedWorkouts, activities);
        if (newWorkouts.length > 0) {
          addImportedWorkouts(newWorkouts);
          saveImportedWorkoutsToDailyLogs(newWorkouts);
          updateIntegration('strava', { importedCount: (safeIntegration('strava').importedCount ?? 0) + newWorkouts.length });
          const primaryType = newWorkouts[0]?.type ?? 'activity';
          sendActivitySyncNotification(primaryType, newWorkouts.length, 'Strava');
        }
        console.log(`[Integrations] Initial Strava sync: ${newWorkouts.length} new workouts`);
      } catch (syncErr) {
        console.warn('[Integrations] Initial Strava sync failed:', syncErr);
      } finally {
        setSyncingType(null);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      updateIntegration('strava', { status: 'disconnected', error: undefined });
      const message = err instanceof Error ? err.message : 'Failed to connect to Strava';
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Strava Error', message);
    }
  }, [updateIntegration, importedWorkouts, addImportedWorkouts, safeIntegration, saveImportedWorkoutsToDailyLogs]);

  const handleConnectWhoop = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (!isWhoopConfigured()) {
        Alert.alert(
          'WHOOP Not Configured',
          'WHOOP integration requires API credentials.\n\nPlease set EXPO_PUBLIC_WHOOP_CLIENT_ID and EXPO_PUBLIC_WHOOP_CLIENT_SECRET in your environment.'
        );
        return;
      }
      updateIntegration('whoop', { status: 'connecting' });
      const result = await connectWhoop();
      updateIntegration('whoop', {
        status: 'connected',
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        userId: result.userId,
        lastSyncAt: new Date().toISOString(),
        error: undefined,
      });
      try {
        await performWhoopSync(result.accessToken);
      } catch (fetchErr) {
        console.warn('[Integrations] Initial WHOOP sync failed:', fetchErr);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      updateIntegration('whoop', { status: 'disconnected', error: undefined });
      const message = err instanceof Error ? err.message : 'Failed to connect to WHOOP';
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('WHOOP Error', message);
    }
  }, [updateIntegration, performWhoopSync]);

  const handleConnectGarmin = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await connectGarmin();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Garmin integration not available';
      Alert.alert('Garmin', message);
    }
  }, []);

  const handleDisconnect = useCallback(async (type: IntegrationType) => {
    const names: Record<IntegrationType, string> = {
      healthkit: 'Apple Health',
      strava: 'Strava',
      whoop: 'WHOOP',
      garmin: 'Garmin',
    };
    Alert.alert(
      'Disconnect',
      `Are you sure you want to disconnect from ${names[type]}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (type === 'healthkit') await disconnectHealthKit();
            else if (type === 'strava') await disconnectStrava();
            else if (type === 'whoop') await disconnectWhoop(safeIntegration('whoop').accessToken);
            else await disconnectGarmin();
            updateIntegration(type, {
              status: type === 'garmin' ? 'not_available' : 'disconnected',
              accessToken: undefined,
              refreshToken: undefined,
              userId: undefined,
              lastSyncAt: undefined,
              lastSuccessfulSyncAt: undefined,
              error: undefined,
              importedCount: undefined,
              tokenExpiresAt: undefined,
            });
          },
        },
      ]
    );
  }, [updateIntegration, safeIntegration]);

  const handleSync = useCallback(async (type: IntegrationType) => {
    if (syncingType) return;
    setSyncingType(type);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (type === 'healthkit') {
        const workouts = await fetchHealthKitWorkouts();
        const newWorkouts = deduplicateWorkouts(importedWorkouts, workouts);
        if (newWorkouts.length > 0) addImportedWorkouts(newWorkouts);
      } else if (type === 'strava') {
        const stravaConfig = safeIntegration('strava');
        let token = stravaConfig.accessToken ?? '';
        const refreshTk = stravaConfig.refreshToken;
        const expiresAt = stravaConfig.tokenExpiresAt;
        if (expiresAt && new Date(expiresAt) < new Date() && refreshTk) {
          console.log('[Integrations] Strava token expired, refreshing...');
          try {
            const refreshed = await refreshStravaToken(refreshTk);
            token = refreshed.accessToken;
            updateIntegration('strava', {
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken,
              tokenExpiresAt: new Date(refreshed.expiresAt * 1000).toISOString(),
            });
          } catch {
            updateIntegration('strava', { status: 'needs_reauth', error: 'Token expired. Please reconnect.' });
            throw new Error('Strava token expired. Please reconnect.');
          }
        }
        const lastSync = stravaConfig.lastSyncAt;
        const afterTimestamp = lastSync ? Math.floor(new Date(lastSync).getTime() / 1000) : undefined;
        try {
          const activities = await fetchStravaActivities(token, afterTimestamp);
          const newWorkouts = deduplicateWorkouts(importedWorkouts, activities);
          if (newWorkouts.length > 0) {
            addImportedWorkouts(newWorkouts);
            saveImportedWorkoutsToDailyLogs(newWorkouts);
            updateIntegration('strava', {
              importedCount: (stravaConfig.importedCount ?? 0) + newWorkouts.length,
            });
          }
        } catch (err) {
          if (err instanceof Error && err.message === 'STRAVA_TOKEN_EXPIRED') {
            if (refreshTk) {
              const refreshed = await refreshStravaToken(refreshTk);
              updateIntegration('strava', {
                accessToken: refreshed.accessToken,
                refreshToken: refreshed.refreshToken,
                tokenExpiresAt: new Date(refreshed.expiresAt * 1000).toISOString(),
              });
              const activities = await fetchStravaActivities(refreshed.accessToken, afterTimestamp);
              const newWorkouts = deduplicateWorkouts(importedWorkouts, activities);
              if (newWorkouts.length > 0) {
                addImportedWorkouts(newWorkouts);
                saveImportedWorkoutsToDailyLogs(newWorkouts);
              }
            } else {
              updateIntegration('strava', { status: 'needs_reauth', error: 'Token expired' });
              throw new Error('Strava token expired. Please reconnect.');
            }
          } else {
            throw err;
          }
        }
      } else if (type === 'whoop') {
        const whoopConfig = safeIntegration('whoop');
        const token = whoopConfig.accessToken ?? '';
        const refreshTk = whoopConfig.refreshToken;
        try {
          const count = await performWhoopSync(token);
          updateIntegration('whoop', { importedCount: count });
        } catch {
          if (refreshTk) {
            console.log('[Integrations] Attempting WHOOP token refresh...');
            const refreshed = await refreshWhoopToken(refreshTk);
            updateIntegration('whoop', { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken });
            const count = await performWhoopSync(refreshed.accessToken);
            updateIntegration('whoop', { importedCount: count });
          } else {
            updateIntegration('whoop', { status: 'needs_reauth', error: 'Token expired' });
            throw new Error('WHOOP token expired. Please reconnect.');
          }
        }
      }
      updateIntegration(type, {
        lastSyncAt: new Date().toISOString(),
        lastSuccessfulSyncAt: new Date().toISOString(),
        error: undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      updateIntegration(type, { error: message });
      Alert.alert('Sync Error', message);
    } finally {
      setSyncingType(null);
    }
  }, [syncingType, safeIntegration, updateIntegration, importedWorkouts, addImportedWorkouts, performWhoopSync, saveImportedWorkoutsToDailyLogs]);

  const handleToggleAutoSync = useCallback((type: IntegrationType) => {
    const current = safeIntegration(type).autoSync;
    updateIntegration(type, { autoSync: !current });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [safeIntegration, updateIntegration]);

  const whoopConnected = safeIntegration('whoop').status === 'connected';

  return (
    <LinearGradient
      colors={[Colors.gradientStart, Colors.gradientMid, Colors.gradientEnd]}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Integrations</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>TRAINING</Text>

        <IntegrationCard
          type="strava"
          title="Strava"
          subtitle="Activities, pace, distance & elevation"
          logoUri={STRAVA_LOGO}
          accentColor={Colors.strava}
          status={safeIntegration('strava').status}
          lastSync={safeIntegration('strava').lastSyncAt}
          autoSync={safeIntegration('strava').autoSync}
          onConnect={handleConnectStrava}
          onDisconnect={() => handleDisconnect('strava')}
          onSync={() => handleSync('strava')}
          onToggleAutoSync={() => handleToggleAutoSync('strava')}
          isSyncing={syncingType === 'strava'}
          errorMessage={safeIntegration('strava').error}
          importedCount={safeIntegration('strava').importedCount}
          notConfigured={!isStravaConfigured()}
          configMessage="API credentials required to connect"
        />

        <IntegrationCard
          type="healthkit"
          title="Apple Health"
          subtitle="Workouts from Apple Watch & Health"
          logoUri={APPLE_HEALTH_LOGO}
          accentColor={Colors.healthkit}
          status={safeIntegration('healthkit').status}
          lastSync={safeIntegration('healthkit').lastSyncAt}
          autoSync={safeIntegration('healthkit').autoSync}
          onConnect={handleConnectHealthKit}
          onDisconnect={() => handleDisconnect('healthkit')}
          onSync={() => handleSync('healthkit')}
          onToggleAutoSync={() => handleToggleAutoSync('healthkit')}
          isSyncing={syncingType === 'healthkit'}
          errorMessage={safeIntegration('healthkit').error}
          importedCount={safeIntegration('healthkit').importedCount}
          notConfigured={Platform.OS === 'web'}
          configMessage="Only available on iOS devices"
        />

        <IntegrationCard
          type="garmin"
          title="Garmin"
          subtitle="Connect via Strava bridge"
          logoUri={GARMIN_LOGO}
          accentColor={Colors.garmin}
          status={safeIntegration('garmin').status}
          lastSync={safeIntegration('garmin').lastSyncAt}
          autoSync={safeIntegration('garmin').autoSync}
          onConnect={handleConnectGarmin}
          onDisconnect={() => handleDisconnect('garmin')}
          onSync={() => {}}
          onToggleAutoSync={() => handleToggleAutoSync('garmin')}
          isSyncing={false}
          errorMessage={safeIntegration('garmin').error}
          notConfigured={true}
          configMessage="Requires Garmin Health API partner access"
        />

        <Text style={styles.sectionLabel}>RECOVERY</Text>

        <IntegrationCard
          type="whoop"
          title="WHOOP"
          subtitle="Recovery, strain & sleep tracking"
          logoUri={WHOOP_LOGO}
          accentColor={Colors.whoop}
          status={safeIntegration('whoop').status}
          lastSync={safeIntegration('whoop').lastSyncAt}
          autoSync={safeIntegration('whoop').autoSync}
          onConnect={handleConnectWhoop}
          onDisconnect={() => handleDisconnect('whoop')}
          onSync={() => handleSync('whoop')}
          onToggleAutoSync={() => handleToggleAutoSync('whoop')}
          isSyncing={syncingType === 'whoop'}
          errorMessage={safeIntegration('whoop').error}
          importedCount={safeIntegration('whoop').importedCount}
          notConfigured={!isWhoopConfigured()}
          configMessage="API credentials required to connect"
        />

        {whoopConnected && hasRealWhoopData && latestWhoopMetrics ? (
          <View style={styles.whoopDataCard}>
            <View style={[styles.cardAccentStripe, { backgroundColor: Colors.whoop }]} />
            <View style={styles.cardInner}>
              <Text style={[styles.whoopDataTitle, { color: Colors.whoop }]}>
                WHOOP — {latestWhoopMetrics.date}
              </Text>
              <View style={styles.whoopStatsRow}>
                <View style={styles.whoopStatItem}>
                  <Text style={styles.whoopStatValue}>
                    {latestWhoopMetrics.recoveryScore > 0 ? `${latestWhoopMetrics.recoveryScore}%` : '\u2014'}
                  </Text>
                  <Text style={styles.whoopStatLabel}>Recovery</Text>
                </View>
                <View style={styles.whoopStatDivider} />
                <View style={styles.whoopStatItem}>
                  <Text style={styles.whoopStatValue}>
                    {latestWhoopMetrics.rawStrain > 0 ? latestWhoopMetrics.strain : '\u2014'}
                  </Text>
                  <Text style={styles.whoopStatLabel}>Strain</Text>
                </View>
                <View style={styles.whoopStatDivider} />
                <View style={styles.whoopStatItem}>
                  <Text style={styles.whoopStatValue}>
                    {latestWhoopMetrics.sleepDurationSeconds > 0 ? formatSleepDuration(latestWhoopMetrics.sleepDurationSeconds) : '\u2014'}
                  </Text>
                  <Text style={styles.whoopStatLabel}>Sleep</Text>
                </View>
              </View>
              {latestWhoopMetrics.recoveryScore > 0 ? (
                <View style={styles.suggestionPill}>
                  <Shield size={13} color={Colors.whoop} />
                  <Text style={styles.suggestionText}>
                    {getRecoveryIntensitySuggestion(latestWhoopMetrics.recoveryScore)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : whoopConnected ? (
          <View style={styles.whoopDataCard}>
            <View style={[styles.cardAccentStripe, { backgroundColor: Colors.whoop }]} />
            <View style={styles.cardInner}>
              <Text style={[styles.whoopDataTitle, { color: Colors.whoop }]}>WHOOP Data</Text>
              <Text style={styles.noDataText}>No WHOOP data available yet. Try syncing.</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.footerInfo}>
          <Text style={styles.footerText}>
            Connected integrations sync automatically when the app opens. Use manual sync to refresh immediately.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 2,
    paddingHorizontal: 24,
    marginTop: 20,
    marginBottom: 12,
  },
  integrationCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden' as const,
  },
  cardAccentStripe: {
    height: 3,
    width: '100%' as const,
  },
  cardInner: {
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    overflow: 'hidden' as const,
  },
  logoImage: {
    width: 30,
    height: 30,
  },
  cardTitleArea: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  statusIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  errorBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,82,82,0.08)',
    borderRadius: 10,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 11,
    color: Colors.danger,
    fontWeight: '500' as const,
  },
  configBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.warning + '10',
    borderRadius: 10,
  },
  configBannerText: {
    flex: 1,
    fontSize: 11,
    color: Colors.warning,
    fontWeight: '500' as const,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: 14,
    marginTop: 12,
    paddingHorizontal: 2,
  },
  metaItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 14,
  },
  connectedActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  disconnectButton: {
    flex: 0,
    width: 42,
    backgroundColor: 'rgba(255,82,82,0.08)',
    borderColor: 'rgba(255,82,82,0.15)',
  },
  primaryButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  connectButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  whoopDataCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: Colors.whoop + '20',
    overflow: 'hidden' as const,
  },
  whoopDataTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  whoopStatsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-around' as const,
    marginBottom: 14,
  },
  whoopStatItem: {
    alignItems: 'center' as const,
    flex: 1,
  },
  whoopStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  whoopStatValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
  },
  whoopStatLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 4,
    fontWeight: '500' as const,
    letterSpacing: 0.3,
  },
  suggestionPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.whoopDark,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.whoop,
    flex: 1,
  },
  noDataText: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center' as const,
    paddingVertical: 16,
  },
  footerInfo: {
    marginHorizontal: 24,
    marginTop: 8,
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  footerText: {
    fontSize: 12,
    color: Colors.textTertiary,
    lineHeight: 18,
    textAlign: 'center' as const,
  },
});
