import { useAuthToken } from '@convex-dev/auth/react';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

/**
 * Root index: redirects to sign-in if unauthenticated, otherwise to main (tabs).
 */
export default function IndexScreen() {
  const token = useAuthToken();
  const router = useRouter();

  useEffect(() => {
    if (token === undefined) return; // still loading
    if (token) {
      router.replace('/(tabs)');
    } else {
      router.replace('/sign-in');
    }
  }, [token, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
