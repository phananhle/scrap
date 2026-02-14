import * as MediaLibrary from 'expo-media-library';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import { Text as ThemedText, View as ThemedView } from '@/components/Themed';

const RECENT_COUNT = 10;
const GAP = 8;
const CONTENT_WIDTH = Dimensions.get('window').width - 40;
const CELL_SIZE = (CONTENT_WIDTH - GAP) / 2;
const PLACEHOLDER_MIN_HEIGHT = 120;

export function PhotoStrip() {
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const loadRecentPhotos = useCallback(async () => {
    if (Platform.OS === 'web') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setPermissionDenied(false);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        setPhotoUris([]);
        setLoading(false);
        return;
      }
      const { assets } = await MediaLibrary.getAssetsAsync({
        first: RECENT_COUNT,
        mediaType: MediaLibrary.MediaType.photo,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });
      const uris: string[] = [];
      for (const asset of assets) {
        try {
          const info = await MediaLibrary.getAssetInfoAsync(asset.id);
          if (info.localUri) uris.push(info.localUri);
        } catch {
          // skip if we can't get localUri
        }
      }
      setPhotoUris(uris);
    } catch {
      setPhotoUris([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecentPhotos();
  }, [loadRecentPhotos]);

  if (Platform.OS === 'web') {
    return (
      <ThemedView style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Recent photos</ThemedText>
        <View style={[styles.placeholder, styles.centered]}>
          <ThemedText style={styles.placeholderText}>
            Your 10 most recent photos appear here in the app.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (permissionDenied) {
    return (
      <ThemedView style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Recent photos</ThemedText>
        <View style={[styles.placeholder, styles.centered]}>
          <ThemedText style={styles.placeholderText}>
            Photo library access is needed to show your recent photos.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Recent photos</ThemedText>
        <View style={[styles.placeholder, styles.centered]}>
          <ActivityIndicator size="small" />
        </View>
      </ThemedView>
    );
  }

  if (photoUris.length === 0) {
    return (
      <ThemedView style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Recent photos</ThemedText>
        <View style={[styles.placeholder, styles.centered]}>
          <ThemedText style={styles.placeholderText}>No photos in your library.</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.section}>
      <ThemedText style={styles.sectionTitle}>Your 10 most recent photos</ThemedText>
      <View style={styles.grid}>
        {photoUris.map((uri, index) => (
          <Image
            key={`${uri}-${index}`}
            source={{ uri }}
            style={[styles.cell, { width: CELL_SIZE, height: CELL_SIZE }]}
          />
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    borderRadius: 10,
    backgroundColor: '#eee',
  },
  placeholder: {
    minHeight: PLACEHOLDER_MIN_HEIGHT,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    opacity: 0.8,
    textAlign: 'center',
  },
});
