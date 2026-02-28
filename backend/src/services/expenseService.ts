import prisma from '../lib/db'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateManualExpenseInput {
  amount: number
  currency?: string
  merchant?: string
  category?: string
  date: string   // YYYY-MM-DD
  notes?: string
}

export interface UpdateExpenseInput {
  amount?: number
  merchant?: string
  category?: string
  date?: string  // YYYY-MM-DD
  notes?: string
  is_user_verified?: boolean
}

// Normalises a Prisma Expense record into a plain API-safe object:
//   - Decimal  → string  (avoids floating-point ambiguity for financial values)
//   - Date     → 'YYYY-MM-DD' string
//   - DateTime → ISO string
function serializeExpense(expense: Awaited<ReturnType<typeof prisma.expense.findUniqueOrThrow>>) {
  return {
    ...expense,
    amount:     expense.amount     != null ? Number(expense.amount).toFixed(2)     : null,
    confidence: expense.confidence != null ? Number(expense.confidence).toFixed(3) : null,
    date:       expense.date?.toISOString().split('T')[0]           ?? null,
    created_at: expense.created_at.toISOString(),
    updated_at: expense.updated_at.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// listExpenses
// ---------------------------------------------------------------------------

export async function listExpenses() {
  const expenses = await prisma.expense.findMany({
    orderBy: { created_at: 'desc' },
  })
  return expenses.map(serializeExpense)
}

// ---------------------------------------------------------------------------
// getExpense
// ---------------------------------------------------------------------------

// Returns null if not found — route layer throws 404.
export async function getExpense(id: string) {
  const expense = await prisma.expense.findUnique({ where: { id } })
  return expense ? serializeExpense(expense) : null
}

// ---------------------------------------------------------------------------
// createManualExpense
// ---------------------------------------------------------------------------

// Manual entries are immediately verified:
//   source=manual, confidence=1.0, processing_status=verified, is_user_verified=true
export async function createManualExpense(data: CreateManualExpenseInput) {
  const expense = await prisma.expense.create({
    data: {
      source:            'manual',
      processing_status: 'verified',
      is_user_verified:  true,
      confidence:        1.0,
      amount:            data.amount,
      currency:          data.currency ?? 'CAD',
      merchant:          data.merchant,
      category:          data.category,
      date:              new Date(data.date),
      notes:             data.notes,
      raw_input:         {},
    },
  })
  return serializeExpense(expense)
}

// ---------------------------------------------------------------------------
// updateExpense
// ---------------------------------------------------------------------------

// Returns null if expense not found — route layer throws 404.
// When is_user_verified is set to true:
//   - Expense.processing_status → 'verified'
//   - ProcessingJob.status      → 'verified' (if a job exists; no-op for manual entries)
// Both updates are wrapped in a transaction to stay consistent.
export async function updateExpense(id: string, data: UpdateExpenseInput) {
  const exists = await prisma.expense.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!exists) return null

  const expenseData: Record<string, unknown> = {}
  if (data.amount            !== undefined) expenseData.amount   = data.amount
  if (data.merchant          !== undefined) expenseData.merchant = data.merchant
  if (data.category          !== undefined) expenseData.category = data.category
  if (data.date              !== undefined) expenseData.date     = new Date(data.date)
  if (data.notes             !== undefined) expenseData.notes    = data.notes
  if (data.is_user_verified  === true) {
    expenseData.is_user_verified  = true
    expenseData.processing_status = 'verified'
  }

  const expense = await prisma.$transaction(async (tx) => {
    const updated = await tx.expense.update({ where: { id }, data: expenseData })

    if (data.is_user_verified === true) {
      // Sync the linked job if one exists (no-op for manual expenses)
      await tx.processingJob.updateMany({
        where: { expense_id: id },
        data:  { status: 'verified' },
      })
    }

    return updated
  })

  return serializeExpense(expense)
}

// ---------------------------------------------------------------------------
// deleteExpense
// ---------------------------------------------------------------------------

// Returns false if not found — route layer throws 404.
// ON DELETE CASCADE in the DB removes any linked ProcessingJob automatically.
export async function deleteExpense(id: string) {
  const exists = await prisma.expense.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!exists) return false

  await prisma.expense.delete({ where: { id } })
  return true
}
