import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AddStackParamList } from '../navigation/types'
import { getDrafts, deleteDraft } from '../storage/draftStorage'
import type { LocalExpenseDraft } from '../types'

type Props = NativeStackScreenProps<AddStackParamList, 'AddHub'>

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDraftDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AddHubScreen({ navigation }: Props) {
  const [pendingDrafts, setPendingDrafts] = useState<LocalExpenseDraft[]>([])

  useFocusEffect(
    useCallback(() => {
      let active = true
      getDrafts().then((all) => {
        if (active) {
          setPendingDrafts(all.filter((d) => d.sync_status === 'pending'))
        }
      })
      return () => {
        active = false
      }
    }, []),
  )

  function handleResume(draft: LocalExpenseDraft) {
    if (!draft.captured_image_path) return
    navigation.navigate('ReceiptCapture', {
      resumeLocalId: draft.local_id,
      resumeImageUri: draft.captured_image_path,
    })
  }

  function handleDiscard(localId: string) {
    Alert.alert('Discard capture', 'This pending capture will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await deleteDraft(localId)
          setPendingDrafts((prev) => prev.filter((d) => d.local_id !== localId))
        },
      },
    ])
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add an Expense</Text>

      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => navigation.navigate('ManualEntry')}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryBtnLabel}>Manual Entry</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => navigation.navigate('ReceiptCapture', {})}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryBtnLabel}>Scan Receipt</Text>
      </TouchableOpacity>

      {pendingDrafts.length > 0 ? (
        <View style={styles.draftsSection}>
          <Text style={styles.sectionHeading}>Pending Captures</Text>
          <FlatList
            data={pendingDrafts}
            keyExtractor={(d) => d.local_id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.draftRow}>
                <View style={styles.draftInfo}>
                  <Text style={styles.draftDate}>
                    Captured {formatDraftDate(item.created_at)}
                  </Text>
                  <Text style={styles.draftStatus}>Upload incomplete</Text>
                </View>
                <View style={styles.draftActions}>
                  <TouchableOpacity
                    style={styles.resumeBtn}
                    onPress={() => handleResume(item)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.resumeBtnLabel}>Resume</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.discardBtn}
                    onPress={() => handleDiscard(item.local_id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.discardBtnLabel}>Discard</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>
      ) : null}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Pending drafts
  draftsSection: {
    marginTop: 16,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  draftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  draftInfo: {
    flex: 1,
    gap: 2,
  },
  draftDate: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  draftStatus: {
    fontSize: 12,
    color: '#92400E',
  },
  draftActions: {
    flexDirection: 'row',
    gap: 8,
  },
  resumeBtn: {
    backgroundColor: '#111827',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  resumeBtnLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  discardBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  discardBtnLabel: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
  },
})
