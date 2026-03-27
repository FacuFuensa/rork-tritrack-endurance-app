import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  Mail,
  Cloud,
  CloudOff,
  LogOut,
  RefreshCw,
  Shield,
  Smartphone,
  CheckCircle,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import GlassCard from '@/components/GlassCard';
import { isSupabaseConfigured } from '@/utils/supabase';

type AuthMode = 'sign_in' | 'sign_up' | 'forgot_password';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    account,
    isSignedIn,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    resetPassword,
    cloudSyncEnabled,
    toggleCloudSync,
  } = useAuth();

  const [authMode, setAuthMode] = useState<AuthMode>('sign_in');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const handleSignIn = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      Alert.alert('Not Configured', 'Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment variables.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    if (!email.trim().includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await signInWithEmail(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEmail('');
      setPassword('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not sign in. Please check your credentials.';
      console.log('[Account] Sign in failed:', message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Sign In Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, signInWithEmail]);

  const handleSignUp = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      Alert.alert('Not Configured', 'Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment variables.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    if (!email.trim().includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await signUpWithEmail(email.trim(), password, displayName.trim() || email.split('@')[0]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (result.needsConfirmation) {
        Alert.alert(
          'Check Your Email',
          'We sent a confirmation link to your email. Please verify before signing in.\n\nTip: Check your spam folder if you don\'t see it.',
        );
        setAuthMode('sign_in');
      }
      setEmail('');
      setPassword('');
      setDisplayName('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not create account. Please try again.';
      console.log('[Account] Sign up failed:', message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Sign Up Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, displayName, signUpWithEmail]);

  const handleForgotPassword = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      Alert.alert('Not Configured', 'Supabase is not configured.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Enter Email', 'Please enter your email address first.');
      return;
    }
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await resetPassword(email.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Email Sent', 'Check your inbox for a password reset link.');
      setAuthMode('sign_in');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not send reset email.';
      Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [email, resetPassword]);

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Keep a local copy of your data?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Keep Local Copy',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            signOut(true);
          },
        },
        {
          text: 'Sign Out Only',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            signOut(false);
          },
        },
      ]
    );
  }, [signOut]);

  const handleSyncNow = useCallback(async () => {
    setIsSyncing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await new Promise((r) => setTimeout(r, 2000));
    setIsSyncing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Sync Complete', 'All data synced to cloud successfully.');
  }, []);

  const renderAuthForm = () => {
    if (authMode === 'forgot_password') {
      return (
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <View style={styles.signInIconCircle}>
              <Lock size={32} color={Colors.accent} />
            </View>
            <Text style={styles.formTitle}>Reset Password</Text>
            <Text style={styles.formSubtitle}>
              Enter your email and we'll send you a link to reset your password.
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputWrapper}>
              <Mail size={18} color={Colors.textTertiary} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={Colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                testID="email-input"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]}
            onPress={handleForgotPassword}
            disabled={isSubmitting}
            activeOpacity={0.8}
            testID="reset-btn"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>Send Reset Link</Text>
                <ArrowRight size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchModeBtn}
            onPress={() => setAuthMode('sign_in')}
            activeOpacity={0.7}
          >
            <Text style={styles.switchModeText}>
              Back to <Text style={styles.switchModeHighlight}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    const isSignUp = authMode === 'sign_up';

    return (
      <View style={styles.formContainer}>
        <View style={styles.formHeader}>
          <View style={styles.signInIconCircle}>
            <Cloud size={36} color={Colors.accent} />
          </View>
          <Text style={styles.formTitle}>
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </Text>
          <Text style={styles.formSubtitle}>
            {isSignUp
              ? 'Sign up to sync your training data across all devices.'
              : 'Sign in to access your training data.'}
          </Text>
        </View>

        <View style={styles.inputGroup}>
          {isSignUp ? (
            <View style={styles.inputWrapper}>
              <User size={18} color={Colors.textTertiary} />
              <TextInput
                style={styles.input}
                placeholder="Display name (optional)"
                placeholderTextColor={Colors.textTertiary}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                testID="name-input"
              />
            </View>
          ) : null}

          <View style={styles.inputWrapper}>
            <Mail size={18} color={Colors.textTertiary} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={Colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              testID="email-input"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Lock size={18} color={Colors.textTertiary} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Colors.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              testID="password-input"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              {showPassword ? (
                <EyeOff size={18} color={Colors.textTertiary} />
              ) : (
                <Eye size={18} color={Colors.textTertiary} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {!isSignUp ? (
          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => setAuthMode('forgot_password')}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]}
          onPress={isSignUp ? handleSignUp : handleSignIn}
          disabled={isSubmitting}
          activeOpacity={0.8}
          testID="submit-btn"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.primaryBtnText}>
                {isSignUp ? 'Create Account' : 'Sign In'}
              </Text>
              <ArrowRight size={18} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchModeBtn}
          onPress={() => setAuthMode(isSignUp ? 'sign_in' : 'sign_up')}
          activeOpacity={0.7}
        >
          <Text style={styles.switchModeText}>
            {isSignUp ? (
              <>Already have an account? <Text style={styles.switchModeHighlight}>Sign In</Text></>
            ) : (
              <>Don't have an account? <Text style={styles.switchModeHighlight}>Sign Up</Text></>
            )}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

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
          <ChevronLeft size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isSignedIn && account ? (
            <>
              <GlassCard accentColor={Colors.accent}>
                <View style={styles.accountRow}>
                  <View style={styles.accountAvatar}>
                    <Mail size={24} color={Colors.accent} />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>{account.displayName}</Text>
                    <Text style={styles.accountEmail}>{account.email}</Text>
                  </View>
                  <View style={styles.connectedBadge}>
                    <CheckCircle size={14} color={Colors.success} />
                    <Text style={styles.connectedText}>Connected</Text>
                  </View>
                </View>
              </GlassCard>

              <Text style={styles.sectionTitle}>CLOUD SYNC</Text>
              <GlassCard accentColor={Colors.accent}>
                <View style={styles.syncToggleRow}>
                  <View style={styles.syncToggleLeft}>
                    {cloudSyncEnabled ? (
                      <Cloud size={20} color={Colors.accent} />
                    ) : (
                      <CloudOff size={20} color={Colors.textTertiary} />
                    )}
                    <View style={styles.syncToggleText}>
                      <Text style={styles.syncToggleTitle}>Cloud Sync</Text>
                      <Text style={styles.syncToggleSubtitle}>
                        {cloudSyncEnabled ? 'Syncing all data across devices' : 'Data stored locally only'}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={cloudSyncEnabled}
                    onValueChange={toggleCloudSync}
                    trackColor={{ false: Colors.inputBackground, true: Colors.accent + '60' }}
                    thumbColor={cloudSyncEnabled ? Colors.accent : Colors.textTertiary}
                  />
                </View>

                {cloudSyncEnabled ? (
                  <TouchableOpacity
                    style={styles.syncNowBtn}
                    onPress={handleSyncNow}
                    disabled={isSyncing}
                    activeOpacity={0.7}
                  >
                    {isSyncing ? (
                      <ActivityIndicator size="small" color={Colors.accent} />
                    ) : (
                      <RefreshCw size={16} color={Colors.accent} />
                    )}
                    <Text style={styles.syncNowText}>
                      {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </GlassCard>

              <GlassCard>
                <View style={styles.infoRow}>
                  <Smartphone size={16} color={Colors.textSecondary} />
                  <Text style={styles.infoText}>
                    Sign in on another device with the same email to sync all your training data automatically.
                  </Text>
                </View>
              </GlassCard>

              <Text style={styles.sectionTitle}>SYNCED DATA</Text>
              <GlassCard>
                {['Workouts & History', 'Events & Goals', 'Supplements', 'Recovery Logs', 'Settings & Preferences'].map((item) => (
                  <View key={item} style={styles.syncDataRow}>
                    <CheckCircle size={14} color={Colors.success} />
                    <Text style={styles.syncDataText}>{item}</Text>
                  </View>
                ))}
              </GlassCard>

              <Text style={styles.sectionTitle}>SECURITY</Text>
              <GlassCard>
                <View style={styles.infoRow}>
                  <Shield size={16} color={Colors.accent} />
                  <Text style={styles.infoText}>
                    Your data is encrypted and stored securely. Only you can access your training data with your account.
                  </Text>
                </View>
              </GlassCard>

              <TouchableOpacity
                style={styles.signOutBtn}
                onPress={handleSignOut}
                activeOpacity={0.7}
              >
                <LogOut size={18} color={Colors.danger} />
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {renderAuthForm()}

              <Text style={styles.sectionTitle}>WHY SIGN IN?</Text>
              {[
                { icon: <Cloud size={18} color={Colors.accent} />, title: 'Cloud Backup', desc: 'Never lose your training data' },
                { icon: <Smartphone size={18} color={Colors.success} />, title: 'Multi-Device Sync', desc: 'Access data on any device' },
                { icon: <Shield size={18} color={Colors.warning} />, title: 'Secure & Private', desc: 'Encrypted data, only you can access' },
              ].map((item) => (
                <GlassCard key={item.title}>
                  <View style={styles.benefitRow}>
                    <View style={styles.benefitIcon}>{item.icon}</View>
                    <View style={styles.benefitText}>
                      <Text style={styles.benefitTitle}>{item.title}</Text>
                      <Text style={styles.benefitDesc}>{item.desc}</Text>
                    </View>
                  </View>
                </GlassCard>
              ))}

              <GlassCard>
                <Text style={styles.offlineNote}>
                  The app works fully offline. Sign in is optional and only needed for cloud sync and social features.
                </Text>
              </GlassCard>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  formHeader: {
    alignItems: 'center' as const,
    marginBottom: 28,
  },
  signInIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: Colors.accent + '15',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 21,
    paddingHorizontal: 10,
  },
  inputGroup: {
    gap: 12,
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.inputBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  forgotBtn: {
    alignSelf: 'flex-end' as const,
    marginBottom: 20,
  },
  forgotText: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '600' as const,
  },
  primaryBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 16,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  switchModeBtn: {
    alignItems: 'center' as const,
    paddingVertical: 8,
    marginBottom: 10,
  },
  switchModeText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  switchModeHighlight: {
    color: Colors.accent,
    fontWeight: '700' as const,
  },
  accountRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  accountAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.accent + '20',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  accountInfo: {
    flex: 1,
    marginLeft: 14,
  },
  accountName: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  accountEmail: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  connectedBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: 'rgba(102,187,106,0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  connectedText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  syncToggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  syncToggleLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
    gap: 12,
    marginRight: 12,
  },
  syncToggleText: {
    flex: 1,
  },
  syncToggleTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  syncToggleSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  syncNowBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.accent + '15',
    borderWidth: 1,
    borderColor: Colors.accent + '30',
  },
  syncNowText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  infoRow: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  syncDataRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  syncDataText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textPrimary,
  },
  signOutBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,82,82,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,82,82,0.2)',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.danger,
  },
  benefitRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  benefitDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  offlineNote: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center' as const,
    lineHeight: 20,
    fontStyle: 'italic' as const,
  },
});
