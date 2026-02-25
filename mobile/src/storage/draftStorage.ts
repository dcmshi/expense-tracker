import AsyncStorage from '@react-native-async-storage/async-storage'
import type { LocalExpenseDraft } from '../types'

const STORAGE_KEY = '@expense-tracker/drafts'

async function readAll(): Promise<LocalExpenseDraft[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  return JSON.parse(raw) as LocalExpenseDraft[]
}

async function writeAll(drafts: LocalExpenseDraft[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
}

export async function getDrafts(): Promise<LocalExpenseDraft[]> {
  return readAll()
}

export async function saveDraft(draft: LocalExpenseDraft): Promise<void> {
  const drafts = await readAll()
  const exists = drafts.findIndex((d) => d.local_id === draft.local_id)
  if (exists >= 0) {
    drafts[exists] = draft
  } else {
    drafts.push(draft)
  }
  await writeAll(drafts)
}

export async function updateDraft(
  localId: string,
  patch: Partial<Omit<LocalExpenseDraft, 'local_id' | 'created_at'>>,
): Promise<LocalExpenseDraft | null> {
  const drafts = await readAll()
  const index = drafts.findIndex((d) => d.local_id === localId)
  if (index < 0) return null
  const updated: LocalExpenseDraft = {
    ...drafts[index],
    ...patch,
    updated_at: new Date().toISOString(),
  }
  drafts[index] = updated
  await writeAll(drafts)
  return updated
}

export async function deleteDraft(localId: string): Promise<void> {
  const drafts = await readAll()
  await writeAll(drafts.filter((d) => d.local_id !== localId))
}

export async function deleteDraftByExpenseId(expenseId: string): Promise<void> {
  const drafts = await readAll()
  await writeAll(drafts.filter((d) => d.expense_id !== expenseId))
}
