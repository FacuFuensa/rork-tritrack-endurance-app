import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Activity,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import { isSupabaseConfigured } from '@/utils/supabase';

type AuthMode = 'sign_in' | 'sign_up' | 'forgot_password';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signInWithEmail, signUpWithEmail, resetPassword } = useAuth();

  const [authMode, setAuthMode] = useState<AuthMode>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      Alert.alert('Not Configured', 'Authentication is not configured yet.');
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not sign in.';
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Sign In Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, signInWithEmail]);

  const handleSignUp = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      Alert.alert('Not Configured', 'Authentication is not configured yet.');
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
          'We sent a confirmation link to your email. Please verify before signing in.\n\nTip: Check your spam folder.',
        );
        setAuthMode('sign_in');
      }
      setEmail('');
      setPassword('');
      setDisplayName('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not create account.';
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Sign Up Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, displayName, signUpWithEmail]);

  const handleForgotPassword = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      Alert.alert('Not Configured', 'Authentication is not configured yet.');
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

  const isSignUp = authMode === 'sign_up';

  return (
    <LinearGradient
      colors={[Colors.gradientStart, Colors.gradientMid, Colors.gradientEnd]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
  <Image
    source={require('@/assets/images/icon.png')}
    style={styles.logoCircle}
    resizeMode="contain"
  />
  <Text style={styles.appName}>TriTrack</Text>
  <Text style={styles.appTagline}>Your training companion</Text>
</View>

          {authMode === 'forgot_password' ? (
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Reset Password</Text>
              <Text style={styles.formSubtitle}>
                Enter your email and we'll send you a reset link.
              </Text>

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
          ) : (
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>
                {isSignUp ? 'Create Account' : 'Welcome Back'}
              </Text>
              <Text style={styles.formSubtitle}>
                {isSignUp
                  ? 'Sign up to start tracking your training.'
                  : 'Sign in to access your training data.'}
              </Text>

              <View style={styles.inputGroup}>
                {isSignUp && (
                  <View style={styles.inputWrapper}>
                    <User size={18} color={Colors.textTertiary} />
                    <TextInput
                      style={styles.input}
                      placeholder="Display name"
                      placeholderTextColor={Colors.textTertiary}
                      value={displayName}
                      onChangeText={setDisplayName}
                      autoCapitalize="words"
                      testID="name-input"
                    />
                  </View>
                )}

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
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color={Colors.textTertiary} />
                    ) : (
                      <Eye size={18} color={Colors.textTertiary} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {!isSignUp && (
                <TouchableOpacity
                  style={styles.forgotBtn}
                  onPress={() => setAuthMode('forgot_password')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              )}

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
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center' as const,
    marginBottom: 40,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  appTagline: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  formContainer: {
    flex: 1,
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
    lineHeight: 21,
    marginBottom: 28,
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
    paddingVertical: 16,
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
  },
  switchModeText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  switchModeHighlight: {
    color: Colors.accent,
    fontWeight: '700' as const,
  },
});
