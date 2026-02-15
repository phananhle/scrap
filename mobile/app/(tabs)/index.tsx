import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { View as ThemedView } from '@/components/Themed';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <Pressable style={styles.plusBtn} onPress={() => router.push('/journal')}>
        <Ionicons name="add" size={48} color="#fff" />
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
