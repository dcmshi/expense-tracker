import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Linking,
  Platform,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import * as Crypto from 'expo-crypto'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AddStackParamList } from '../navigation/types'
import { createPresignedUpload } from '../api/uploads'
import { ingestReceipt } from '../api/ingest'
import { saveDraft, updateDraft } from '../storage/draftStorage'

type Props = NativeStackScreenProps<AddStackParamList, 'ReceiptCapture'>

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase =
  | { name: 'idle' }
  | { name: 'preview'; uri: string }
  | { name: 'uploading'; uri: string; step: string }
  | { name: 'error'; uri: string | null; message: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

async function preprocessImage(uri: string): Promise<string> {
  // Resize to max 1600 px wide and compress to ~85 % quality JPEG.
  // expo-image-manipulator preserves aspect ratio when only width is given.
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: 1600 } }],
    { compress: 0.85, format: SaveFormat.JPEG },
  )
  return result.uri
}

async function uploadToPresignedUrl(presignedUrl: string, imageUri: string): Promise<void> {
  // Fetch the local file as a blob then PUT it directly to S3.
  const localResponse = await fetch(imageUri)
  const blob = await localResponse.blob()
  const uploadResponse = await fetch(presignedUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': 'image/jpeg' },
  })
  if (!uploadResponse.ok) {
    throw new Error(`Storage upload failed (${uploadResponse.status})`)
  }
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ReceiptCaptureScreen({ navigation, route }: Props) {
  const { resumeLocalId, resumeImageUri } = route.params ?? {}

  const [phase, setPhase] = useState<Phase>(
    resumeImageUri
      ? { name: 'preview', uri: resumeImageUri }
      : { name: 'idle' },
  )

  // ── Camera launch ───────────────────────────────────────────────────────────

  async function launchCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()

    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      setPhase({
        name: 'error',
        uri: null,
        message:
          'Camera access is required to scan receipts. Please enable it in Settings.',
      })
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1, // Keep full quality here; we compress in preprocessing
    })

    if (result.canceled || !result.assets?.[0]) return

    setPhase({ name: 'preview', uri: result.assets[0].uri })
  }

  // ── Upload pipeline ─────────────────────────────────────────────────────────

  async function handleUsePhoto(rawUri: string) {
    const now = new Date().toISOString()
    const localId = resumeLocalId ?? Crypto.randomUUID()
    const idempotencyKey = Crypto.randomUUID()

    // Upsert the draft — creates fresh or resets an existing pending draft
    await saveDraft({
      local_id: localId,
      sync_status: 'pending',
      captured_image_path: rawUri,
      edited_fields: {},
      created_at: now,
      updated_at: now,
    })

    try {
      // 1. Preprocess
      setPhase({ name: 'uploading', uri: rawUri, step: 'Preparing image…' })
      const processedUri = await preprocessImage(rawUri)

      // 2. Request presigned upload URL
      setPhase({ name: 'uploading', uri: rawUri, step: 'Requesting upload URL…' })
      const { presigned_url, object_key } = await createPresignedUpload(idempotencyKey)

      // 3. Upload image directly to object storage
      setPhase({ name: 'uploading', uri: rawUri, step: 'Uploading to storage…' })
      await uploadToPresignedUrl(presigned_url, processedUri)

      // 4. Trigger backend ingestion
      setPhase({ name: 'uploading', uri: rawUri, step: 'Starting processing…' })
      const { expense_id } = await ingestReceipt(object_key, idempotencyKey)

      // 5. Update draft with server expense id
      await updateDraft(localId, { sync_status: 'uploaded', expense_id })

      // 6. Navigate to EditVerify in the Expenses stack
      navigation.getParent()?.navigate('ExpensesTab', {
        screen: 'EditVerify',
        params: { expenseId: expense_id },
      } as never)
    } catch (err: unknown) {
      const message =
        (err as { message?: string })?.message ?? 'Something went wrong. Please try again.'
      setPhase({ name: 'error', uri: rawUri, message })
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (phase.name === 'idle') {
    return (
      <View style={styles.centered}>
        <Text style={styles.idleTitle}>Scan a receipt</Text>
        <Text style={styles.idleSubtitle}>
          Take a clear, flat photo of your receipt.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={launchCamera} activeOpacity={0.8}>
          <Text style={styles.btnLabel}>Take Photo</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (phase.name === 'preview') {
    return (
      <View style={styles.flex}>
        <Image
          source={{ uri: phase.uri }}
          style={styles.previewImage}
          resizeMode="contain"
        />
        <View style={styles.previewActions}>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => handleUsePhoto(phase.uri)}
            activeOpacity={0.8}
          >
            <Text style={styles.btnLabel}>Use Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={launchCamera}
            activeOpacity={0.8}
          >
            <Text style={styles.btnSecondaryLabel}>Retake</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  if (phase.name === 'uploading') {
    return (
      <View style={styles.flex}>
        <Image
          source={{ uri: phase.uri }}
          style={styles.uploadingImage}
          resizeMode="contain"
        />
        <View style={styles.uploadingFooter}>
          <ActivityIndicator size="large" color="#111827" />
          <Text style={styles.uploadingStep}>{phase.step}</Text>
        </View>
      </View>
    )
  }

  // error phase
  return (
    <View style={styles.centered}>
      <Text style={styles.errorTitle}>Upload failed</Text>
      <Text style={styles.errorMessage}>{phase.message}</Text>

      {/* If it's a permission error, offer to open Settings */}
      {phase.message.includes('Settings') ? (
        <TouchableOpacity
          style={styles.btn}
          onPress={() => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:')
            } else {
              Linking.openSettings()
            }
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.btnLabel}>Open Settings</Text>
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => {
              if (phase.uri) {
                setPhase({ name: 'preview', uri: phase.uri })
              } else {
                setPhase({ name: 'idle' })
                launchCamera()
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.btnLabel}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary, { marginTop: 10 }]}
            onPress={() => setPhase({ name: 'idle' })}
            activeOpacity={0.8}
          >
            <Text style={styles.btnSecondaryLabel}>Cancel</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000' },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },

  // Idle
  idleTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  idleSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },

  // Preview
  previewImage: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000',
  },
  previewActions: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    gap: 10,
    backgroundColor: '#000',
  },

  // Uploading
  uploadingImage: {
    flex: 1,
    width: '100%',
    opacity: 0.5,
    backgroundColor: '#000',
  },
  uploadingFooter: {
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#000',
  },
  uploadingStep: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },

  // Error
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#991B1B',
  },
  errorMessage: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },

  // Buttons
  btn: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
  },
  btnLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6B7280',
  },
  btnSecondaryLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
})
