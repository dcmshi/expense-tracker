import prisma from '../lib/db'

// Statuses that represent in-flight or failed expenses — excluded from analytics.
const EXCLUDED_STATUSES = ['uploaded', 'processing', 'failed']

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

export async function getAnalyticsSummary(
  from: Date,
  to: Date,
): Promise<AnalyticsSummary> {
  // Category breakdown via Prisma groupBy
  const categoryRows = await prisma.expense.groupBy({
    by: ['category'],
    where: {
      processing_status: { notIn: EXCLUDED_STATUSES },
      amount: { not: null },
      date: { gte: from, lte: to },
    },
    _sum: { amount: true },
    _count: { id: true },
    orderBy: { _sum: { amount: 'desc' } },
  })

  const categories: CategoryBreakdown[] = categoryRows.map((row) => ({
    category: row.category,
    total: row._sum.amount?.toNumber() ?? 0,
    count: row._count.id,
  }))

  const total = categories.reduce((sum, c) => sum + c.total, 0)

  // Monthly breakdown via raw SQL (Prisma groupBy can't use DATE_TRUNC)
  const monthlyRows = await prisma.$queryRaw<
    Array<{ month: string; total: string; count: string }>
  >`
    SELECT
      TO_CHAR(DATE_TRUNC('month', date), 'YYYY-MM') AS month,
      SUM(amount)::text                              AS total,
      COUNT(id)::text                                AS count
    FROM expenses
    WHERE
      processing_status NOT IN (${EXCLUDED_STATUSES[0]}, ${EXCLUDED_STATUSES[1]}, ${EXCLUDED_STATUSES[2]})
      AND amount IS NOT NULL
      AND date BETWEEN ${from} AND ${to}
    GROUP BY DATE_TRUNC('month', date)
    ORDER BY 1 ASC
  `

  const monthly: MonthlyBreakdown[] = monthlyRows.map((row) => ({
    month: row.month,
    total: parseFloat(row.total),
    count: parseInt(row.count, 10),
  }))

  return { total, categories, monthly }
}
