import request from 'supertest'
import express from 'express'
import expensesRouter from '../../routes/expenses'
import { errorHandler } from '../../middleware/errorHandler'
import * as expenseService from '../../services/expenseService'

jest.mock('../../services/expenseService')

const app = express()
app.use(express.json())
app.use('/expenses', expensesRouter)
app.use(errorHandler)

const mockList   = expenseService.listExpenses    as jest.Mock
const mockGet    = expenseService.getExpense      as jest.Mock
const mockCreate = expenseService.createManualExpense as jest.Mock
const mockUpdate = expenseService.updateExpense   as jest.Mock
const mockDelete = expenseService.deleteExpense   as jest.Mock

const EXPENSE = {
  id: 'exp-1', amount: '10.00', currency: 'CAD', merchant: 'Tim Hortons',
  category: 'Restaurant', date: '2026-02-17', notes: null, source: 'manual',
  receipt_url: null, raw_input: {}, confidence: '1.000',
  is_user_verified: true, processing_status: 'verified',
  created_at: '2026-02-17T10:00:00.000Z', updated_at: '2026-02-17T10:00:00.000Z',
  user_id: null,
}

// ── GET /expenses ─────────────────────────────────────────────────────────────

describe('GET /expenses', () => {
  it('returns 200 with expenses array', async () => {
    mockList.mockResolvedValueOnce([EXPENSE])
    const res = await request(app).get('/expenses')
    expect(res.status).toBe(200)
    expect(res.body.expenses).toHaveLength(1)
    expect(res.body.expenses[0].id).toBe('exp-1')
  })

  it('returns 200 with empty array', async () => {
    mockList.mockResolvedValueOnce([])
    const res = await request(app).get('/expenses')
    expect(res.status).toBe(200)
    expect(res.body.expenses).toEqual([])
  })
})

// ── GET /expenses/:id ─────────────────────────────────────────────────────────

describe('GET /expenses/:id', () => {
  it('returns 200 with expense when found', async () => {
    mockGet.mockResolvedValueOnce(EXPENSE)
    const res = await request(app).get('/expenses/exp-1')
    expect(res.status).toBe(200)
    expect(res.body.expense.id).toBe('exp-1')
  })

  it('returns 404 when expense not found', async () => {
    mockGet.mockResolvedValueOnce(null)
    const res = await request(app).get('/expenses/missing')
    expect(res.status).toBe(404)
  })
})

// ── POST /expenses ────────────────────────────────────────────────────────────

describe('POST /expenses', () => {
  it('returns 201 with created expense', async () => {
    mockCreate.mockResolvedValueOnce(EXPENSE)
    const res = await request(app)
      .post('/expenses')
      .send({ amount: 10, date: '2026-02-17', currency: 'CAD' })
    expect(res.status).toBe(201)
    expect(res.body.expense.id).toBe('exp-1')
  })

  it('returns 400 when amount is missing', async () => {
    const res = await request(app).post('/expenses').send({ date: '2026-02-17' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when date is missing', async () => {
    const res = await request(app).post('/expenses').send({ amount: 10 })
    expect(res.status).toBe(400)
  })

  it('returns 400 when date format is invalid', async () => {
    const res = await request(app).post('/expenses').send({ amount: 10, date: '17-02-2026' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when amount is not positive', async () => {
    const res = await request(app).post('/expenses').send({ amount: 0, date: '2026-02-17' })
    expect(res.status).toBe(400)
  })
})

// ── PATCH /expenses/:id ───────────────────────────────────────────────────────

describe('PATCH /expenses/:id', () => {
  it('returns 200 with updated expense', async () => {
    mockUpdate.mockResolvedValueOnce({ ...EXPENSE, merchant: 'Starbucks' })
    const res = await request(app)
      .patch('/expenses/exp-1')
      .send({ merchant: 'Starbucks' })
    expect(res.status).toBe(200)
    expect(res.body.expense.merchant).toBe('Starbucks')
  })

  it('returns 404 when expense not found', async () => {
    mockUpdate.mockResolvedValueOnce(null)
    const res = await request(app).patch('/expenses/missing').send({ merchant: 'X' })
    expect(res.status).toBe(404)
  })

  it('returns 400 when body is empty', async () => {
    const res = await request(app).patch('/expenses/exp-1').send({})
    expect(res.status).toBe(400)
  })
})

// ── DELETE /expenses/:id ──────────────────────────────────────────────────────

describe('DELETE /expenses/:id', () => {
  it('returns 204 when expense is deleted', async () => {
    mockDelete.mockResolvedValueOnce(true)
    const res = await request(app).delete('/expenses/exp-1')
    expect(res.status).toBe(204)
  })

  it('returns 404 when expense not found', async () => {
    mockDelete.mockResolvedValueOnce(false)
    const res = await request(app).delete('/expenses/missing')
    expect(res.status).toBe(404)
  })
})
