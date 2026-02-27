import request from 'supertest'
import express from 'express'
import analyticsRouter from '../../routes/analytics'
import { errorHandler } from '../../middleware/errorHandler'
import * as analyticsService from '../../services/analyticsService'

jest.mock('../../services/analyticsService')

const app = express()
app.use(express.json())
app.use('/analytics', analyticsRouter)
app.use(errorHandler)

const mockSummary = analyticsService.getAnalyticsSummary as jest.Mock
const EMPTY = { total: 0, categories: [], monthly: [] }

describe('GET /analytics/summary', () => {
  beforeEach(() => mockSummary.mockResolvedValue(EMPTY))

  it('returns 200 with the service result', async () => {
    const data = { total: 150, categories: [{ category: 'Groceries', total: 150, count: 2 }], monthly: [] }
    mockSummary.mockResolvedValueOnce(data)
    const res = await request(app).get('/analytics/summary')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(data)
  })

  it('defaults to a 30-day window when no params supplied', async () => {
    await request(app).get('/analytics/summary')
    const [from, to] = mockSummary.mock.calls[0] as [Date, Date]
    const diffDays = Math.round((to.getTime() - from.getTime()) / 86_400_000)
    expect(diffDays).toBe(30)
  })

  it('passes explicit from/to dates to the service', async () => {
    await request(app).get('/analytics/summary?from=2026-01-01&to=2026-01-31')
    const [from, to] = mockSummary.mock.calls[0] as [Date, Date]
    expect(from).toEqual(new Date('2026-01-01'))
    expect(to).toEqual(new Date('2026-01-31'))
  })

  it('returns 400 for a malformed from date', async () => {
    const res = await request(app).get('/analytics/summary?from=not-a-date')
    expect(res.status).toBe(400)
  })

  it('returns 400 for a malformed to date', async () => {
    const res = await request(app).get('/analytics/summary?to=2026/01/31')
    expect(res.status).toBe(400)
  })
})
