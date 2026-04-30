import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const hasCredentials = Boolean(supabaseUrl && supabaseAnonKey);

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

const supabaseFetch: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (error) {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
    console.warn('[Supabase] Network request failed:', url, error);
    return createNetworkFailureResponse(error);
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
