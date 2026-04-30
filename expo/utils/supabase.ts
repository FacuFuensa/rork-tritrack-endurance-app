import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const hasCredentials = Boolean(supabaseUrl && supabaseAnonKey);

const NETWORK_RETRY_DELAY_MS = 450;

function getFetchUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (typeof URL !== 'undefined' && input instanceof URL) return input.toString();
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return String(input);
}

function createNetworkFailureResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : 'Network request failed';
  return new Response(
    JSON.stringify({
      error: 'network_request_failed',
      message,
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const supabaseFetch: typeof fetch = async (input, init) => {
  const url = getFetchUrl(input);

  try {
    const response = await fetch(input, init);
    if (response.status !== 503) return response;

    console.warn('[Supabase] 503 response, retrying once:', url);
    await delay(NETWORK_RETRY_DELAY_MS);
    return await fetch(input, init);
  } catch (error) {
    console.warn('[Supabase] Network request failed after retry:', url, error);
    try {
      await delay(NETWORK_RETRY_DELAY_MS);
      return await fetch(input, init);
    } catch (retryError) {
      console.warn('[Supabase] Network retry failed, returning recoverable response:', url, retryError);
      return createNetworkFailureResponse(retryError);
    }
  }
};

if (!hasCredentials) {
  console.error('[Supabase] MISSING credentials. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

const storageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.error('[Supabase] Storage getItem error:', e);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.error('[Supabase] Storage setItem error:', e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.error('[Supabase] Storage removeItem error:', e);
    }
  },
};

const safeUrl = supabaseUrl || 'https://placeholder.supabase.co';
const safeKey = supabaseAnonKey || 'placeholder-key';

export const supabase: SupabaseClient = createClient(safeUrl, safeKey, {
  global: {
    fetch: supabaseFetch,
  },
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

export function isSupabaseConfigured(): boolean {
  return hasCredentials;
}
