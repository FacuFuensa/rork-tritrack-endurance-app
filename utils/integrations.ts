import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
import { IntegrationType, ImportedWorkout, WhoopData, WhoopRawFetchResult } from '@/constants/types';
import { whoopTimestampToLocalDate, whoopSleepEndToLocalDate } from '@/utils/whoopMapper';

WebBrowser.maybeCompleteAuthSession();

const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v1';

const WHOOP_CLIENT_ID = process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID ?? '';
const WHOOP_CLIENT_SECRET = process.env.EXPO_PUBLIC_WHOOP_CLIENT_SECRET ?? '';

const WHOOP_SCOPES = [
  'offline',
  'read:recovery',
  'read:cycles',
  'read:workout',
  'read:sleep',
  'read:profile',
  'read:body_measurement',
].join(' ');

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

const STRAVA_CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID ?? '';
const STRAVA_CLIENT_SECRET = process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET ?? '';

function getWhoopRedirectUri(): string {
  const uri = makeRedirectUri({
    scheme: 'rork-app',
    path: 'oauth/whoop',
  });
  console.log('[Integrations] WHOOP Redirect URI:', uri);
  return uri;
}

function getStravaRedirectUri(): string {
  const uri = makeRedirectUri({
    scheme: 'rork-app',
    path: 'oauth/strava',
  });
  console.log('[Integrations] Strava Redirect URI:', uri);
  return uri;
}

export function getWhoopRedirectUriForDisplay(): string {
  return getWhoopRedirectUri();
}

