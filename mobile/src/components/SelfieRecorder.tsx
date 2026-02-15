import { Camera, CameraView } from 'expo-camera';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Video } from 'expo-av';

import { Text as ThemedText, View as ThemedView } from '@/components/Themed';

const PORTRAIT_ASPECT = 3 / 4;

export interface SelfieRecorderHandle {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
}

interface SelfieRecorderProps {
  videoUri: string | null;
  onVideoUriChange: (uri: string | null) => void;
  compact?: boolean;
  onRecordingStateChange?: (recording: boolean) => void;
  onCameraReadyChange?: (ready: boolean) => void;
}

type CameraViewInstance = InstanceType<typeof CameraView>;

export const SelfieRecorder = React.forwardRef<SelfieRecorderHandle, SelfieRecorderProps>(
  function SelfieRecorder(
    {
      videoUri,
      onVideoUriChange,
      compact = false,
      onRecordingStateChange,
      onCameraReadyChange,
    },
    ref
  ) {
  const cameraRef = React.useRef<CameraViewInstance>(null);
  const [granted, setGranted] = React.useState<boolean | null>(null);
  const [requestingPermission, setRequestingPermission] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [cameraReady, setCameraReady] = React.useState(false);
  const recordingPromiseRef = React.useRef<Promise<{ uri: string } | undefined> | null>(null);

  React.useImperativeHandle(
    ref,
    () => ({
      startRecording,
      stopRecording,
    }),
    [startRecording, stopRecording]
  );

  const notifyRecording = React.useCallback(
    (value: boolean) => {
      onRecordingStateChange?.(value);
    },
    [onRecordingStateChange]
  );

  const notifyCameraReady = React.useCallback(
    (value: boolean) => {
      onCameraReadyChange?.(value);
    },
    [onCameraReadyChange]
  );

  const PERMISSION_CHECK_TIMEOUT_MS = 8000;

  React.useEffect(() => {
    if (Platform.OS === 'web') {
      setGranted(false);
      return;
    }
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) setGranted(false);
    }, PERMISSION_CHECK_TIMEOUT_MS);
    Camera.getCameraPermissionsAsync()
      .then((res) => {
        if (!cancelled) setGranted(res.granted);
      })
      .catch(() => {
        if (!cancelled) setGranted(false);
      })
      .finally(() => clearTimeout(timeoutId));
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  const handleRequestPermission = React.useCallback(async () => {
    if (Platform.OS === 'web') return;
    setRequestingPermission(true);
    try {
      const result = await Camera.requestCameraPermissionsAsync();
      const updated = await Camera.getCameraPermissionsAsync();
      setGranted(updated.granted);
      if (updated.granted) {
        await Camera.requestMicrophonePermissionsAsync();
      } else if (result.canAskAgain === false) {
        Alert.alert(
          'Camera access',
          'Camera was denied. To enable it, open Settings and allow camera for this app.',
          [{ text: 'OK' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }]
        );
      }
    } catch (e) {
      setGranted(false);
      Alert.alert('Camera access', 'Could not request camera permission. Try again or check Settings.');
    } finally {
      setRequestingPermission(false);
    }
  }, []);

  const startRecording = React.useCallback(async () => {
    if (!cameraRef.current || !cameraReady || recording) return;
    setRecording(true);
    notifyRecording(true);
    try {
      if (Platform.OS !== 'web') {
        await new Promise((r) => setTimeout(r, 300));
        recordingPromiseRef.current = cameraRef.current.recordAsync();
      }
    } catch (e) {
      setRecording(false);
      notifyRecording(false);
    }
  }, [cameraReady, recording, notifyRecording]);

  const stopRecording = React.useCallback(async () => {
    if (!cameraRef.current || !recording) return;
    try {
      if (Platform.OS !== 'web') {
        cameraRef.current.stopRecording();
        const result = await recordingPromiseRef.current;
        if (result?.uri) onVideoUriChange(result.uri);
      }
      recordingPromiseRef.current = null;
    } finally {
      setRecording(false);
      notifyRecording(false);
    }
  }, [recording, onVideoUriChange, notifyRecording]);

  const handleRecordPress = () => {
    if (recording) stopRecording();
    else startRecording();
  };

  if (granted === null) {
    return (
      <ThemedView style={styles.section}>
        {!compact && <ThemedText style={styles.sectionTitle}>Record your reflection</ThemedText>}
        <View style={[styles.cameraPlaceholder, styles.centered]}>
          <ActivityIndicator size="large" />
        </View>
      </ThemedView>
    );
  }

  if (!granted) {
    return (
      <ThemedView style={styles.section}>
        {!compact && <ThemedText style={styles.sectionTitle}>Record your reflection</ThemedText>}
        <View style={[styles.cameraPlaceholder, styles.centered]}>
          <ThemedText style={styles.placeholderText}>
            Camera access is needed to record your reflection.
          </ThemedText>
          <Pressable
            style={[styles.permissionBtn, requestingPermission && styles.permissionBtnDisabled]}
            onPress={handleRequestPermission}
            disabled={requestingPermission}
          >
            {requestingPermission ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.permissionBtnText}>Allow camera access</Text>
            )}
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <ThemedView style={styles.section}>
        {!compact && <ThemedText style={styles.sectionTitle}>Record your reflection</ThemedText>}
        <View style={[styles.cameraPlaceholder, styles.centered]}>
          <ThemedText style={styles.placeholderText}>
            Video recording is available in the Expo Go app or on a device.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (videoUri) {
    return (
      <ThemedView style={styles.section}>
        {!compact && <ThemedText style={styles.sectionTitle}>Your recording</ThemedText>}
        <Video
          source={{ uri: videoUri }}
          style={styles.videoPreview}
          useNativeControls
          isLooping={false}
        />
        {!compact && (
          <Pressable
            style={styles.rerecordBtn}
            onPress={() => onVideoUriChange(null)}
          >
            <Text style={styles.rerecordBtnText}>Record again</Text>
          </Pressable>
        )}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.section}>
      {!compact && <ThemedText style={styles.sectionTitle}>Record your reflection</ThemedText>}
      <View style={styles.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          onCameraReady={() => {
            setCameraReady(true);
            notifyCameraReady(true);
          }}
        />
        {!compact && (
          <Pressable
            style={[styles.recordBtn, recording && styles.recordBtnActive]}
            onPress={handleRecordPress}
            disabled={!cameraReady}
          >
            <Text style={styles.recordBtnText}>{recording ? 'Stop' : 'Record'}</Text>
          </Pressable>
        )}
      </View>
    </ThemedView>
  );
});

const styles = StyleSheet.create({
  section: {
    paddingVertical: 12,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'flex-start',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  cameraWrap: {
    width: '100%',
    aspectRatio: PORTRAIT_ASPECT,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#111',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraPlaceholder: {
    width: '100%',
    aspectRatio: PORTRAIT_ASPECT,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    padding: 24,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#999',
    textAlign: 'center',
    marginBottom: 16,
  },
  permissionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#2f95dc',
    borderRadius: 8,
  },
  permissionBtnDisabled: {
    opacity: 0.7,
  },
  permissionBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  recordBtn: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 24,
  },
  recordBtnActive: {
    backgroundColor: '#e74c3c',
  },
  recordBtnText: {
    color: '#000',
    fontWeight: '700',
  },
  videoPreview: {
    width: '100%',
    aspectRatio: PORTRAIT_ASPECT,
    borderRadius: 12,
    backgroundColor: '#000',
  },
  rerecordBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rerecordBtnText: {
    color: '#2f95dc',
    fontWeight: '600',
  },
});
