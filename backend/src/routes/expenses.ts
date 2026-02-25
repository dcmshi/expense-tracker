import { Router, Request } from 'express'
import { z } from 'zod'
import { AppError } from '../middleware/errorHandler'
import { validate } from '../middleware/validate'
import {
  listExpenses,
  getExpense,
  createManualExpense,
  updateExpense,
  deleteExpense,
} from '../services/expenseService'

const router = Router()

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createExpenseSchema = z.object({
  amount:   z.number().positive('amount must be positive'),
  currency: z.string().length(3, 'currency must be a 3-character ISO 4217 code').optional(),
  merchant: z.string().optional(),
  category: z.string().optional(),
  date:     z.string().date('date must be in YYYY-MM-DD format'),
  notes:    z.string().optional(),
})

const updateExpenseSchema = z.object({
  amount:           z.number().positive('amount must be positive').optional(),
  merchant:         z.string().optional(),
  category:         z.string().optional(),
  date:             z.string().date('date must be in YYYY-MM-DD format').optional(),
  notes:            z.string().optional(),
  is_user_verified: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' },
)

// ---------------------------------------------------------------------------
// GET /expenses — list all expenses ordered by created_at DESC
// ---------------------------------------------------------------------------

router.get('/', async (_req, res, next) => {
  try {
    const expenses = await listExpenses()
    res.status(200).json({ expenses })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /expenses/:id — single expense; used by client to poll processing_status
// ---------------------------------------------------------------------------

router.get('/:id', async (req: Request<{ id: string }>, res, next) => {
  try {
    const expense = await getExpense(req.params.id)
    if (!expense) throw new AppError(404, 'Expense not found')
    res.status(200).json({ expense })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// POST /expenses — manual expense creation
// ---------------------------------------------------------------------------

router.post('/', validate(createExpenseSchema), async (req, res, next) => {
  try {
    const expense = await createManualExpense(req.body)
    res.status(201).json({ expense })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// PATCH /expenses/:id — partial update of editable fields
// Setting is_user_verified: true transitions processing_status → verified
// ---------------------------------------------------------------------------

router.patch('/:id', validate(updateExpenseSchema), async (req: Request<{ id: string }>, res, next) => {
  try {
    const expense = await updateExpense(req.params.id, req.body)
    if (!expense) throw new AppError(404, 'Expense not found')
    res.status(200).json({ expense })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// DELETE /expenses/:id — delete expense; cascades to processing_jobs
// ---------------------------------------------------------------------------

router.delete('/:id', async (req: Request<{ id: string }>, res, next) => {
  try {
    const deleted = await deleteExpense(req.params.id)
    if (!deleted) throw new AppError(404, 'Expense not found')
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
