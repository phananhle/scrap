import React from 'react';
import { Tabs } from 'expo-router';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { display: 'none' },
        headerShown: useClientOnlyValue(false, true),
        headerTitle: 'Journal',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Journal' }} />
      <Tabs.Screen
        name="two"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
