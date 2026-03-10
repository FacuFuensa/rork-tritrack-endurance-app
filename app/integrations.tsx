import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ExternalLink, RefreshCw, CheckCircle, XCircle, Zap } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/providers/AuthProvider';

const WEB_APP_URL = 'https://ironlog-inky.vercel.app';

interface ConnectionStatus {
  strava: boolean;
  garmin: boolean;
}

export default function IntegrationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [status, setStatus] = useState<ConnectionStatus>({ strava: false, garmin: false });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('strava_access_token, strava_athlete_id')
        .eq('id', userId)
        .maybeSingle();

      const { count: garminCount } = await supabase
        .from('activities')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('source', 'garmin');

      setStatus({
        strava: !!(data?.strava_access_token && data?.strava_athlete_id),
        garmin: (garminCount ?? 0) > 0,
      });
    } catch (e) {
      console.log('[Integrations] Status check error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  const handleRefresh = () => {
    setRefreshing(true);
    checkStatus();
  };

  const openWebApp = (path = '') => {
    Linking.openURL(WEB_APP_URL + path);
  };

  const integrations = [
    {
      key: 'strava',
      name: 'Strava',
      description: 'Auto-syncs all your activities — runs, rides, swims.',
      color: '#FC4C02',
      connected: status.strava,
      path: '/dashboard?tab=settings',
    },
    {
      key: 'garmin',
      name: 'Garmin',
      description: 'Import your Garmin workouts via ZIP file upload.',
      color: '#009CDE',
      connected: status.garmin,
      path: '/dashboard?tab=settings',
    },
  ];

  return (
    <LinearGradient
      colors={[Colors.gradientStart, Colors.gradientMid, Colors.gradientEnd]}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Integrations</Text>
        <TouchableOpacity style={styles.backBtn} onPress={handleRefresh} activeOpacity={0.7}>
          {refreshing
            ? <ActivityIndicator size="small" color={Colors.textSecondary} />
            : <RefreshCw size={18} color={Colors.textSecondary} />
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerIconWrap}>
            <Zap size={22} color="#f5622e" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Manage on IronLog Web</Text>
            <Text style={styles.bannerBody}>
              Connect Strava and import Garmin files on the web app. Your data syncs instantly to this app.
            </Text>
          </View>
        </View>

        {/* Status cards */}
        <Text style={styles.sectionLabel}>CONNECTION STATUS</Text>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : (
          integrations.map((item) => (
            <View key={item.key} style={styles.card}>
              <View style={[styles.cardStripe, { backgroundColor: item.color }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <View>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <Text style={styles.cardDesc}>{item.description}</Text>
                  </View>
                  {item.connected ? (
                    <View style={styles.badge}>
                      <CheckCircle size={14} color={Colors.success} />
                      <Text style={[styles.badgeText, { color: Colors.success }]}>Connected</Text>
                    </View>
                  ) : (
                    <View style={[styles.badge, styles.badgeOff]}>
                      <XCircle size={14} color={Colors.textTertiary} />
                      <Text style={[styles.badgeText, { color: Colors.textTertiary }]}>Not connected</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.connectBtn, { borderColor: item.color + '50' }]}
                  onPress={() => openWebApp(item.path)}
                  activeOpacity={0.8}
                >
                  <ExternalLink size={14} color={item.color} />
                  <Text style={[styles.connectBtnText, { color: item.color }]}>
                    {item.connected ? 'Manage on Web' : 'Connect on Web'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Open web app button */}
        <TouchableOpacity
          style={styles.openWebBtn}
          onPress={() => openWebApp()}
          activeOpacity={0.85}
        >
          <ExternalLink size={18} color="#fff" />
          <Text style={styles.openWebBtnText}>Open IronLog Web App</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          After connecting on the web, pull to refresh here to update status.
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18, fontWeight: '700', color: Colors.textPrimary, letterSpacing: 0.3,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  banner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: 'rgba(245,98,46,0.08)',
    borderWidth: 1, borderColor: 'rgba(245,98,46,0.2)',
    borderRadius: 16, padding: 16, marginTop: 8, marginBottom: 24,
  },
  bannerIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(245,98,46,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  bannerTitle: {
    fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4,
  },
  bannerBody: {
    fontSize: 13, color: Colors.textSecondary, lineHeight: 19,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textTertiary,
    letterSpacing: 2, marginBottom: 12,
  },
  card: {
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 14,
  },
  cardStripe: { height: 3 },
  cardBody: { padding: 16 },
  cardRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 14,
  },
  cardName: {
    fontSize: 17, fontWeight: '700', color: Colors.textPrimary,
  },
  cardDesc: {
    fontSize: 12, color: Colors.textSecondary, marginTop: 3, maxWidth: 200,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, backgroundColor: Colors.success + '15',
  },
  badgeOff: { backgroundColor: 'rgba(255,255,255,0.06)' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  connectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 11, borderRadius: 12,
    borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  connectBtnText: { fontSize: 14, fontWeight: '600' },
  openWebBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 15, borderRadius: 14,
    backgroundColor: '#f5622e', marginTop: 8,
  },
  openWebBtnText: {
    fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.3,
  },
  hint: {
    fontSize: 12, color: Colors.textTertiary,
    textAlign: 'center', marginTop: 16, lineHeight: 18,
  },
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
});
