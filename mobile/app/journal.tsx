import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from 'convex/react';
import { router } from 'expo-router';
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

import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import { Text as ThemedText, View as ThemedView } from '@/components/Themed';
import { PhotoStrip } from '@/ui/PhotoStrip';
import type { SelfieRecorderHandle } from '@/ui/SelfieRecorder';
import { SelfieRecorder } from '@/ui/SelfieRecorder';
import { usePriming } from '@/hooks/usePriming';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAMERA_COLUMN_WIDTH = Math.min(160, (SCREEN_WIDTH - 52) * 0.4);

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

export default function JournalScreen() {
  const sinceTimestamp = useMemo(
    () => Date.now() - FORTY_EIGHT_HOURS_MS,
    []
  );
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
              <ThemedView style={styles.waitingPanel}>
                <ActivityIndicator size="small" style={styles.waitingPanelSpinner} />
                <ThemedText style={styles.waitingPanelTitle}>
                  Waiting for Poke AI response
                </ThemedText>
                <ThemedText style={styles.waitingPanelSubtext}>
                  Fetching your memory prompt…
                </ThemedText>
              </ThemedView>
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
        <PhotoStrip
          sinceTimestamp={sinceTimestamp}
          selectedUris={selectedPhotoUris}
          onSelectionChange={setSelectedPhotoUris}
        />
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
    paddingTop: 12,
    paddingBottom: 16,
  },
  galleryScroll: {
    flex: 1,
  },
  galleryScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
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
  waitingPanel: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.35)',
    backgroundColor: 'rgba(128,128,128,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  waitingPanelSpinner: {
    marginBottom: 12,
  },
  waitingPanelTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  waitingPanelSubtext: {
    fontSize: 14,
    opacity: 0.7,
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
