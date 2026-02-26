import NetInfo from '@react-native-community/netinfo'
import * as Crypto from 'expo-crypto'
import { getDrafts, updateDraft } from '../storage/draftStorage'
import { createPresignedUpload } from '../api/uploads'
import { ingestReceipt, ingestVoice } from '../api/ingest'
import { preprocessImage, uploadToPresignedUrl } from './uploadHelpers'
import type { LocalExpenseDraft } from '../types'

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let _unsubscribe: (() => void) | null = null
let _isSyncing = false
let _isConnected = false

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function startListening(): void {
  if (_unsubscribe) return // already listening

  _unsubscribe = NetInfo.addEventListener((state) => {
    const nowConnected =
      state.isConnected === true && state.isInternetReachable !== false
    const justCameOnline = nowConnected && !_isConnected
    _isConnected = nowConnected

    if (justCameOnline) {
      void syncPendingDrafts()
    }
  })
}

export function stopListening(): void {
  _unsubscribe?.()
  _unsubscribe = null
}

// ---------------------------------------------------------------------------
// Sync logic
// ---------------------------------------------------------------------------

async function syncPendingDrafts(): Promise<void> {
  if (_isSyncing) return
  _isSyncing = true

  try {
    const drafts = await getDrafts()
    const pending = drafts.filter((d) => d.sync_status === 'pending')

    if (pending.length > 0) {
      console.log(`[syncManager] Syncing ${pending.length} pending draft(s)`)
    }

    for (const draft of pending) {
      try {
        await syncOneDraft(draft)
      } catch (err) {
        // Leave as pending; will retry on next reconnect
        console.warn(`[syncManager] Failed to sync draft ${draft.local_id}:`, err)
      }
    }
  } finally {
    _isSyncing = false
  }
}

async function syncOneDraft(draft: LocalExpenseDraft): Promise<void> {
  const idempotencyKey = Crypto.randomUUID()

  if (draft.captured_image_path) {
    // Receipt draft
    const processedUri = await preprocessImage(draft.captured_image_path)
    const { presigned_url, object_key } = await createPresignedUpload(idempotencyKey)
    await uploadToPresignedUrl(presigned_url, processedUri)
    const { expense_id } = await ingestReceipt(object_key, idempotencyKey)
    await updateDraft(draft.local_id, { sync_status: 'uploaded', expense_id })
    console.log(`[syncManager] Receipt draft ${draft.local_id} → synced (expense ${expense_id})`)
  } else if (draft.transcript_text) {
    // Voice draft
    const { expense_id } = await ingestVoice(draft.transcript_text, idempotencyKey)
    await updateDraft(draft.local_id, { sync_status: 'uploaded', expense_id })
    console.log(`[syncManager] Voice draft ${draft.local_id} → synced (expense ${expense_id})`)
  } else {
    console.warn(`[syncManager] Draft ${draft.local_id} has neither image nor transcript — skipping`)
  }
}
