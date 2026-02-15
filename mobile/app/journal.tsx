import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Text as ThemedText, View as ThemedView } from '@/components/Themed';
import { PhotoStrip } from '@/ui/PhotoStrip';
import type { SelfieRecorderHandle } from '@/ui/SelfieRecorder';
import { SelfieRecorder } from '@/ui/SelfieRecorder';
import { usePriming } from '@/hooks/usePriming';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAMERA_COLUMN_WIDTH = Math.min(160, (SCREEN_WIDTH - 52) * 0.4);

/** 4 AM local time, 7 days ago */
function getSevenDaysAgoAt4AM(): number {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(4, 0, 0, 0);
  return d.getTime();
}

export default function JournalScreen() {
  const latestScrapTs = useQuery(api.scraps.getLatestScrapTimestamp);

  // undefined = query still loading, null = no scraps exist
  const queryLoaded = latestScrapTs !== undefined;

  const { sinceTimestamp, sinceLabel, sinceDate } = useMemo(() => {
    if (!queryLoaded) {
      return { sinceTimestamp: undefined as number | undefined, sinceLabel: '', sinceDate: '' };
    }
    const sevenDaysAgoAt4AM = getSevenDaysAgoAt4AM();
    const latestScrap = latestScrapTs ?? 0;
    const usedLatestScrap = latestScrap > sevenDaysAgoAt4AM;
    const ts = Math.max(sevenDaysAgoAt4AM, latestScrap);
    const d = new Date(ts);
    const formatted = `${d.getMonth() + 1}/${d.getDate()}`;
    return {
      sinceTimestamp: ts,
      sinceLabel: usedLatestScrap
        ? 'New photos since last scrap'
        : 'New photos this week',
      sinceDate: formatted,
    };
  }, [latestScrapTs, queryLoaded]);
  const { text: primingText, loading: primingLoading, fetchPriming } =
    usePriming(sinceTimestamp);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [selectedPhotoUris, setSelectedPhotoUris] = useState<string[]>([]);
  const [saveLoading, setSaveLoading] = useState(false);
  const recorderRef = useRef<SelfieRecorderHandle>(null);

  const insets = useSafeAreaInsets();
  const generateUploadUrl = useMutation(api.scraps.generateUploadUrl);
  const createScrap = useMutation(api.scraps.createScrap);

  const handleSaveScrap = useCallback(async () => {
    if (!videoUri) return;
    setSaveLoading(true);
    try {
      const postUrl = await generateUploadUrl();
      const videoBlob = await (await fetch(videoUri)).blob();
      const videoRes = await fetch(postUrl, {
        method: 'POST',
        body: videoBlob,
        headers: { 'Content-Type': 'video/mp4' },
      });
      if (!videoRes.ok) throw new Error('Failed to upload video');
      const { storageId: videoStorageId } = (await videoRes.json()) as {
        storageId: Id<'_storage'>;
      };

      const photoStorageIds: Id<'_storage'>[] = [];
      for (const uri of selectedPhotoUris) {
        const url = await generateUploadUrl();
        const blob = await (await fetch(uri)).blob();
        const res = await fetch(url, {
          method: 'POST',
          body: blob,
          headers: { 'Content-Type': 'image/jpeg' },
        });
        if (!res.ok) throw new Error('Failed to upload photo');
        const { storageId } = (await res.json()) as { storageId: Id<'_storage'> };
        photoStorageIds.push(storageId);
      }

      await createScrap({
        videoStorageId,
        timestamp: Date.now(),
        photoStorageIds,
      });
      setVideoUri(null);
      setSelectedPhotoUris([]);
      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save scrap';
      Alert.alert('Error', msg);
    } finally {
      setSaveLoading(false);
    }
  }, [videoUri, selectedPhotoUris, generateUploadUrl, createScrap]);

  const loadPriming = useCallback(() => {
    fetchPriming();
  }, [fetchPriming]);

  useEffect(() => {
    loadPriming();
  }, [loadPriming]);

  return (
    <ThemedView
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <Stack.Screen
        options={{
          headerTitle: sinceDate ? `Scrap (since ${sinceDate})` : 'Scrap',
        }}
      />
      <View style={styles.topSection}>
        <View style={styles.topRow}>
          <ThemedView style={styles.primingColumn}>
            <View style={styles.primingTitleRow}>
              <ThemedText style={styles.sectionTitle}>Prime your memory</ThemedText>
              {primingLoading && (
                <ActivityIndicator size="small" style={styles.primingTitleSpinner} />
              )}
            </View>
            {primingLoading && !primingText ? (
              <View style={styles.primingPlaceholder}>
                <ActivityIndicator size="small" />
                <ThemedText style={styles.primingPlaceholderText}>
                  Loading from backend…
                </ThemedText>
              </View>
            ) : primingText ? (
              <ThemedText style={styles.primingText}>{primingText}</ThemedText>
            ) : (
              <ThemedText style={styles.primingPlaceholderText}>
                Pull to load a prompt.
              </ThemedText>
            )}
          </ThemedView>
          <View style={styles.cameraColumn}>
            <SelfieRecorder
              ref={recorderRef}
              videoUri={videoUri}
              onVideoUriChange={setVideoUri}
              compact
              onRecordingStateChange={setRecording}
              onCameraReadyChange={setCameraReady}
            />
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.galleryScroll}
        contentContainerStyle={styles.galleryScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl refreshing={primingLoading} onRefresh={loadPriming} />
        }
      >
        {sinceTimestamp != null ? (
          <PhotoStrip
            sinceTimestamp={sinceTimestamp}
            sinceLabel={sinceLabel}
            selectedUris={selectedPhotoUris}
            onSelectionChange={setSelectedPhotoUris}
          />
        ) : (
          <View style={styles.photoStripLoading}>
            <ActivityIndicator size="small" />
          </View>
        )}
      </ScrollView>

      <ThemedView style={styles.bottomBar}>
        {videoUri ? (
          <View style={styles.postRecordButtons}>
            <Pressable
              style={styles.actionBtn}
              onPress={() => setVideoUri(null)}
            >
              <Ionicons name="refresh" size={28} color="#000" />
            </Pressable>
            <Pressable
              style={[styles.actionBtn, saveLoading && styles.actionBtnDisabled]}
              onPress={handleSaveScrap}
              disabled={saveLoading}
            >
              {saveLoading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Ionicons name="checkmark" size={28} color="#000" />
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[styles.recordBtn, recording && styles.recordBtnActive]}
            onPress={() => {
              if (recording) {
                recorderRef.current?.stopRecording();
              } else {
                recorderRef.current?.startRecording();
              }
            }}
            disabled={!recording && !cameraReady}
          >
            <Ionicons
              name={recording ? 'stop' : 'videocam'}
              size={28}
              color={recording ? '#fff' : '#000'}
            />
          </Pressable>
        )}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  galleryScroll: {
    flex: 1,
  },
  galleryScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  photoStripLoading: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.3)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  primingColumn: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingVertical: 10,
    minHeight: 100,
  },
  cameraColumn: {
    width: CAMERA_COLUMN_WIDTH,
    maxWidth: CAMERA_COLUMN_WIDTH,
    flexShrink: 0,
  },
  primingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  primingTitleSpinner: {
    marginLeft: 4,
  },
  primingText: {
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 4,
    opacity: 0.95,
  },
  primingPlaceholder: {
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  primingPlaceholderText: {
    fontSize: 15,
    opacity: 0.6,
    paddingHorizontal: 4,
  },
  recordBtn: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtnActive: {
    backgroundColor: '#e74c3c',
  },
  postRecordButtons: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 24,
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
});
