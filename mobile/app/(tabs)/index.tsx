import Ionicons from '@expo/vector-icons/Ionicons';
import { ResizeMode, Video } from 'expo-av';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { fetch } from 'expo/fetch';
import { useQuery } from 'convex/react';
import { router } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  const [shareLoading, setShareLoading] = useState(false);

  const togglePlay = useCallback(async () => {
    if (!videoRef.current) return;
    if (playing) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
    setPlaying((p) => !p);
  }, [playing]);

  const handleShare = useCallback(async () => {
    const hasVideo = !!scrap.videoUrl;
    const hasPhotos = scrap.photos.length > 0;
    if (!hasVideo && !hasPhotos) return;

    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert('Sharing not available', 'Sharing is not supported on this device.');
      return;
    }

    setShareLoading(true);
    const localUris: string[] = [];
    try {
      const destDir = new Directory(Paths.cache, `scrap-${scrap._id}`);
      destDir.create({ intermediates: true, idempotent: true });

      if (hasVideo && scrap.videoUrl) {
        const videoExt = scrap.videoUrl.includes('.mp4') ? 'mp4' : 'mov';
        const videoFile = new File(destDir, `video.${videoExt}`);
        videoFile.create({ overwrite: true });
        const videoRes = await fetch(scrap.videoUrl);
        videoFile.write(await videoRes.bytes());
        localUris.push(videoFile.uri);
      }
      if (hasPhotos) {
        for (let i = 0; i < scrap.photos.length; i++) {
          try {
            const p = scrap.photos[i];
            const photoFile = new File(destDir, `photo-${i}.jpg`);
            photoFile.create({ overwrite: true });
            const res = await fetch(p.imageUrl);
            if (!res.ok) throw new Error(`Photo ${i + 1}: ${res.status}`);
            photoFile.write(await res.bytes());
            localUris.push(photoFile.uri);
          } catch (photoErr) {
            // Skip this photo but keep going so video and other photos still share
            __DEV__ && console.warn('Failed to prepare photo for share', photoErr);
          }
        }
      }

      // Prefer one share sheet for all items (video + photos) when possible; fall back to sequential
      if (localUris.length > 1) {
        try {
          const RNShare = await import('react-native-share').then((m) => m.default);
          await RNShare.open({
            urls: localUris,
            title: 'Share scrap',
            failOnCancel: false,
          });
          return;
        } catch (_) {
          // react-native-share not available (e.g. Expo Go) or batch failed; use sequential sheets
        }
      }

      for (let i = 0; i < localUris.length; i++) {
        const uri = localUris[i];
        try {
          if (i > 0) await new Promise((r) => setTimeout(r, 400));
          const title =
            localUris.length > 1 ? `Share scrap (${i + 1} of ${localUris.length})` : 'Share scrap';
          await Sharing.shareAsync(uri, {
            dialogTitle: title,
            mimeType: uri.endsWith('.mp4') || uri.endsWith('.mov') ? 'video/mp4' : 'image/jpeg',
          });
        } catch (_) {
          // User may have cancelled; continue to next item
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to share';
      Alert.alert('Share failed', message);
    } finally {
      setShareLoading(false);
    }
  }, [scrap._id, scrap.videoUrl, scrap.photos]);

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
      <View style={styles.cardFooter}>
        <ThemedText style={styles.timestamp}>{formatScrapDate(scrap.timestamp)}</ThemedText>
        <Pressable
          style={({ pressed }) => [styles.shareBtn, pressed && styles.shareBtnPressed]}
          onPress={handleShare}
          disabled={shareLoading || (!scrap.videoUrl && scrap.photos.length === 0)}
        >
          {shareLoading ? (
            <ActivityIndicator size="small" color="#666" />
          ) : (
            <Ionicons name="share-outline" size={22} color="#666" />
          )}
        </Pressable>
      </View>
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
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
  },
  timestamp: {
    fontSize: 13,
    opacity: 0.7,
  },
  shareBtn: {
    padding: 8,
    margin: -8,
  },
  shareBtnPressed: {
    opacity: 0.6,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    paddingVertical: 32,
  },
});
