import {
  listExpenses,
  getExpense,
  createManualExpense,
  updateExpense,
  deleteExpense,
} from '../../services/expenseService'
import prisma from '../../lib/db'

// Helpers to build minimal Prisma-shaped expense records
function makeExpense(overrides: Record<string, unknown> = {}) {
  return {
    id:                'exp-1',
    user_id:           null,
    amount:            { toString: () => '25.00' },
    currency:          'CAD',
    merchant:          'Tim Hortons',
    category:          'Restaurant',
    date:              new Date('2026-02-17'),
    notes:             null,
    source:            'manual',
    receipt_url:       null,
    raw_input:         {},
    confidence:        { toString: () => '1.000' },
    is_user_verified:  true,
    processing_status: 'verified',
    created_at:        new Date('2026-02-17T10:00:00Z'),
    updated_at:        new Date('2026-02-17T10:00:00Z'),
    ...overrides,
  }
}

const mockFindMany    = prisma.expense.findMany    as jest.Mock
const mockFindUnique  = prisma.expense.findUnique  as jest.Mock
const mockCreate      = prisma.expense.create      as jest.Mock
const mockUpdate      = prisma.expense.update      as jest.Mock
const mockDelete      = prisma.expense.delete      as jest.Mock
const mockTransaction = prisma.$transaction        as jest.Mock

// ── listExpenses ──────────────────────────────────────────────────────────────

describe('listExpenses', () => {
  it('returns serialised expenses ordered by created_at desc', async () => {
    mockFindMany.mockResolvedValueOnce([makeExpense()])
    const result = await listExpenses()
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe('25.00')      // Decimal → string
    expect(result[0].date).toBe('2026-02-17')   // Date → YYYY-MM-DD
  })

  it('returns empty array when no expenses exist', async () => {
    mockFindMany.mockResolvedValueOnce([])
    expect(await listExpenses()).toEqual([])
  })
})

// ── getExpense ────────────────────────────────────────────────────────────────

describe('getExpense', () => {
  it('returns serialised expense when found', async () => {
    mockFindUnique.mockResolvedValueOnce(makeExpense())
    const result = await getExpense('exp-1')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('exp-1')
  })

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    expect(await getExpense('missing-id')).toBeNull()
  })
})

// ── createManualExpense ───────────────────────────────────────────────────────

describe('createManualExpense', () => {
  it('creates an expense with source=manual and verified status', async () => {
    mockCreate.mockResolvedValueOnce(makeExpense())
    const result = await createManualExpense({
      amount: 25,
      date:   '2026-02-17',
    })
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source:            'manual',
          processing_status: 'verified',
          is_user_verified:  true,
          confidence:        1.0,
        }),
      }),
    )
    expect(result.amount).toBe('25.00')
  })

  it('uses CAD as default currency', async () => {
    mockCreate.mockResolvedValueOnce(makeExpense())
    await createManualExpense({ amount: 10, date: '2026-01-01' })
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currency: 'CAD' }),
      }),
    )
  })
})

// ── updateExpense ─────────────────────────────────────────────────────────────

describe('updateExpense', () => {
  it('returns null when expense does not exist', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    expect(await updateExpense('missing-id', { amount: 10 })).toBeNull()
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('updates fields and returns serialised expense', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: 'exp-1' })
    const updated = makeExpense({ merchant: 'Starbucks' })
    mockTransaction.mockImplementationOnce(async (fn: Function) =>
      fn({
        expense:       { update: jest.fn().mockResolvedValue(updated)  },
        processingJob: { updateMany: jest.fn().mockResolvedValue({})   },
      }),
    )
    const result = await updateExpense('exp-1', { merchant: 'Starbucks' })
    expect(result!.merchant).toBe('Starbucks')
  })

  it('sets processing_status=verified when is_user_verified=true', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: 'exp-1' })
    const txExpenseUpdate = jest.fn().mockResolvedValue(makeExpense())
    const txJobUpdateMany = jest.fn().mockResolvedValue({})
    mockTransaction.mockImplementationOnce(async (fn: Function) =>
      fn({ expense: { update: txExpenseUpdate }, processingJob: { updateMany: txJobUpdateMany } }),
    )

    await updateExpense('exp-1', { is_user_verified: true })

    expect(txExpenseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          is_user_verified:  true,
          processing_status: 'verified',
        }),
      }),
    )
    expect(txJobUpdateMany).toHaveBeenCalled()
  })
})

// ── deleteExpense ─────────────────────────────────────────────────────────────

describe('deleteExpense', () => {
  it('returns false when expense does not exist', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    expect(await deleteExpense('missing-id')).toBe(false)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('deletes and returns true when expense exists', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: 'exp-1' })
    mockDelete.mockResolvedValueOnce({})
    expect(await deleteExpense('exp-1')).toBe(true)
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'exp-1' } })
  })
})
