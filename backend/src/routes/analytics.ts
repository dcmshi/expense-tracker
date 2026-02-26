import { Router } from 'express'
import { z } from 'zod'
import { getAnalyticsSummary } from '../services/analyticsService'

const router = Router()

const querySchema = z.object({
  from: z.string().date().optional(),
  to:   z.string().date().optional(),
})

// GET /analytics/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Returns category breakdown, monthly trend, and grand total for verified/
// awaiting_user expenses in the requested date range.
//
// Defaults: to = today, from = today − 30 days.
router.get('/summary', async (req, res, next) => {
  try {
    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query params' })
      return
    }

    const today = new Date()
    const toDate   = parsed.data.to   ? new Date(parsed.data.to)   : today
    const fromDate = parsed.data.from ? new Date(parsed.data.from) : new Date(new Date(toDate).setDate(toDate.getDate() - 30))

    const summary = await getAnalyticsSummary(fromDate, toDate)
    res.json(summary)
  } catch (err) {
    next(err)
  }
})

export default router
