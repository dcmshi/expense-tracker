import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  getDrafts,
  saveDraft,
  updateDraft,
  deleteDraft,
  deleteDraftByExpenseId,
} from '../../storage/draftStorage'
import type { LocalExpenseDraft } from '../../types'

function makeDraft(overrides: Partial<LocalExpenseDraft> = {}): LocalExpenseDraft {
  return {
    local_id: 'local-1',
    sync_status: 'pending',
    edited_fields: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(async () => {
  await AsyncStorage.clear()
})

// ── getDrafts ─────────────────────────────────────────────────────────────────

describe('getDrafts', () => {
  it('returns an empty array when nothing is stored', async () => {
    expect(await getDrafts()).toEqual([])
  })

  it('returns stored drafts', async () => {
    await saveDraft(makeDraft({ local_id: 'a' }))
    await saveDraft(makeDraft({ local_id: 'b' }))
    const drafts = await getDrafts()
    expect(drafts).toHaveLength(2)
    expect(drafts.map((d) => d.local_id)).toEqual(['a', 'b'])
  })
})

// ── saveDraft ─────────────────────────────────────────────────────────────────

describe('saveDraft', () => {
  it('adds a new draft', async () => {
    await saveDraft(makeDraft({ local_id: 'new-1' }))
    const drafts = await getDrafts()
    expect(drafts).toHaveLength(1)
    expect(drafts[0].local_id).toBe('new-1')
  })

  it('replaces a draft with the same local_id', async () => {
    const draft = makeDraft({ local_id: 'existing', sync_status: 'pending' })
    await saveDraft(draft)
    await saveDraft({ ...draft, sync_status: 'uploaded' })
    const drafts = await getDrafts()
    expect(drafts).toHaveLength(1)
    expect(drafts[0].sync_status).toBe('uploaded')
  })

  it('stores multiple drafts with distinct ids', async () => {
    await saveDraft(makeDraft({ local_id: 'x' }))
    await saveDraft(makeDraft({ local_id: 'y' }))
    expect(await getDrafts()).toHaveLength(2)
  })
})

// ── updateDraft ───────────────────────────────────────────────────────────────

describe('updateDraft', () => {
  it('returns null when the draft is not found', async () => {
    expect(await updateDraft('missing', { sync_status: 'uploaded' })).toBeNull()
  })

  it('applies the patch and updates updated_at', async () => {
    await saveDraft(makeDraft({ local_id: 'u-1', sync_status: 'pending' }))
    const result = await updateDraft('u-1', { sync_status: 'uploaded', expense_id: 'exp-x' })
    expect(result?.sync_status).toBe('uploaded')
    expect(result?.expense_id).toBe('exp-x')
    expect(result?.local_id).toBe('u-1')
  })

  it('persists the patch to AsyncStorage', async () => {
    await saveDraft(makeDraft({ local_id: 'u-2' }))
    await updateDraft('u-2', { sync_status: 'uploaded' })
    const [stored] = await getDrafts()
    expect(stored.sync_status).toBe('uploaded')
  })

  it('does not alter other drafts in the list', async () => {
    await saveDraft(makeDraft({ local_id: 'keep', sync_status: 'pending' }))
    await saveDraft(makeDraft({ local_id: 'change', sync_status: 'pending' }))
    await updateDraft('change', { sync_status: 'uploaded' })
    const keep = (await getDrafts()).find((d) => d.local_id === 'keep')
    expect(keep?.sync_status).toBe('pending')
  })
})

// ── deleteDraft ───────────────────────────────────────────────────────────────

describe('deleteDraft', () => {
  it('removes the draft with the matching local_id', async () => {
    await saveDraft(makeDraft({ local_id: 'del-1' }))
    await saveDraft(makeDraft({ local_id: 'del-2' }))
    await deleteDraft('del-1')
    const remaining = await getDrafts()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].local_id).toBe('del-2')
  })

  it('is a no-op when the draft does not exist', async () => {
    await saveDraft(makeDraft({ local_id: 'keep' }))
    await deleteDraft('nonexistent')
    expect(await getDrafts()).toHaveLength(1)
  })
})

// ── deleteDraftByExpenseId ────────────────────────────────────────────────────

describe('deleteDraftByExpenseId', () => {
  it('removes the draft with the matching expense_id', async () => {
    await saveDraft(makeDraft({ local_id: 'd-1', expense_id: 'exp-1' }))
    await saveDraft(makeDraft({ local_id: 'd-2', expense_id: 'exp-2' }))
    await deleteDraftByExpenseId('exp-1')
    const remaining = await getDrafts()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].expense_id).toBe('exp-2')
  })

  it('is a no-op when no draft matches the expense_id', async () => {
    await saveDraft(makeDraft({ local_id: 'e-1', expense_id: 'exp-99' }))
    await deleteDraftByExpenseId('exp-00')
    expect(await getDrafts()).toHaveLength(1)
  })
})
