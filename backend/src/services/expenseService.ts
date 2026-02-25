import prisma from '../lib/db'

// listExpenses — returns all expenses ordered by created_at DESC
export async function listExpenses() {
  // TODO
}

// getExpense — returns a single expense by id
// Used by client to poll processing_status after receipt ingestion
export async function getExpense(id: string) {
  // TODO
}

// createManualExpense — creates a new manually-entered expense
// Sets: source=manual, confidence=1.0, processing_status=verified, is_user_verified=true
export async function createManualExpense(data: {
  amount: number
  currency?: string
  merchant?: string
  category?: string
  date: string
  notes?: string
}) {
  // TODO
}

// updateExpense — partial update of editable fields
// If is_user_verified is set to true, also sets processing_status to 'verified'
export async function updateExpense(
  id: string,
  data: {
    amount?: number
    merchant?: string
    category?: string
    date?: string
    notes?: string
    is_user_verified?: boolean
  },
) {
  // TODO
}

// deleteExpense — deletes expense; ON DELETE CASCADE removes processing_jobs
export async function deleteExpense(id: string) {
  // TODO
}
