// expenses.e2e.test.ts
// Full CRUD lifecycle against a real PostgreSQL test database.

import request from 'supertest'
import prisma from '../../lib/db'
import { createApp, truncateAll } from './helpers'

const app = createApp()

beforeEach(async () => { await truncateAll() })
afterAll(async () => { await prisma.$disconnect() })

// ── POST /expenses ─────────────────────────────────────────────────────────

describe('POST /expenses', () => {
  it('creates expense with all fields and persists to DB → 201', async () => {
    const res = await request(app)
      .post('/expenses')
      .send({
        amount:   42.50,
        currency: 'CAD',
        merchant: 'Tim Hortons',
        category: 'Coffee',
        date:     '2026-02-01',
        notes:    'Large double-double',
      })

    expect(res.status).toBe(201)
    expect(res.body.expense).toMatchObject({
      amount:            '42.50',
      currency:          'CAD',
      merchant:          'Tim Hortons',
      category:          'Coffee',
      date:              '2026-02-01',
      notes:             'Large double-double',
      source:            'manual',
      processing_status: 'verified',
      is_user_verified:  true,
      confidence:        '1.000',
    })
    // UUID format
    expect(res.body.expense.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )

    // Verify the record actually landed in the database
    const row = await prisma.expense.findUnique({ where: { id: res.body.expense.id } })
    expect(row).not.toBeNull()
    expect(row!.merchant).toBe('Tim Hortons')
    expect(Number(row!.amount)).toBe(42.5)
    expect(row!.processing_status).toBe('verified')
    expect(row!.is_user_verified).toBe(true)
  })

  it('creates expense with minimal fields and defaults currency to CAD → 201', async () => {
    const res = await request(app)
      .post('/expenses')
      .send({ amount: 10, date: '2026-02-01' })

    expect(res.status).toBe(201)
    expect(res.body.expense.currency).toBe('CAD')
    expect(res.body.expense.merchant).toBeNull()
  })

  it('rejects missing amount → 400', async () => {
    const res = await request(app).post('/expenses').send({ date: '2026-02-01' })
    expect(res.status).toBe(400)
  })

  it('rejects missing date → 400', async () => {
    const res = await request(app).post('/expenses').send({ amount: 10 })
    expect(res.status).toBe(400)
  })

  it('rejects invalid date format → 400', async () => {
    const res = await request(app).post('/expenses').send({ amount: 10, date: '01-02-2026' })
    expect(res.status).toBe(400)
  })

  it('rejects non-positive amount → 400', async () => {
    const res = await request(app).post('/expenses').send({ amount: 0, date: '2026-02-01' })
    expect(res.status).toBe(400)
  })
})

// ── GET /expenses ──────────────────────────────────────────────────────────

describe('GET /expenses', () => {
  it('returns empty array when no expenses exist', async () => {
    const res = await request(app).get('/expenses')
    expect(res.status).toBe(200)
    expect(res.body.expenses).toEqual([])
  })

  it('returns all expenses ordered by created_at DESC', async () => {
    await request(app).post('/expenses').send({ amount: 10, date: '2026-01-01', merchant: 'First' })
    await request(app).post('/expenses').send({ amount: 20, date: '2026-01-02', merchant: 'Second' })

    const res = await request(app).get('/expenses')
    expect(res.status).toBe(200)
    expect(res.body.expenses).toHaveLength(2)
    // Most recently created is first
    expect(res.body.expenses[0].merchant).toBe('Second')
    expect(res.body.expenses[1].merchant).toBe('First')
  })
})

// ── GET /expenses/:id ──────────────────────────────────────────────────────

describe('GET /expenses/:id', () => {
  it('returns the expense when found', async () => {
    const created = await request(app)
      .post('/expenses')
      .send({ amount: 15, date: '2026-02-01', merchant: 'Starbucks' })
    const { id } = created.body.expense

    const res = await request(app).get(`/expenses/${id}`)
    expect(res.status).toBe(200)
    expect(res.body.expense.id).toBe(id)
    expect(res.body.expense.merchant).toBe('Starbucks')
  })

  it('returns 404 for a non-existent UUID', async () => {
    const res = await request(app).get('/expenses/00000000-0000-0000-0000-000000000000')
    expect(res.status).toBe(404)
  })
})

// ── PATCH /expenses/:id ────────────────────────────────────────────────────

describe('PATCH /expenses/:id', () => {
  it('updates editable fields and persists to DB → 200', async () => {
    const created = await request(app)
      .post('/expenses')
      .send({ amount: 10, date: '2026-02-01' })
    const { id } = created.body.expense

    const res = await request(app)
      .patch(`/expenses/${id}`)
      .send({ merchant: 'Updated Merchant', amount: 99.99, category: 'Travel' })

    expect(res.status).toBe(200)
    expect(res.body.expense.merchant).toBe('Updated Merchant')
    expect(res.body.expense.amount).toBe('99.99')
    expect(res.body.expense.category).toBe('Travel')

    // Verify persistence
    const row = await prisma.expense.findUnique({ where: { id } })
    expect(row!.merchant).toBe('Updated Merchant')
    expect(Number(row!.amount)).toBe(99.99)
  })

  it('sets processing_status=verified when is_user_verified=true → 200', async () => {
    const created = await request(app)
      .post('/expenses')
      .send({ amount: 50, date: '2026-02-01' })
    const { id } = created.body.expense

    const res = await request(app)
      .patch(`/expenses/${id}`)
      .send({ is_user_verified: true })

    expect(res.status).toBe(200)
    expect(res.body.expense.is_user_verified).toBe(true)
    expect(res.body.expense.processing_status).toBe('verified')
  })

  it('returns 404 for a non-existent UUID', async () => {
    const res = await request(app)
      .patch('/expenses/00000000-0000-0000-0000-000000000000')
      .send({ merchant: 'X' })
    expect(res.status).toBe(404)
  })

  it('returns 400 for an empty body', async () => {
    const created = await request(app)
      .post('/expenses')
      .send({ amount: 10, date: '2026-02-01' })
    const { id } = created.body.expense

    const res = await request(app).patch(`/expenses/${id}`).send({})
    expect(res.status).toBe(400)
  })
})

// ── DELETE /expenses/:id ───────────────────────────────────────────────────

describe('DELETE /expenses/:id', () => {
  it('deletes the expense and removes it from the DB → 204', async () => {
    const created = await request(app)
      .post('/expenses')
      .send({ amount: 10, date: '2026-02-01', merchant: 'ToDelete' })
    const { id } = created.body.expense

    const deleteRes = await request(app).delete(`/expenses/${id}`)
    expect(deleteRes.status).toBe(204)

    // Gone from DB
    const row = await prisma.expense.findUnique({ where: { id } })
    expect(row).toBeNull()

    // Gone from list
    const listRes = await request(app).get('/expenses')
    expect(listRes.body.expenses).toHaveLength(0)
  })

  it('returns 404 for a non-existent UUID', async () => {
    const res = await request(app).delete('/expenses/00000000-0000-0000-0000-000000000000')
    expect(res.status).toBe(404)
  })
})
