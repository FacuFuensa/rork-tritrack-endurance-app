export type DistanceUnit = 'meters' | 'km' | 'yards' | 'miles';

export type EventStatus = 'interested' | 'confirmed';

export interface WorkoutConfig {
  id: string;
  name: string;
  emoji: string;
  color: string;
  darkColor: string;
  distanceUnit: DistanceUnit;
  fields: string[];
  fieldLabels?: Record<string, string>;
  isDefault?: boolean;
  showInSummaries?: boolean;
}

export interface Workout {
  id: string;
  type: string;
  distance: number;
  time: number;
  laps?: number;
  elevation?: number;
  avgSpeed?: number;
  customValues?: Record<string, number>;
  sourceProvider?: string;
  externalId?: string;
}

export interface Supplement {
  id: string;
  name: string;
  dose: string;
  isCustom: boolean;
}

export interface RecoveryOption {
  id: string;
  name: string;
  weeklyGoal?: number;
  trackOnly?: boolean;
}

export interface DailyLog {
  date: string;
  workouts: Workout[];
  supplementsTaken: string[];
  recoveryCompleted: string[];
}

export interface GoalEventDistance {
  discipline: string;
  distance: number;
  unit: DistanceUnit;
}

export interface GoalEvent {
  type: string;
  distances: GoalEventDistance[];
}

export interface TrainingEvent {
  id: string;
  type: string;
  name: string;
  eventDate: string;
  location: string;
  notes: string;
  status: EventStatus;
  goalEvent: GoalEvent;
}

export interface UserProfile {
  name: string;
  photoUri: string;
  eventName: string;
  eventDate: string;
  goalEvent?: GoalEvent;
  showProgressPopup: boolean;
  activeEventId: string;
  onboardingComplete: boolean;
}

export interface WeeklyStats {
  totalTime: number;
  totalDistance: number;
  swimDistance: number;
  swimTime: number;
  bikeDistance: number;
  bikeTime: number;
  runDistance: number;
  runTime: number;
  supplementAdherence: number;
  sessionsCount: number;
}

export interface RecoveryAllTimeStats {
  [recoveryId: string]: number;
}

export interface RecoveryWeeklySummary {
  id: string;
  name: string;
  daysCompleted: number;
  weeklyGoal: number;
}

export interface AllTimeStats {
  totalSessions: number;
  currentStreak: number;
  totalMiles: number;
  swimTotal: number;
  swimLongest: number;
  bikeTotal: number;
  bikeLongest: number;
  runTotal: number;
  runLongest: number;
  totalTrainingTime: number;
  swimBestPace: number;
  bikeBestSpeed: number;
  runBestPace: number;
}

export type IntegrationType = 'healthkit' | 'strava' | 'whoop' | 'garmin';

export type IntegrationStatus = 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'error' | 'needs_reauth' | 'not_available';

export interface IntegrationConfig {
  type: IntegrationType;
  status: IntegrationStatus;
  lastSyncAt?: string;
  lastSuccessfulSyncAt?: string;
  autoSync: boolean;
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  error?: string;
  importedCount?: number;
  tokenExpiresAt?: string;
}

export interface SourcePreferences {
  swim: IntegrationType;
  bike: IntegrationType;
  run: IntegrationType;
}

export interface WhoopData {
  recoveryScore: number;
  strain: number;
  sleepScore: number;
  hrv: number;
  lastUpdated: string;
}

export interface WhoopDailyMetrics {
  date: string;
  recoveryScore: number;
  strain: string;
  sleepDurationSeconds: number;
  rawRecovery: number;
  rawStrain: number;
  rawSleepSeconds: number;
  manualOverride: boolean;
  syncedAt: string;
}

export interface WhoopRawFetchResult {
  date: string;
  rawRecoveryScore: number;
  rawStrain: number;
  rawSleepDurationSeconds: number;
}

export interface WhoopSyncState {
  dailyMetrics: Record<string, WhoopDailyMetrics>;
  lastSyncTime: string;
  lastSyncError?: string;
}

export interface ImportedWorkout {
  id: string;
  sourceId: string;
  source: IntegrationType;
  type: string;
  distance: number;
  time: number;
  heartRate?: number;
  calories?: number;
  elevation?: number;
  pace?: number;
  avgSpeedKmh?: number;
  laps?: number;
  date: string;
  startTime?: string;
  importedAt: string;
}

export interface SharingToggles {
  shareWorkouts: boolean;
  shareBests: boolean;
  shareRecovery: boolean;
  shareEvents: boolean;
}

export type PrivacySetting = 'everything' | 'best_stats' | 'nothing';

export interface UserAccount {
  id: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  provider: 'email' | 'google';
  createdAt: string;
  lastLoginAt: string;
}

export interface NameTag {
  tag: string;
  createdAt: string;
  changesLeft: number;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromNameTag: string;
  fromDisplayName: string;
  fromPhotoUrl?: string;
  toUserId: string;
  toNameTag: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface Friend {
  id: string;
  userId: string;
  nameTag: string;
  displayName: string;
  photoUrl?: string;
  addedAt: string;
  isBlocked: boolean;
}

export interface SharedStats {
  totalWorkouts: number;
  bestRunDistance: number;
  longestRide: number;
  swimTotal: number;
  currentStreak: number;
  totalTrainingTime: number;
}

export interface InviteLink {
  id: string;
  code: string;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  usedBy?: string;
  usedAt?: string;
}