export function getStravaRedirectUriForDisplay(): string {
  return getStravaRedirectUri();
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function buildFormBody(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function mapStravaActivityType(stravaType: string): string {
  const map: Record<string, string> = {
    Run: 'run',
    Ride: 'bike',
    Swim: 'swim',
    VirtualRide: 'bike',
    VirtualRun: 'run',
    Walk: 'run',
    Hike: 'run',
    TrailRun: 'run',
    MountainBikeRide: 'bike',
    GravelRide: 'bike',
    EBikeRide: 'bike',
    Rowing: 'swim',
  };
  return map[stravaType] || 'other';
}

export function isStravaConfigured(): boolean {
  return Boolean(STRAVA_CLIENT_ID && STRAVA_CLIENT_SECRET);
}

export function isWhoopConfigured(): boolean {
  return Boolean(WHOOP_CLIENT_ID && WHOOP_CLIENT_SECRET);
}

export async function connectHealthKit(): Promise<boolean> {
  console.log('[Integrations] Requesting HealthKit permissions...');

  if (Platform.OS === 'web') {
    throw new Error('Apple Health is only available on iOS devices.');
  }

  if (Platform.OS === 'android') {
    throw new Error('Apple Health is only available on iOS. For Android, use Google Fit via Strava.');
  }

  throw new Error(
    'Apple Health integration requires a native iOS build with HealthKit entitlements. ' +
    'This feature is not available in Expo Go.\n\n' +
    'Workaround: Connect your Apple Watch to Strava, then use the Strava integration to import workouts.'
  );
}

export async function disconnectHealthKit(): Promise<void> {
  console.log('[Integrations] Disconnecting HealthKit...');
}

export async function fetchHealthKitWorkouts(): Promise<ImportedWorkout[]> {
  console.log('[Integrations] HealthKit not available in Expo Go');
  return [];
}

export async function connectStrava(): Promise<{ accessToken: string; refreshToken: string; userId: string; expiresAt: number }> {
  if (!STRAVA_CLIENT_ID) {
    console.error('[Strava] Missing STRAVA_CLIENT_ID');
    throw new Error(
      'Strava Client ID not configured.\n\nPlease set EXPO_PUBLIC_STRAVA_CLIENT_ID in your environment variables.\n\n' +
      'Get your credentials at: https://www.strava.com/settings/api'
    );
  }
  if (!STRAVA_CLIENT_SECRET) {
    console.error('[Strava] Missing STRAVA_CLIENT_SECRET');
    throw new Error(
      'Strava Client Secret not configured.\n\nPlease set EXPO_PUBLIC_STRAVA_CLIENT_SECRET in your environment variables.'
    );
  }

  if (Platform.OS === 'web') {
    throw new Error(
      'Strava connection requires the mobile app due to browser restrictions (CORS).\n\n' +
      'Please scan the QR code and connect from your phone.'
    );
  }

  const redirectUri = getStravaRedirectUri();

  console.log('[Strava] Starting OAuth flow...');
  console.log('[Strava] Client ID:', STRAVA_CLIENT_ID.substring(0, 6) + '...');
  console.log('[Strava] Redirect URI:', redirectUri);

  const authParams = [
    `client_id=${encodeURIComponent(STRAVA_CLIENT_ID)}`,
    `response_type=code`,
    `redirect_uri=${encodeURIComponent(redirectUri)}`,
    `scope=read,activity:read_all`,
    `approval_prompt=auto`,
  ].join('&');

  const authUrl = `${STRAVA_AUTH_URL}?${authParams}`;
  console.log('[Strava] Opening auth URL...');

  let result: WebBrowser.WebBrowserAuthSessionResult;
  try {
    result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
  } catch (browserError) {
    console.error('[Strava] Browser session error:', browserError);
    throw new Error('Could not open Strava login. Please try again.');
  }

  console.log('[Strava] Auth session result type:', result.type);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('Strava login was cancelled.');
  }

  if (result.type !== 'success' || !result.url) {
    console.error('[Strava] Auth failed, result:', JSON.stringify(result));
    throw new Error('Strava authorization failed. Please try again.');
  }

  console.log('[Strava] Auth callback URL received');

  const parsedUrl = Linking.parse(result.url);
  const code = parsedUrl.queryParams?.code as string | undefined;
  const errorParam = parsedUrl.queryParams?.error as string | undefined;

  if (errorParam) {
    console.error('[Strava] Auth error:', errorParam);
    throw new Error(`Strava authorization error: ${errorParam}`);
  }

  if (!code) {
    console.error('[Strava] No authorization code in callback URL');
    console.error('[Strava] Parsed URL params:', JSON.stringify(parsedUrl.queryParams));
    throw new Error(
      'No authorization code received from Strava.\n\n' +
      'Make sure this redirect URI is registered in your Strava API Application settings:\n' +
      redirectUri
    );
  }

  console.log('[Strava] Got authorization code, exchanging for tokens...');

  const tokenBody = buildFormBody({
    client_id: STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
  });

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    });
  } catch (fetchError) {
    console.error('[Strava] Token exchange network error:', fetchError);
    throw new Error('Network error during Strava token exchange. Please check your connection.');
  }

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text().catch(() => 'unknown');
    console.error('[Strava] Token exchange failed:', tokenResponse.status, errorBody);

    if (tokenResponse.status === 401 || tokenResponse.status === 403) {
      throw new Error('Strava credentials are invalid. Please check your Client ID and Secret.');
    }
    if (tokenResponse.status === 400) {
      throw new Error('Strava authorization code was invalid or expired. Please try again.');
    }
    throw new Error(`Strava token exchange failed (HTTP ${tokenResponse.status}).`);
  }

  let tokenData: Record<string, unknown>;
  try {
    tokenData = await tokenResponse.json();
  } catch {
    throw new Error('Invalid response from Strava during token exchange.');
  }

  const accessToken = tokenData.access_token as string | undefined;
  const refreshToken = tokenData.refresh_token as string | undefined;
  const expiresAt = tokenData.expires_at as number | undefined;
  const athlete = tokenData.athlete as Record<string, unknown> | undefined;

  if (!accessToken) {
    console.error('[Strava] No access_token in response:', JSON.stringify(tokenData));
    throw new Error('Strava did not return an access token.');
  }

  const userId = athlete?.id?.toString() ?? 'strava_user';
  console.log('[Strava] Token exchange successful, user:', userId, 'expires:', expiresAt);

  return {
    accessToken,
    refreshToken: refreshToken ?? '',
    userId,
    expiresAt: expiresAt ?? Math.floor(Date.now() / 1000) + 21600,
  };
}

