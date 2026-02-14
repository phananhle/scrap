import { useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useUser } from '@/hooks/useUser';
import { notificationService } from '@/services/notificationService';
import { UserCard } from '@/ui/UserCard';

export default function TabOneScreen() {
  const { user, loading, error, refetch } = useUser();
  const [sending, setSending] = useState(false);

  const handleSendNotification = async () => {
    setSending(true);
    try {
      await notificationService.send({ title: 'Scrap', body: 'Notification sent from app' });
      Alert.alert('Notification sent');
    } catch (e) {
      Alert.alert('Failed', e instanceof Error ? e.message : 'Could not send notification');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tab One</Text>
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
      <UserCard user={user} loading={loading} error={error} />
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={handleSendNotification}
        disabled={sending}
      >
        <Text style={styles.buttonText}>{sending ? 'Sending…' : 'Send notification'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
  button: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
