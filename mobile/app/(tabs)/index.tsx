import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from 'convex/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { Text as ThemedText, View as ThemedView } from '@/components/Themed';
import { PhotoStrip } from '@/ui/PhotoStrip';
import type { SelfieRecorderHandle } from '@/ui/SelfieRecorder';
import { SelfieRecorder } from '@/ui/SelfieRecorder';
import { usePriming } from '@/hooks/usePriming';
import { journalService } from '@/services/journalService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAMERA_COLUMN_WIDTH = Math.min(160, (SCREEN_WIDTH - 52) * 0.4);

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

export default function JournalScreen() {
  const sinceTimestamp = useMemo(
    () => Date.now() - FORTY_EIGHT_HOURS_MS,
    []
  );
  const { text: primingText, loading: primingLoading, fetchPriming, requestId: primingRequestId, setPrimingTextFromPaste } = usePriming(sinceTimestamp);
  const [recap, setRecap] = useState<{ recap: string; savedAt: string | null } | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);
  const [pastedSummary, setPastedSummary] = useState('');
  const [submitSummaryLoading, setSubmitSummaryLoading] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [selectedPhotoUris, setSelectedPhotoUris] = useState<string[]>([]);
  const [saveLoading, setSaveLoading] = useState(false);
  const recorderRef = useRef<SelfieRecorderHandle>(null);

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

  const loadRecap = useCallback(async () => {
    setRecapLoading(true);
    try {
      const data = await journalService.getRecap();
      setRecap(data);
    } finally {
      setRecapLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    loadPriming();
    loadRecap();
  }, [loadPriming, loadRecap]);

  const handleSubmitPastedSummary = useCallback(async () => {
    if (!primingRequestId || !pastedSummary.trim()) return;
    setSubmitSummaryLoading(true);
    try {
      await journalService.submitPrimingCallback(primingRequestId, pastedSummary.trim());
      setPrimingTextFromPaste(pastedSummary.trim());
      setPastedSummary('');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit summary');
    } finally {
      setSubmitSummaryLoading(false);
    }
  }, [primingRequestId, pastedSummary, setPrimingTextFromPaste]);

  useEffect(() => {
    loadPriming();
  }, [loadPriming]);

  useEffect(() => {
    loadRecap();
  }, [loadRecap]);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.topSection}>
        {recap?.recap ? (
          <ThemedView style={styles.recapBlock}>
            <ThemedText style={styles.sectionTitle}>Your recap</ThemedText>
            {recap.savedAt ? (
              <ThemedText style={styles.recapSavedAt}>
                Saved {new Date(recap.savedAt).toLocaleDateString()}
              </ThemedText>
            ) : null}
            <ThemedText style={styles.recapText}>{recap.recap}</ThemedText>
          </ThemedView>
        ) : recapLoading ? (
          <ThemedView style={styles.recapBlock}>
            <ActivityIndicator size="small" style={styles.recapSpinner} />
            <ThemedText style={styles.recapPlaceholder}>Loading recap…</ThemedText>
          </ThemedView>
        ) : null}
        <View style={styles.topRow}>
          <ThemedView style={styles.primingColumn}>
            <View style={styles.primingTitleRow}>
              <ThemedText style={styles.sectionTitle}>Prime your memory</ThemedText>
              {primingLoading && (
                <ActivityIndicator size="small" style={styles.primingTitleSpinner} />
              )}
            </View>
            {primingRequestId && !primingText ? (
              <View style={styles.pasteSummaryBlock}>
                <ThemedText style={styles.primingPlaceholderText}>
                  When you receive the summary in Messages, paste it below and tap Submit.
                </ThemedText>
                <TextInput
                  style={styles.pasteSummaryInput}
                  placeholder="Paste summary from Poke / Messages…"
                  placeholderTextColor="rgba(128,128,128,0.8)"
                  multiline
                  value={pastedSummary}
                  onChangeText={setPastedSummary}
                  editable={!submitSummaryLoading}
                />
                <Pressable
                  style={[styles.submitSummaryBtn, submitSummaryLoading && styles.actionBtnDisabled]}
                  onPress={handleSubmitPastedSummary}
                  disabled={!pastedSummary.trim() || submitSummaryLoading}
                >
                  {submitSummaryLoading ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <ThemedText style={styles.submitSummaryBtnText}>Submit summary</ThemedText>
                  )}
                </Pressable>
              </View>
            ) : primingLoading && !primingText ? (
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
          <RefreshControl refreshing={primingLoading || recapLoading} onRefresh={handleRefresh} />
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  topSection: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  topRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primingColumn: {
    flex: 1,
    minWidth: 0,
  },
  primingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  recapBlock: {
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.35)',
    backgroundColor: 'rgba(128,128,128,0.06)',
  },
  recapSavedAt: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 6,
  },
  recapText: {
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: 0,
  },
  recapSpinner: {
    marginBottom: 8,
  },
  recapPlaceholder: {
    fontSize: 15,
    opacity: 0.6,
  },
  primingTitleSpinner: {
    marginLeft: 4,
  },
  primingPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
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
  primingText: {
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: 4,
  },
  cameraColumn: {
    width: CAMERA_COLUMN_WIDTH,
  },
  galleryScroll: {
    flex: 1,
  },
  galleryScrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  bottomBar: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postRecordButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  recordBtnActive: {
    backgroundColor: '#e53935',
  },
  primingPlaceholderText: {
    fontSize: 15,
    opacity: 0.6,
    paddingHorizontal: 4,
  },
  pasteSummaryBlock: {
    gap: 10,
    paddingVertical: 8,
  },
  pasteSummaryInput: {
    minHeight: 80,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.4)',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  submitSummaryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  submitSummaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
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
});
