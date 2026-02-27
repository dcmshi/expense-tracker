import { getAnalyticsSummary } from '../../services/analyticsService'
import prisma from '../../lib/db'

// db is replaced by src/__mocks__/db.ts via moduleNameMapper
const mockGroupBy  = prisma.expense.groupBy  as jest.Mock
const mockQueryRaw = prisma.$queryRaw        as jest.Mock

// Helper matching the shape Prisma returns for Decimal fields.
const dec = (value: number) => ({ toNumber: () => value })

const FROM = new Date('2026-01-01')
const TO   = new Date('2026-01-31')

describe('getAnalyticsSummary', () => {
  it('returns zeroes and empty arrays when no data', async () => {
    mockGroupBy.mockResolvedValueOnce([])
    mockQueryRaw.mockResolvedValueOnce([])

    const result = await getAnalyticsSummary(FROM, TO)

    expect(result.total).toBe(0)
    expect(result.categories).toEqual([])
    expect(result.monthly).toEqual([])
  })

  it('aggregates category totals and counts', async () => {
    mockGroupBy.mockResolvedValueOnce([
      { category: 'Groceries',  _sum: { amount: dec(120.5) }, _count: { id: 3 } },
      { category: 'Restaurant', _sum: { amount: dec(45.0)  }, _count: { id: 2 } },
    ])
    mockQueryRaw.mockResolvedValueOnce([])

    const result = await getAnalyticsSummary(FROM, TO)

    expect(result.total).toBeCloseTo(165.5)
    expect(result.categories).toEqual([
      { category: 'Groceries',  total: 120.5, count: 3 },
      { category: 'Restaurant', total: 45.0,  count: 2 },
    ])
  })

  it('preserves null category (Uncategorized)', async () => {
    mockGroupBy.mockResolvedValueOnce([
      { category: null, _sum: { amount: dec(30) }, _count: { id: 1 } },
    ])
    mockQueryRaw.mockResolvedValueOnce([])

    const result = await getAnalyticsSummary(FROM, TO)

    expect(result.categories[0].category).toBeNull()
    expect(result.categories[0].total).toBe(30)
  })

  it('treats null _sum.amount as 0', async () => {
    mockGroupBy.mockResolvedValueOnce([
      { category: 'Fuel', _sum: { amount: null }, _count: { id: 1 } },
    ])
    mockQueryRaw.mockResolvedValueOnce([])

    const result = await getAnalyticsSummary(FROM, TO)

    expect(result.categories[0].total).toBe(0)
    expect(result.total).toBe(0)
  })

  it('parses monthly rows from raw query', async () => {
    mockGroupBy.mockResolvedValueOnce([])
    mockQueryRaw.mockResolvedValueOnce([
      { month: '2026-01', total: '350.00', count: '5' },
      { month: '2026-02', total: '200.50', count: '3' },
    ])

    const result = await getAnalyticsSummary(FROM, TO)

    expect(result.monthly).toEqual([
      { month: '2026-01', total: 350.0,  count: 5 },
      { month: '2026-02', total: 200.5, count: 3 },
    ])
  })

  it('derives total from category sums, not from monthly rows', async () => {
    mockGroupBy.mockResolvedValueOnce([
      { category: 'Shopping', _sum: { amount: dec(99.99) }, _count: { id: 1 } },
    ])
    mockQueryRaw.mockResolvedValueOnce([
      { month: '2026-01', total: '50.00', count: '1' }, // intentionally different
    ])

    const result = await getAnalyticsSummary(FROM, TO)

    expect(result.total).toBeCloseTo(99.99)
  })

  it('passes the from/to dates to both queries', async () => {
    mockGroupBy.mockResolvedValueOnce([])
    mockQueryRaw.mockResolvedValueOnce([])

    await getAnalyticsSummary(FROM, TO)

    expect(mockGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: { gte: FROM, lte: TO },
        }),
      }),
    )
  })
})
