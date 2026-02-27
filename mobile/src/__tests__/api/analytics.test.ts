import * as analyticsApi from '../../api/analytics'
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

const mockGet = client.get as jest.Mock

const SUMMARY = {
  total: 250,
  categories: [{ category: 'Groceries', total: 150, count: 3 }],
  monthly: [{ month: '2026-01', total: 250, count: 5 }],
}

describe('getAnalyticsSummary', () => {
  it('fetches /analytics/summary with no params when none given', async () => {
    mockGet.mockResolvedValueOnce({ data: SUMMARY })
    const result = await analyticsApi.getAnalyticsSummary()
    expect(result).toEqual(SUMMARY)
    expect(mockGet).toHaveBeenCalledWith('/analytics/summary', { params: {} })
  })

  it('passes from date as a query param', async () => {
    mockGet.mockResolvedValueOnce({ data: SUMMARY })
    await analyticsApi.getAnalyticsSummary('2026-01-01')
    expect(mockGet).toHaveBeenCalledWith('/analytics/summary', {
      params: { from: '2026-01-01' },
    })
  })

  it('passes both from and to dates', async () => {
    mockGet.mockResolvedValueOnce({ data: SUMMARY })
    await analyticsApi.getAnalyticsSummary('2026-01-01', '2026-01-31')
    expect(mockGet).toHaveBeenCalledWith('/analytics/summary', {
      params: { from: '2026-01-01', to: '2026-01-31' },
    })
  })

  it('passes only to when from is omitted', async () => {
    mockGet.mockResolvedValueOnce({ data: SUMMARY })
    await analyticsApi.getAnalyticsSummary(undefined, '2026-01-31')
    expect(mockGet).toHaveBeenCalledWith('/analytics/summary', {
      params: { to: '2026-01-31' },
    })
  })
})
