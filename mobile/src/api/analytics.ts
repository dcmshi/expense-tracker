import client from './client'

export interface CategoryBreakdown {
  category: string | null
  total: number
  count: number
}

export interface MonthlyBreakdown {
  month: string   // 'YYYY-MM'
  total: number
  count: number
}

export interface AnalyticsSummary {
  total: number
  categories: CategoryBreakdown[]
  monthly: MonthlyBreakdown[]
}

export async function getAnalyticsSummary(from?: string, to?: string): Promise<AnalyticsSummary> {
  const params: Record<string, string> = {}
  if (from) params.from = from
  if (to)   params.to   = to

  const response = await client.get<AnalyticsSummary>('/analytics/summary', { params })
  return response.data
}
