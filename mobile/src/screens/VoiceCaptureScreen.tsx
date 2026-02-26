import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native'
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition'
import * as Crypto from 'expo-crypto'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AddStackParamList } from '../navigation/types'
import { ingestVoice } from '../api/ingest'
import { saveDraft, updateDraft } from '../storage/draftStorage'

type Props = NativeStackScreenProps<AddStackParamList, 'VoiceCapture'>

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase =
  | { name: 'idle' }
  | { name: 'listening'; transcript: string }
  | { name: 'preview'; transcript: string }
  | { name: 'uploading'; transcript: string; step: string }
  | { name: 'error'; transcript: string | null; message: string }

// ── Screen ────────────────────────────────────────────────────────────────────

export default function VoiceCaptureScreen({ navigation, route }: Props) {
  const { resumeLocalId, resumeTranscript } = route.params ?? {}

  const [phase, setPhase] = useState<Phase>(
    resumeTranscript
      ? { name: 'preview', transcript: resumeTranscript }
      : { name: 'idle' },
  )

  // ── Speech recognition events ────────────────────────────────────────────────

  useSpeechRecognitionEvent('result', (event) => {
    const best = event.results?.[0]?.transcript ?? ''
    setPhase((prev) =>
      prev.name === 'listening' ? { name: 'listening', transcript: best } : prev,
    )
  })

  useSpeechRecognitionEvent('end', () => {
    setPhase((prev) => {
      if (prev.name !== 'listening') return prev
      const transcript = prev.transcript.trim()
      if (!transcript) {
        return { name: 'error', transcript: null, message: 'No speech detected. Please try again.' }
      }
      return { name: 'preview', transcript }
    })
  })

  useSpeechRecognitionEvent('error', (event) => {
    setPhase((prev) => ({
      name: 'error',
      transcript: prev.name === 'listening' ? prev.transcript || null : null,
      message: `Speech recognition error: ${event.message ?? 'unknown error'}`,
    }))
  })

  // Stop recognition if the screen unmounts mid-listen
  useEffect(() => {
    return () => {
      ExpoSpeechRecognitionModule.abort()
    }
  }, [])

  // ── Start recording ──────────────────────────────────────────────────────────

  async function startListening() {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
    if (!granted) {
      setPhase({
        name: 'error',
        transcript: null,
        message: 'Microphone and speech recognition access is required. Please enable it in Settings.',
      })
      return
    }

    setPhase({ name: 'listening', transcript: '' })
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: false,
    })
  }

  function stopListening() {
    ExpoSpeechRecognitionModule.stop()
    // 'end' event will fire and advance the phase
  }

  // ── Submit pipeline ──────────────────────────────────────────────────────────

  async function handleSubmit(transcript: string) {
    const now = new Date().toISOString()
    const localId = resumeLocalId ?? Crypto.randomUUID()
    const idempotencyKey = Crypto.randomUUID()

    await saveDraft({
      local_id: localId,
      sync_status: 'pending',
      transcript_text: transcript,
      edited_fields: {},
      created_at: now,
      updated_at: now,
    })

    try {
      setPhase({ name: 'uploading', transcript, step: 'Submitting transcript…' })
      const { expense_id } = await ingestVoice(transcript, idempotencyKey)

      setPhase({ name: 'uploading', transcript, step: 'Starting processing…' })
      await updateDraft(localId, { sync_status: 'uploaded', expense_id })

      // Navigate to EditVerify in the Expenses stack (cross-tab navigation)
      navigation.getParent()?.navigate('ExpensesTab', {
        screen: 'EditVerify',
        params: { expenseId: expense_id },
      } as never)
    } catch (err: unknown) {
      const message =
        (err as { message?: string })?.message ?? 'Something went wrong. Please try again.'
      setPhase({ name: 'error', transcript, message })
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (phase.name === 'idle') {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Voice Entry</Text>
        <Text style={styles.subtitle}>
          Describe your expense — for example:{'\n'}
          "Spent $23 at Metro yesterday"
        </Text>
        <TouchableOpacity style={styles.recordBtn} onPress={startListening} activeOpacity={0.8}>
          <Text style={styles.recordBtnLabel}>Tap to Record</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (phase.name === 'listening') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.listeningLabel}>Listening…</Text>
        {phase.transcript ? (
          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptText}>{phase.transcript}</Text>
          </View>
        ) : (
          <Text style={styles.hint}>Speak now</Text>
        )}
        <TouchableOpacity style={styles.stopBtn} onPress={stopListening} activeOpacity={0.8}>
          <Text style={styles.stopBtnLabel}>Stop</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (phase.name === 'preview') {
    return (
      <ScrollView contentContainerStyle={styles.centered}>
        <Text style={styles.title}>Review transcript</Text>
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptText}>{phase.transcript}</Text>
        </View>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => handleSubmit(phase.transcript)}
          activeOpacity={0.8}
        >
          <Text style={styles.btnLabel}>Use This</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary, { marginTop: 10 }]}
          onPress={() => setPhase({ name: 'idle' })}
          activeOpacity={0.8}
        >
          <Text style={styles.btnSecondaryLabel}>Re-record</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  if (phase.name === 'uploading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.uploadingStep}>{phase.step}</Text>
      </View>
    )
  }

  // error phase
  return (
    <View style={styles.centered}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorMessage}>{phase.message}</Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => setPhase({ name: 'idle' })}
        activeOpacity={0.8}
      >
        <Text style={styles.btnLabel}>Try Again</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, styles.btnSecondary, { marginTop: 10 }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <Text style={styles.btnSecondaryLabel}>Cancel</Text>
      </TouchableOpacity>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },

  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },

  // Transcript preview box
  transcriptBox: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 16,
    width: '100%',
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcriptText: {
    fontSize: 16,
    color: '#111827',
    lineHeight: 24,
    textAlign: 'center',
  },

  // Listening state
  listeningLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC2626',
  },
  hint: {
    fontSize: 14,
    color: '#9CA3AF',
  },

  // Uploading state
  uploadingStep: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    marginTop: 8,
  },

  // Error state
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
  recordBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  recordBtnLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  stopBtn: {
    backgroundColor: '#374151',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  stopBtnLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
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
    borderColor: '#D1D5DB',
  },
  btnSecondaryLabel: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '500',
  },
})