export async function refreshStravaToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    throw new Error('Strava credentials not configured.');
  }

  console.log('[Strava] Refreshing access token...');

  const body = buildFormBody({
    client_id: STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  let response: Response;
  try {
    response = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (fetchErr) {
    console.error('[Strava] Token refresh network error:', fetchErr);
    throw new Error('Network error refreshing Strava token. Please reconnect.');
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'unknown');
    console.error('[Strava] Token refresh failed:', response.status, errorBody);
    throw new Error('Failed to refresh Strava token. Please reconnect.');
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch {
    throw new Error('Invalid response from Strava during token refresh.');
  }

  console.log('[Strava] Token refreshed successfully');
  return {
    accessToken: data.access_token as string,
    refreshToken: (data.refresh_token as string) ?? refreshToken,
    expiresAt: (data.expires_at as number) ?? Math.floor(Date.now() / 1000) + 21600,
  };
}

export async function disconnectStrava(): Promise<void> {
  console.log('[Integrations] Disconnecting Strava...');
}

export async function fetchStravaActivities(
  accessToken: string,
  afterTimestamp?: number
): Promise<ImportedWorkout[]> {
  console.log('[Strava] Fetching activities...');

  let url = `${STRAVA_API_BASE}/athlete/activities?per_page=50`;
  if (afterTimestamp) {
    url += `&after=${afterTimestamp}`;
  } else {
    const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    url += `&after=${thirtyDaysAgo}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (fetchErr) {
    console.error('[Strava] Fetch activities network error:', fetchErr);
    throw new Error('Network error fetching Strava activities.');
  }

  if (response.status === 401) {
    throw new Error('STRAVA_TOKEN_EXPIRED');
  }

  if (response.status === 429) {
    console.warn('[Strava] Rate limited, backing off...');
    throw new Error('Strava rate limit reached. Please try again in a few minutes.');
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'unknown');
    console.error('[Strava] Fetch activities failed:', response.status, errorBody);
    throw new Error(`Strava API error: ${response.status}`);
  }

  let activities: Record<string, unknown>[];
  try {
    activities = await response.json();
  } catch {
    throw new Error('Invalid response from Strava.');
  }

  console.log(`[Strava] Got ${activities.length} activities`);

  return activities.map((a) => {
    const type = mapStravaActivityType((a.type as string) || (a.sport_type as string) || '');
    const startDateLocal = a.start_date_local as string | undefined;
    const startDate = a.start_date as string | undefined;
    const dateStr = startDateLocal || startDate || new Date().toISOString();
    const d = new Date(dateStr);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const distanceKm = Math.round(((a.distance as number) || 0) / 10) / 100;
    const movingTime = (a.moving_time as number) || (a.elapsed_time as number) || 0;
    const avgSpeedMs = a.average_speed as number | undefined;

    let avgSpeedKmh: number | undefined;
    if (avgSpeedMs && avgSpeedMs > 0) {
      avgSpeedKmh = Math.round(avgSpeedMs * 3.6 * 100) / 100;
    }

    let laps: number | undefined;
    if (type === 'swim' && (a.distance as number) > 0) {
      const poolLength = (a.average_cadence as number) ? undefined : 25;
      if (poolLength) {
        laps = Math.round((a.distance as number) / poolLength);
      }
    }

    console.log(`[Strava] Activity: ${a.name} | type=${type} | dist=${distanceKm}km | time=${movingTime}s | speed=${avgSpeedKmh}km/h | date=${dateKey}`);

    return {
      id: generateId(),
      sourceId: `strava_${a.id}`,
      source: 'strava' as IntegrationType,
      type,
      distance: distanceKm,
      time: movingTime,
      heartRate: a.average_heartrate as number | undefined,
      calories: a.kilojoules ? Math.round((a.kilojoules as number) * 0.239) : undefined,
      elevation: a.total_elevation_gain as number | undefined,
      pace: avgSpeedMs,
      avgSpeedKmh,
      laps,
      date: dateKey,
      startTime: dateStr,
      importedAt: new Date().toISOString(),
    };
  });
}

export async function connectWhoop(): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
  if (!WHOOP_CLIENT_ID) {
    console.error('[WHOOP] Missing WHOOP_CLIENT_ID');
    throw new Error('WHOOP Client ID not configured. Please set EXPO_PUBLIC_WHOOP_CLIENT_ID in your environment.');
  }
  if (!WHOOP_CLIENT_SECRET) {
    console.error('[WHOOP] Missing WHOOP_CLIENT_SECRET');
    throw new Error('WHOOP Client Secret not configured. Please set EXPO_PUBLIC_WHOOP_CLIENT_SECRET in your environment.');
  }

  if (Platform.OS === 'web') {
    throw new Error('WHOOP connection requires the mobile app due to browser restrictions (CORS). Please scan the QR code and connect from your phone.');
  }

  const redirectUri = getWhoopRedirectUri();
  const state = generateId();

  console.log('[WHOOP] Starting OAuth flow...');
  console.log('[WHOOP] Client ID:', WHOOP_CLIENT_ID.substring(0, 8) + '...');
  console.log('[WHOOP] Redirect URI:', redirectUri);
  console.log('[WHOOP] Scopes:', WHOOP_SCOPES);

  const authParams = [
    `response_type=code`,
    `client_id=${encodeURIComponent(WHOOP_CLIENT_ID)}`,
    `redirect_uri=${encodeURIComponent(redirectUri)}`,
    `scope=${encodeURIComponent(WHOOP_SCOPES)}`,
    `state=${encodeURIComponent(state)}`,
  ].join('&');

  const authUrl = `${WHOOP_AUTH_URL}?${authParams}`;

  console.log('[WHOOP] Opening auth URL...');

  let result: WebBrowser.WebBrowserAuthSessionResult;

  try {
    result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
  } catch (browserError) {
    console.error('[WHOOP] Browser session error:', browserError);
    throw new Error('Could not open WHOOP login. Please try again.');
  }

  console.log('[WHOOP] Auth session result type:', result.type);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('WHOOP login was cancelled.');
  }

  if (result.type !== 'success' || !result.url) {
    console.error('[WHOOP] Auth failed, result:', JSON.stringify(result));
    throw new Error('WHOOP authorization failed. Please try again.');
  }

  console.log('[WHOOP] Auth callback URL received');

  const parsedUrl = Linking.parse(result.url);
  const code = parsedUrl.queryParams?.code as string | undefined;
  const returnedState = parsedUrl.queryParams?.state as string | undefined;
  const errorParam = parsedUrl.queryParams?.error as string | undefined;
  const errorDesc = parsedUrl.queryParams?.error_description as string | undefined;

  if (errorParam) {
    console.error('[WHOOP] Auth error:', errorParam, errorDesc);
    if (errorParam === 'invalid_request' && errorDesc?.includes('redirect_uri')) {
      throw new Error(
        'WHOOP redirect URI mismatch.\n\n' +
        'Please register this EXACT redirect URI in your WHOOP Developer Portal → OAuth → Redirect URIs:\n\n' +
        redirectUri +
        '\n\nThen try connecting again.'
      );
    }
    throw new Error(errorDesc ?? `WHOOP authorization error: ${errorParam}`);
  }

  if (!code) {
    console.error('[WHOOP] No authorization code in callback URL');
    console.error('[WHOOP] Parsed URL params:', JSON.stringify(parsedUrl.queryParams));
    throw new Error(
      'No authorization code received from WHOOP.\n\n' +
      'Register this EXACT redirect URI in your WHOOP Developer Portal → OAuth → Redirect URIs:\n\n' +
      redirectUri +
      '\n\nThe URI must match exactly, including the scheme and path.'
    );
  }

  if (returnedState && returnedState !== state) {
    console.warn('[WHOOP] State mismatch - possible CSRF. Expected:', state, 'Got:', returnedState);
  }

  console.log('[WHOOP] Got authorization code, exchanging for tokens...');

  const tokenBody = buildFormBody({
    grant_type: 'authorization_code',
    code,
    client_id: WHOOP_CLIENT_ID,
    client_secret: WHOOP_CLIENT_SECRET,
    redirect_uri: redirectUri,
  });

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenBody,
    });
  } catch (fetchError) {
    console.error('[WHOOP] Token exchange network error:', fetchError);
    throw new Error('Network error during WHOOP token exchange. Please check your connection and try again.');
  }

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text().catch(() => 'unknown');
    console.error('[WHOOP] Token exchange failed:', tokenResponse.status, errorBody);

    if (tokenResponse.status === 401 || tokenResponse.status === 403) {
      throw new Error('WHOOP credentials are invalid. Please check your Client ID and Secret in the environment variables.');
    }
    if (tokenResponse.status === 400) {
      throw new Error('WHOOP authorization code was invalid or expired. Please try connecting again.');
    }
    throw new Error(`WHOOP token exchange failed (HTTP ${tokenResponse.status}). Check that your redirect URI matches the WHOOP Developer Portal.`);
  }

  let tokenData: Record<string, unknown>;
  try {
    tokenData = await tokenResponse.json();
  } catch {
    console.error('[WHOOP] Failed to parse token response');
    throw new Error('Invalid response from WHOOP during token exchange.');
  }

  const accessToken = tokenData.access_token as string | undefined;
  const refreshToken = tokenData.refresh_token as string | undefined;

  if (!accessToken) {
    console.error('[WHOOP] No access_token in response:', JSON.stringify(tokenData));
    throw new Error('WHOOP did not return an access token.');
  }

  console.log('[WHOOP] Token exchange successful, expires_in:', tokenData.expires_in);

  let userId = 'whoop_user';
  try {
    const profileResponse = await fetch(`${WHOOP_API_BASE}/user/profile/basic`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      userId = profile.user_id?.toString() ?? `${profile.first_name}_${profile.last_name}`;
      console.log('[WHOOP] Profile fetched for user:', userId);
    } else {
      console.warn('[WHOOP] Profile fetch failed:', profileResponse.status);
    }
  } catch (profileErr) {
    console.warn('[WHOOP] Profile fetch error (non-critical):', profileErr);
  }

  return {
    accessToken,
    refreshToken: refreshToken ?? '',
    userId,
  };
}

export async function refreshWhoopToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  if (!WHOOP_CLIENT_ID || !WHOOP_CLIENT_SECRET) {
    throw new Error('WHOOP credentials not configured.');
  }

  console.log('[WHOOP] Refreshing access token...');

  const body = buildFormBody({
    grant_type: 'refresh_token',
    client_id: WHOOP_CLIENT_ID,
    client_secret: WHOOP_CLIENT_SECRET,
    scope: 'offline',
    refresh_token: refreshToken,
  });

  let response: Response;
  try {
    response = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
  } catch (fetchErr) {
    console.error('[WHOOP] Token refresh network error:', fetchErr);
    throw new Error('Network error refreshing WHOOP token. Please reconnect.');
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'unknown');
    console.error('[WHOOP] Token refresh failed:', response.status, errorBody);
    throw new Error('Failed to refresh WHOOP token. Please reconnect.');
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch {
    throw new Error('Invalid response from WHOOP during token refresh.');
  }

  console.log('[WHOOP] Token refreshed successfully');
  return {
    accessToken: data.access_token as string,
    refreshToken: (data.refresh_token as string) ?? refreshToken,
  };
}

export async function disconnectWhoop(accessToken?: string): Promise<void> {
  console.log('[WHOOP] Disconnecting...');
  if (accessToken) {
    try {
      await fetch(`${WHOOP_API_BASE}/user/auth`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      console.log('[WHOOP] OAuth access revoked');
    } catch (err) {
      console.warn('[WHOOP] Could not revoke token:', err);
    }
  }
}

export async function fetchWhoopData(accessToken: string): Promise<WhoopData> {
  console.log('[WHOOP] Fetching recovery data (legacy)...');
  const records = await fetchWhoopDailyRecords(accessToken, 1);
  const latest = records[0];

  return {
    recoveryScore: latest?.rawRecoveryScore ?? 0,
    strain: latest ? Math.round(latest.rawStrain * 10) / 10 : 0,
    sleepScore: 0,
    hrv: 0,
    lastUpdated: new Date().toISOString(),
  };
}

export async function fetchWhoopDailyRecords(
  accessToken: string,
  limit: number = 7
): Promise<WhoopRawFetchResult[]> {
  console.log(`[WHOOP] Fetching daily records (limit=${limit})...`);
  const results: Map<string, WhoopRawFetchResult> = new Map();

  try {
    const recoveryResponse = await fetch(
      `${WHOOP_API_BASE}/recovery?limit=${limit}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (recoveryResponse.ok) {
      const recoveryData = await recoveryResponse.json();
      const records = recoveryData.records ?? [];
      console.log(`[WHOOP] Got ${records.length} recovery records`);

      for (const rec of records) {
        if (rec.score_state && rec.score_state !== 'SCORED') {
          console.log(`[WHOOP] Skipping recovery record (score_state=${rec.score_state})`);
          continue;
        }
        const cycleStart = rec.cycle?.start ?? rec.created_at ?? rec.updated_at ?? new Date().toISOString();
        const date = whoopTimestampToLocalDate(cycleStart);
        const existing = results.get(date) ?? { date, rawRecoveryScore: 0, rawStrain: 0, rawSleepDurationSeconds: 0 };
        const recoveryVal = rec.score?.recovery_score ?? 0;
        if (recoveryVal > 0) {
          existing.rawRecoveryScore = recoveryVal;
        }
        results.set(date, existing);
        console.log(`[WHOOP] Recovery for ${date} (from ${cycleStart}):`, existing.rawRecoveryScore, 'raw score obj:', JSON.stringify(rec.score));
      }
    } else if (recoveryResponse.status === 401) {
      throw new Error('WHOOP_TOKEN_EXPIRED');
    } else {
      console.warn('[WHOOP] Failed to fetch recovery:', recoveryResponse.status);
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'WHOOP_TOKEN_EXPIRED') throw err;
    console.warn('[WHOOP] Recovery fetch error:', err);
  }

  try {
    const cycleResponse = await fetch(
      `${WHOOP_API_BASE}/cycle?limit=${limit}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (cycleResponse.ok) {
      const cycleData = await cycleResponse.json();
      const records = cycleData.records ?? [];
      console.log(`[WHOOP] Got ${records.length} cycle records`);

      for (const rec of records) {
        const date = whoopTimestampToLocalDate(rec.start ?? rec.created_at ?? new Date().toISOString());
        const existing = results.get(date) ?? { date, rawRecoveryScore: 0, rawStrain: 0, rawSleepDurationSeconds: 0 };
        const strainVal = rec.score?.strain ?? 0;
        if (strainVal > 0) {
          existing.rawStrain = strainVal;
        }
        results.set(date, existing);
        console.log(`[WHOOP] Strain for ${date} (cycle start: ${rec.start}):`, existing.rawStrain, 'score_state:', rec.score_state);
      }
    } else {
      console.warn('[WHOOP] Failed to fetch cycles:', cycleResponse.status);
    }
  } catch (err) {
    console.warn('[WHOOP] Cycle fetch error:', err);
  }

  try {
    const sleepResponse = await fetch(
      `${WHOOP_API_BASE}/activity/sleep?limit=${limit}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (sleepResponse.ok) {
      const sleepData = await sleepResponse.json();
      const records = sleepData.records ?? [];
      console.log(`[WHOOP] Got ${records.length} sleep records`);

      for (const rec of records) {
        if (rec.nap === true) {
          console.log('[WHOOP] Skipping nap record');
          continue;
        }
        if (rec.score_state && rec.score_state !== 'SCORED') {
          console.log(`[WHOOP] Skipping sleep record (score_state=${rec.score_state})`);
          continue;
        }
        const date = whoopSleepEndToLocalDate(
          rec.start ?? rec.created_at ?? new Date().toISOString(),
          rec.end
        );
        const existing = results.get(date) ?? { date, rawRecoveryScore: 0, rawStrain: 0, rawSleepDurationSeconds: 0 };

        let sleepMillis = 0;
        const stageSummary = rec.score?.stage_summary;
        if (stageSummary) {
          const actualSleep =
            (stageSummary.total_light_sleep_time_milli ?? 0) +
            (stageSummary.total_slow_wave_sleep_time_milli ?? 0) +
            (stageSummary.total_rem_sleep_time_milli ?? 0);
          if (actualSleep > 0) {
            sleepMillis = actualSleep;
          } else if ((stageSummary.total_in_bed_time_milli ?? 0) > 0) {
            const inBed = stageSummary.total_in_bed_time_milli ?? 0;
            const awake = stageSummary.total_awake_time_milli ?? 0;
            sleepMillis = inBed - awake > 0 ? inBed - awake : inBed;
          }
        }
        if (sleepMillis === 0) {
          const durationMilli = rec.score?.sleep_duration_milli ?? 0;
          if (durationMilli > 0) {
            sleepMillis = durationMilli;
          }
        }
        if (sleepMillis === 0) {
          const startMs = rec.start ? new Date(rec.start).getTime() : 0;
          const endMs = rec.end ? new Date(rec.end).getTime() : 0;
          if (startMs > 0 && endMs > startMs) {
            sleepMillis = endMs - startMs;
          }
        }
        if (sleepMillis > 0) {
          existing.rawSleepDurationSeconds = Math.round(sleepMillis / 1000);
        }
        results.set(date, existing);
        console.log(`[WHOOP] Sleep for ${date}:`, existing.rawSleepDurationSeconds, 'seconds, raw score:', JSON.stringify(rec.score?.stage_summary ?? {}));
      }
    } else {
      console.warn('[WHOOP] Failed to fetch sleep:', sleepResponse.status);
    }
  } catch (err) {
    console.warn('[WHOOP] Sleep fetch error:', err);
  }

  const sortedResults = Array.from(results.values()).sort((a, b) => b.date.localeCompare(a.date));
  console.log(`[WHOOP] Total daily records fetched: ${sortedResults.length}`);
  return sortedResults;
}

export async function connectGarmin(): Promise<never> {
  throw new Error(
    'Garmin Health API integration requires approved Garmin Health API partner credentials, ' +
    'which are not currently configured.\n\n' +
    'Alternative: Connect your Garmin device to Strava, then use the Strava integration to import your workouts automatically.'
  );
}

export async function disconnectGarmin(): Promise<void> {
  console.log('[Integrations] Disconnecting Garmin...');
}

export async function fetchGarminActivities(): Promise<ImportedWorkout[]> {
  console.log('[Integrations] Garmin API not available');
  return [];
}

export function isDuplicateWorkout(
  existing: ImportedWorkout[],
  newWorkout: ImportedWorkout
): boolean {
  return existing.some(
    (w) => w.sourceId === newWorkout.sourceId && w.source === newWorkout.source
  );
}

export function getIntegrationDisplayName(type: IntegrationType): string {
  switch (type) {
    case 'healthkit': return 'Apple Health';
    case 'strava': return 'Strava';
    case 'whoop': return 'WHOOP';
    case 'garmin': return 'Garmin';
  }
}

export function getRecoveryIntensitySuggestion(recoveryScore: number): string {
  if (recoveryScore >= 80) return 'High intensity recommended';
  if (recoveryScore >= 50) return 'Moderate intensity recommended';
  return 'Low intensity / recovery day recommended';
}

export function getIntegrationStatusLabel(status: string, error?: string): string {
  switch (status) {
    case 'connected': return 'Connected';
    case 'connecting': return 'Connecting...';
    case 'syncing': return 'Syncing...';
    case 'error': return error ? `Error: ${error}` : 'Error';
    case 'needs_reauth': return 'Needs Re-authorization';
    case 'not_available': return 'Not Available';
    case 'disconnected': return 'Not Connected';
    default: return 'Unknown';
  }
}
