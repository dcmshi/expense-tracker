// analytics.e2e.test.ts
// GET /analytics/summary with real database seeded via the expenses API.

import request from 'supertest'
import prisma from '../../lib/db'
import { createApp, truncateAll } from './helpers'

const app = createApp()

beforeEach(async () => { await truncateAll() })
afterAll(async () => { await prisma.$disconnect() })

// ── GET /analytics/summary ─────────────────────────────────────────────────

describe('GET /analytics/summary', () => {
  it('returns zero totals and empty arrays when there are no expenses', async () => {
    const res = await request(app).get('/analytics/summary?from=2026-01-01&to=2026-12-31')

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(0)
    expect(res.body.categories).toEqual([])
    expect(res.body.monthly).toEqual([])
  })

  it('returns correct category breakdown and grand total for verified expenses', async () => {
    // Seed three verified manual expenses across two categories
    await request(app).post('/expenses').send({ amount: 40, date: '2026-01-10', category: 'Groceries' })
    await request(app).post('/expenses').send({ amount: 60, date: '2026-01-15', category: 'Groceries' })
    await request(app).post('/expenses').send({ amount: 25, date: '2026-01-20', category: 'Coffee'    })

    const res = await request(app).get('/analytics/summary?from=2026-01-01&to=2026-01-31')

    expect(res.status).toBe(200)
    expect(res.body.total).toBeCloseTo(125, 2)

    const categories: Array<{ category: string | null; total: number; count: number }> =
      res.body.categories
    const groceries = categories.find((c) => c.category === 'Groceries')
    const coffee    = categories.find((c) => c.category === 'Coffee')

    expect(groceries).toBeDefined()
    expect(groceries!.total).toBeCloseTo(100, 2)
    expect(groceries!.count).toBe(2)

    expect(coffee).toBeDefined()
    expect(coffee!.total).toBeCloseTo(25, 2)
    expect(coffee!.count).toBe(1)
  })

  it('excludes expenses that are still in-flight (uploaded / processing / failed)', async () => {
    // One verified manual expense
    await request(app).post('/expenses').send({ amount: 100, date: '2026-02-01', category: 'Travel' })

    // Seed an in-flight receipt expense directly in DB
    await prisma.expense.create({
      data: {
        source:            'receipt',
        processing_status: 'uploaded',
        amount:            999,
        date:              new Date('2026-02-01'),
        raw_input:         {},
        is_user_verified:  false,
      },
    })

    const res = await request(app).get('/analytics/summary?from=2026-02-01&to=2026-02-28')

    expect(res.status).toBe(200)
    // Only the verified expense counts
    expect(res.body.total).toBeCloseTo(100, 2)
    const categories: Array<{ category: string | null }> = res.body.categories
    expect(categories).toHaveLength(1)
    expect(categories[0].category).toBe('Travel')
  })

  it('returns correct monthly breakdown', async () => {
    await request(app).post('/expenses').send({ amount: 50, date: '2026-01-05' })
    await request(app).post('/expenses').send({ amount: 30, date: '2026-01-20' })
    await request(app).post('/expenses').send({ amount: 70, date: '2026-02-10' })

    const res = await request(app).get('/analytics/summary?from=2026-01-01&to=2026-02-28')

    expect(res.status).toBe(200)
    const monthly: Array<{ month: string; total: number; count: number }> = res.body.monthly

    const jan = monthly.find((m) => m.month === '2026-01')
    const feb = monthly.find((m) => m.month === '2026-02')

    expect(jan).toBeDefined()
    expect(jan!.total).toBeCloseTo(80, 2)
    expect(jan!.count).toBe(2)

    expect(feb).toBeDefined()
    expect(feb!.total).toBeCloseTo(70, 2)
    expect(feb!.count).toBe(1)
  })

  it('date-range filter excludes expenses outside the window', async () => {
    await request(app).post('/expenses').send({ amount: 100, date: '2025-12-31' }) // before range
    await request(app).post('/expenses').send({ amount: 50,  date: '2026-01-15' }) // in range
    await request(app).post('/expenses').send({ amount: 200, date: '2027-01-01' }) // after range

    const res = await request(app).get('/analytics/summary?from=2026-01-01&to=2026-12-31')

    expect(res.status).toBe(200)
    expect(res.body.total).toBeCloseTo(50, 2)
  })

  it('returns 400 for an invalid date in query params', async () => {
    const res = await request(app).get('/analytics/summary?from=not-a-date')
    expect(res.status).toBe(400)
  })
})
