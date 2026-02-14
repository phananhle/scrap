import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export default function EntriesPlaceholderScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Past entries</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    opacity: 0.7,
  },
});
