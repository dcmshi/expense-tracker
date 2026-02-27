import { ingestReceipt, ingestVoice } from '../../services/ingestService'
import prisma from '../../lib/db'

const mockFindUnique  = prisma.processingJob.findUnique as jest.Mock
const mockTransaction = prisma.$transaction              as jest.Mock

// Minimal fake expense returned by tx.expense.create
const fakeExpense = {
  id:                'expense-uuid',
  processing_status: 'uploaded',
}

// Minimal fake job
const fakeJob = { job_id: 'job-uuid', expense_id: fakeExpense.id }

beforeEach(() => {
  // Default: no existing job (first-time call)
  mockFindUnique.mockResolvedValue(null)

  // $transaction calls our callback with a tx that mirrors the mock prisma
  mockTransaction.mockImplementation(async (fn: Function) =>
    fn({
      expense:       { create: jest.fn().mockResolvedValue(fakeExpense) },
      processingJob: { create: jest.fn().mockResolvedValue(fakeJob)    },
    }),
  )
})

// ── ingestReceipt ─────────────────────────────────────────────────────────────

describe('ingestReceipt', () => {
  it('creates an expense + job and returns expense_id on first call', async () => {
    const result = await ingestReceipt('receipts/test.jpg', 'idempotency-key-1')

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { idempotency_key: 'idempotency-key-1' },
      include: expect.any(Object),
    })
    expect(mockTransaction).toHaveBeenCalled()
    expect(result.expense_id).toBe(fakeExpense.id)
    expect(result.processing_status).toBe('uploaded')
  })

  it('returns the existing expense_id on a duplicate call (idempotency)', async () => {
    const existingJob = {
      expense_id: 'existing-expense-uuid',
      expense: { processing_status: 'processing' },
    }
    mockFindUnique.mockResolvedValueOnce(existingJob)

    const result = await ingestReceipt('receipts/test.jpg', 'idempotency-key-1')

    expect(mockTransaction).not.toHaveBeenCalled()
    expect(result.expense_id).toBe('existing-expense-uuid')
    expect(result.processing_status).toBe('processing')
  })
})

// ── ingestVoice ───────────────────────────────────────────────────────────────

describe('ingestVoice', () => {
  it('creates an expense + job and returns expense_id on first call', async () => {
    const result = await ingestVoice('spent $10 at Metro today', 'idempotency-key-2')

    expect(mockTransaction).toHaveBeenCalled()
    expect(result.expense_id).toBe(fakeExpense.id)
    expect(result.processing_status).toBe('uploaded')
  })

  it('returns the existing result on a duplicate call (idempotency)', async () => {
    const existingJob = {
      expense_id: 'voice-expense-uuid',
      expense: { processing_status: 'awaiting_user' },
    }
    mockFindUnique.mockResolvedValueOnce(existingJob)

    const result = await ingestVoice('transcript', 'idempotency-key-2')

    expect(mockTransaction).not.toHaveBeenCalled()
    expect(result.expense_id).toBe('voice-expense-uuid')
    expect(result.processing_status).toBe('awaiting_user')
  })
})
