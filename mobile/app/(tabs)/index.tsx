import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAMERA_COLUMN_WIDTH = Math.min(160, (SCREEN_WIDTH - 52) * 0.4);

import { Text as ThemedText, View as ThemedView } from '@/components/Themed';
import { PhotoStrip } from '@/ui/PhotoStrip';
import type { SelfieRecorderHandle } from '@/ui/SelfieRecorder';
import { SelfieRecorder } from '@/ui/SelfieRecorder';
import { usePriming } from '@/hooks/usePriming';

export default function JournalScreen() {
  const { text: primingText, loading: primingLoading, fetchPriming } = usePriming();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const recorderRef = useRef<SelfieRecorderHandle>(null);

  const loadPriming = useCallback(() => {
    fetchPriming();
  }, [fetchPriming]);

  useEffect(() => {
    loadPriming();
  }, [loadPriming]);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.topSection}>
        <View style={styles.topRow}>
          <ThemedView style={styles.primingColumn}>
            <ThemedText style={styles.sectionTitle}>Prime your memory</ThemedText>
            {primingLoading && !primingText ? (
              <View style={styles.primingPlaceholder}>
                <ActivityIndicator size="small" />
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
        <PhotoStrip />
      </ScrollView>

      <ThemedView style={styles.bottomBar}>
        <Pressable
          style={[styles.recordBtn, recording && styles.recordBtnActive]}
          onPress={() => {
            if (videoUri) {
              setVideoUri(null);
            } else if (recording) {
              recorderRef.current?.stopRecording();
            } else {
              recorderRef.current?.startRecording();
            }
          }}
          disabled={!videoUri && !recording && !cameraReady}
        >
          <Ionicons
            name={recording ? 'stop' : 'videocam'}
            size={28}
            color={recording ? '#fff' : '#000'}
          />
        </Pressable>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    paddingHorizontal: 4,
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
});
