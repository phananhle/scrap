/**
 * Presentational component: displays user info. Consumes data from parent (screens pass useUser() result).
 */

import { StyleSheet, Text, View } from 'react-native';
import type { User } from '@/types/user';

interface UserCardProps {
  user: User | null;
  loading?: boolean;
  error?: Error | null;
}

export function UserCard({ user, loading, error }: UserCardProps) {
  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.text}>Loading…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.card}>
        <Text style={[styles.text, styles.error]}>{error.message}</Text>
      </View>
    );
  }
  if (!user) {
    return (
      <View style={styles.card}>
        <Text style={styles.text}>Not signed in</Text>
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{user.name}</Text>
      <Text style={styles.text}>{user.email}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
  text: {
    fontSize: 14,
    color: '#333',
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  error: {
    color: '#c00',
  },
});
