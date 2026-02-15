import Ionicons from '@expo/vector-icons/Ionicons';
import * as MediaLibrary from 'expo-media-library';
import type { Asset } from 'expo-media-library';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Text as ThemedText, View as ThemedView } from '@/components/Themed';

const RECENT_COUNT = 10;
const PAGE_SIZE = 100;
const MAX_PHOTOS_CAP = 500;
const LOAD_TIMEOUT_MS = 20000;
const GAP = 8;
const CONTENT_WIDTH = Dimensions.get('window').width - 40;
const CELL_SIZE = (CONTENT_WIDTH - GAP) / 2;
const SELECTION_BORDER_WIDTH = 3;
const CELL_SIZE_WITH_BORDER = CELL_SIZE - SELECTION_BORDER_WIDTH * 2; // inner size when border is always reserved
const CELL_RADIUS = 10;
const CELL_RADIUS_WITH_BORDER = CELL_RADIUS - SELECTION_BORDER_WIDTH; // inner radius so content matches border curve
const PLACEHOLDER_MIN_HEIGHT = 120;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Load timed out')), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

interface PhotoStripProps {
  sinceTimestamp?: number;
  sinceLabel?: string;
  selectedUris?: string[];
  onSelectionChange?: (uris: string[]) => void;
}

export function PhotoStrip({
  sinceTimestamp,
  sinceLabel,
  selectedUris = [],
  onSelectionChange,
}: PhotoStripProps) {
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const loadGenRef = useRef(0);

  const loadRecentPhotos = useCallback(async () => {
    if (Platform.OS === 'web') {
      setLoading(false);
      return;
    }
    const gen = ++loadGenRef.current;
    setLoading(true);
    setPermissionDenied(false);
    setLoadError(false);
    const run = async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (gen !== loadGenRef.current) return;
      if (status !== 'granted') {
        setPermissionDenied(true);
        setPhotoUris([]);
        return;
      }

      if (sinceTimestamp != null) {
        const createdBefore = Date.now();
        const allAssets: Asset[] = [];
        let after: string | undefined;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const result = await MediaLibrary.getAssetsAsync({
            first: PAGE_SIZE,
            after,
            mediaType: MediaLibrary.MediaType.photo,
            sortBy: [[MediaLibrary.SortBy.creationTime, false]],
            createdAfter: new Date(sinceTimestamp),
            createdBefore: new Date(createdBefore),
          });
          allAssets.push(...result.assets);
          if (!result.hasNextPage || allAssets.length >= MAX_PHOTOS_CAP) break;
          after = result.endCursor;
        }
        if (gen !== loadGenRef.current) return;
        const filtered = allAssets.filter(
          (a) => a.creationTime >= sinceTimestamp
        );
        const uris: string[] = [];
        const toResolve = filtered.slice(0, MAX_PHOTOS_CAP);
        for (const asset of toResolve) {
          try {
            const info = await MediaLibrary.getAssetInfoAsync(asset.id);
            if (info.localUri) uris.push(info.localUri);
          } catch {
            // skip if we can't get localUri
          }
        }
        if (gen !== loadGenRef.current) return;
        setPhotoUris(uris);
      } else {
        const { assets } = await MediaLibrary.getAssetsAsync({
          first: RECENT_COUNT,
          mediaType: MediaLibrary.MediaType.photo,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });
        if (gen !== loadGenRef.current) return;
        const uris: string[] = [];
        for (const asset of assets) {
          try {
            const info = await MediaLibrary.getAssetInfoAsync(asset.id);
            if (info.localUri) uris.push(info.localUri);
          } catch {
            // skip if we can't get localUri
          }
        }
        if (gen !== loadGenRef.current) return;
        setPhotoUris(uris);
      }
    };
    try {
      await withTimeout(run(), LOAD_TIMEOUT_MS);
    } catch {
      if (gen !== loadGenRef.current) return;
      setPhotoUris([]);
      setLoadError(true);
    } finally {
      if (gen === loadGenRef.current) {
        setLoading(false);
      }
    }
  }, [sinceTimestamp]);

  useEffect(() => {
    loadRecentPhotos();
  }, [loadRecentPhotos]);

  const handlePhotoPress = useCallback(
    (uri: string) => {
      if (!onSelectionChange) return;
      const isSelected = selectedUris.includes(uri);
      const next = isSelected
        ? selectedUris.filter((u) => u !== uri)
        : [...selectedUris, uri];
      onSelectionChange(next);
    },
    [onSelectionChange, selectedUris]
  );

  const sectionTitle =
    sinceTimestamp != null
      ? (sinceLabel ?? 'Recent photos')
      : 'Recent photos';

  if (Platform.OS === 'web') {
    return (
      <ThemedView style={styles.section}>
        <ThemedText style={styles.sectionTitle}>{sectionTitle}</ThemedText>
        <View style={[styles.placeholder, styles.centered]}>
          <ThemedText style={styles.placeholderText}>
            Your 10 most recent photos appear here in the app.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (loadError) {
    return (
      <ThemedView style={styles.section}>
        <ThemedText style={styles.sectionTitle}>{sectionTitle}</ThemedText>
        <View style={[styles.placeholder, styles.centered]}>
          <ThemedText style={styles.placeholderText}>
            Couldn't load photos. Check permissions or try again.
          </ThemedText>
          <Pressable style={styles.retryBtn} onPress={loadRecentPhotos}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  if (permissionDenied) {
    return (
      <ThemedView style={styles.section}>
        <ThemedText style={styles.sectionTitle}>{sectionTitle}</ThemedText>
        <View style={[styles.placeholder, styles.centered]}>
          <ThemedText style={styles.placeholderText}>
            Photo library access is needed to show your recent photos.
          </ThemedText>
          <Pressable style={styles.retryBtn} onPress={loadRecentPhotos}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.section}>
        <ThemedText style={styles.sectionTitle}>{sectionTitle}</ThemedText>
        <View style={[styles.placeholder, styles.centered]}>
          <ActivityIndicator size="small" />
        </View>
      </ThemedView>
    );
  }

  if (photoUris.length === 0) {
    return (
      <ThemedView style={styles.section}>
        <ThemedText style={styles.sectionTitle}>{sectionTitle}</ThemedText>
        <View style={[styles.placeholder, styles.centered]}>
          <ThemedText style={styles.placeholderText}>No photos in your library.</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const selectable = !!onSelectionChange;

  return (
    <ThemedView style={styles.section}>
      <ThemedText style={styles.sectionTitle}>
        {sinceTimestamp != null
          ? (sinceLabel ?? 'Recent photos')
          : 'Your 10 most recent photos'}
      </ThemedText>
      <View style={styles.grid}>
        {photoUris.map((uri, index) => {
          const isSelected = selectedUris.includes(uri);
          const size = selectable ? CELL_SIZE_WITH_BORDER : CELL_SIZE;
          const radius = selectable ? CELL_RADIUS_WITH_BORDER : CELL_RADIUS;
          const content = (
            <View style={[styles.cellWrapper, { width: size, height: size, borderRadius: radius }]}>
              <Image
                source={{ uri }}
                style={[styles.cell, { width: size, height: size, borderRadius: radius }]}
              />
              {selectable && isSelected && (
                <View style={[styles.cellOverlay, { width: size, height: size, borderRadius: radius }]}>
                  <Ionicons name="checkmark-circle" size={32} color="#fff" />
                </View>
              )}
            </View>
          );
          if (selectable) {
            return (
              <Pressable
                key={`${uri}-${index}`}
                onPress={() => handlePhotoPress(uri)}
                style={({ pressed }) => [
                  styles.cellPressable,
                  { width: CELL_SIZE, height: CELL_SIZE },
                  styles.cellSelectableBorder,
                  { borderColor: isSelected ? '#2f95dc' : 'transparent' },
                  pressed && styles.cellPressed,
                ]}
              >
                {content}
              </Pressable>
            );
          }
          return (
            <View key={`${uri}-${index}`}>
              {content}
            </View>
          );
        })}
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
    borderRadius: CELL_RADIUS,
    backgroundColor: '#eee',
  },
  cellWrapper: {
    borderRadius: CELL_RADIUS,
    overflow: 'hidden',
    position: 'relative',
  },
  cellPressable: {
    borderRadius: CELL_RADIUS,
  },
  cellSelectableBorder: {
    borderWidth: SELECTION_BORDER_WIDTH,
  },
  cellPressed: {
    opacity: 0.8,
  },
  cellOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CELL_RADIUS,
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
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#2f95dc',
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
