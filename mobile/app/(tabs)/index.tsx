import Ionicons from '@expo/vector-icons/Ionicons';
import { ResizeMode, Video } from 'expo-av';
import { useQuery } from 'convex/react';
import { router } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { api } from '@/convex/_generated/api';
import { Text as ThemedText, View as ThemedView } from '@/components/Themed';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = 20;
const VIDEO_WIDTH = SCREEN_WIDTH - CARD_PADDING * 2;
const VIDEO_ASPECT = 3 / 4;
const VIDEO_HEIGHT = VIDEO_WIDTH / VIDEO_ASPECT;
const PHOTO_SIZE = 72;
const PHOTO_GAP = 8;

function formatScrapDate(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ScrapCard({
  scrap,
}: {
  scrap: {
    _id: string;
    timestamp: number;
    videoUrl: string | null;
    photos: { _id: string; imageUrl: string }[];
  };
}) {
  const videoRef = useRef<Video>(null);
  const [playing, setPlaying] = useState(false);

  const togglePlay = useCallback(async () => {
    if (!videoRef.current) return;
    if (playing) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
    setPlaying((p) => !p);
  }, [playing]);

  return (
    <ThemedView style={styles.card}>
      {scrap.videoUrl ? (
        <Pressable onPress={togglePlay} style={styles.videoWrap}>
          <Video
            ref={videoRef}
            source={{ uri: scrap.videoUrl }}
            style={styles.video}
            useNativeControls={false}
            isLooping
            isMuted={false}
            shouldPlay={false}
            resizeMode={ResizeMode.COVER}
          />
          {!playing && (
            <View style={styles.playOverlay} pointerEvents="none">
              <Ionicons name="play-circle" size={64} color="rgba(255,255,255,0.9)" />
            </View>
          )}
        </Pressable>
      ) : (
        <View style={[styles.videoWrap, styles.videoPlaceholder]}>
          <ThemedText style={styles.placeholderText}>Video unavailable</ThemedText>
        </View>
      )}
      {scrap.photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photosRow}
          style={styles.photosScroll}
        >
          {scrap.photos.map((p) => (
            <Image key={p._id} source={{ uri: p.imageUrl }} style={styles.photoThumb} />
          ))}
        </ScrollView>
      )}
      <ThemedText style={styles.timestamp}>{formatScrapDate(scrap.timestamp)}</ThemedText>
    </ThemedView>
  );
}

export default function HomeScreen() {
  const scraps = useQuery(api.scraps.listMyScraps);

  const renderItem = useCallback(
    ({ item }: { item: NonNullable<typeof scraps>[number] }) => <ScrapCard scrap={item} />,
    []
  );

  const keyExtractor = useCallback((item: NonNullable<typeof scraps>[number]) => item._id, []);

  const listHeader = (
    <Pressable style={styles.plusBtn} onPress={() => router.push('/journal')}>
      <Ionicons name="add" size={48} color="#fff" />
    </Pressable>
  );

  if (scraps === undefined) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={scraps}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>No scraps yet. Tap + to add one.</ThemedText>
        }
        contentContainerStyle={[
          styles.listContent,
          scraps.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={true}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: CARD_PADDING,
    paddingBottom: 24,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  plusBtn: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  card: {
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  videoWrap: {
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    backgroundColor: '#111',
  },
  videoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  placeholderText: {
    fontSize: 14,
    opacity: 0.7,
  },
  photosScroll: {
    marginHorizontal: -CARD_PADDING,
  },
  photosRow: {
    flexDirection: 'row',
    gap: PHOTO_GAP,
    paddingHorizontal: CARD_PADDING,
    paddingTop: 12,
    paddingBottom: 8,
  },
  photoThumb: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
    backgroundColor: '#222',
  },
  timestamp: {
    fontSize: 13,
    opacity: 0.7,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    paddingVertical: 32,
  },
});
