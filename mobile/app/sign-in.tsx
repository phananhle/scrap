import { useAuthActions } from '@convex-dev/auth/react';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const PROVIDER_ID = 'phone';

export default function SignInScreen() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);

  const normalizedPhone = phone.replace(/\D/g, '');
  const phoneValid = normalizedPhone.length >= 10;
  const codeValid = code.length >= 4;

  const handleSendCode = async () => {
    if (!phoneValid) return;
    setLoading(true);
    try {
      const result = await signIn(PROVIDER_ID, {
        phone: normalizedPhone.startsWith('+') ? normalizedPhone : `+1${normalizedPhone}`,
      });
      if (result?.signingIn) {
        router.replace('/(tabs)');
      } else {
        setStep('code');
      }
    } catch (e) {
      const message =
        typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string'
          ? (e as { message: string }).message
          : 'Failed to send code. Check your number and try again.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!phoneValid || !codeValid) return;
    setLoading(true);
    try {
      const result = await signIn(PROVIDER_ID, {
        phone: normalizedPhone.startsWith('+') ? normalizedPhone : `+1${normalizedPhone}`,
        code: code.trim(),
      });
      if (result?.signingIn) {
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Invalid or expired code. Request a new one.');
      }
    } catch (e) {
      const message =
        typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string'
          ? (e as { message: string }).message
          : 'Failed to verify code. Try again.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'phone') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Sign in with your phone</Text>
          <Text style={styles.subtitle}>
            We’ll send you a one-time code by SMS.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="+1 555 123 4567"
            placeholderTextColor="#999"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            editable={!loading}
          />
          <Pressable
            style={[
              styles.button,
              (!phoneValid || loading) && styles.buttonDisabled,
            ]}
            onPress={handleSendCode}
            disabled={!phoneValid || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send code</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Enter the code</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to {phone || 'your number'}.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="000000"
          placeholderTextColor="#999"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          editable={!loading}
        />
        <Pressable
          style={[
            styles.button,
            (!codeValid || loading) && styles.buttonDisabled,
          ]}
          onPress={handleVerifyCode}
          disabled={!codeValid || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.link}
          onPress={() => {
            setStep('phone');
            setCode('');
          }}
          disabled={loading}
        >
          <Text style={styles.linkText}>Use a different number</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0a0a0a',
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#999',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    fontSize: 17,
    color: '#fff',
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  link: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 15,
    color: '#3b82f6',
  },
});
