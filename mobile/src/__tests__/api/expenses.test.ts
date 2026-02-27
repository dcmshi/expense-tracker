import * as expensesApi from '../../api/expenses'
import client from '../../api/client'

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    get:    jest.fn(),
    post:   jest.fn(),
    patch:  jest.fn(),
    delete: jest.fn(),
    put:    jest.fn(),
  },
}))

const mockGet    = client.get    as jest.Mock
const mockPost   = client.post   as jest.Mock
const mockPatch  = client.patch  as jest.Mock
const mockDelete = client.delete as jest.Mock

const EXPENSE = {
  id: 'exp-1',
  user_id: null,
  amount: '42.00',
  currency: 'CAD',
  merchant: 'Metro',
  category: 'Groceries',
  date: '2026-01-01',
  notes: null,
  source: 'manual' as const,
  receipt_url: null,
  raw_input: {},
  confidence: '1.000',
  is_user_verified: true,
  processing_status: 'verified' as const,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

describe('listExpenses', () => {
  it('calls GET /expenses and returns the data array', async () => {
    mockGet.mockResolvedValueOnce({ data: [EXPENSE] })
    const result = await expensesApi.listExpenses()
    expect(result).toEqual([EXPENSE])
    expect(mockGet).toHaveBeenCalledWith('/expenses')
  })

  it('returns an empty array when no expenses exist', async () => {
    mockGet.mockResolvedValueOnce({ data: [] })
    expect(await expensesApi.listExpenses()).toEqual([])
  })
})

describe('getExpense', () => {
  it('calls GET /expenses/:id and returns the expense', async () => {
    mockGet.mockResolvedValueOnce({ data: EXPENSE })
    const result = await expensesApi.getExpense('exp-1')
    expect(result).toEqual(EXPENSE)
    expect(mockGet).toHaveBeenCalledWith('/expenses/exp-1')
  })
})

describe('createExpense', () => {
  it('posts to /expenses and returns the created expense', async () => {
    const body = { amount: '42.00', date: '2026-01-01', merchant: 'Metro' }
    mockPost.mockResolvedValueOnce({ data: EXPENSE })
    const result = await expensesApi.createExpense(body)
    expect(result).toEqual(EXPENSE)
    expect(mockPost).toHaveBeenCalledWith('/expenses', body)
  })
})

describe('updateExpense', () => {
  it('patches /expenses/:id and returns the updated expense', async () => {
    const body = { merchant: 'Costco' }
    const updated = { ...EXPENSE, merchant: 'Costco' }
    mockPatch.mockResolvedValueOnce({ data: updated })
    const result = await expensesApi.updateExpense('exp-1', body)
    expect(result).toEqual(updated)
    expect(mockPatch).toHaveBeenCalledWith('/expenses/exp-1', body)
  })
})

describe('deleteExpense', () => {
  it('calls DELETE /expenses/:id', async () => {
    mockDelete.mockResolvedValueOnce({ data: null })
    await expensesApi.deleteExpense('exp-1')
    expect(mockDelete).toHaveBeenCalledWith('/expenses/exp-1')
  })
})
