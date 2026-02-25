import { Router } from 'express'
import { AppError } from '../middleware/errorHandler'

const router = Router()

// GET /expenses — list all expenses ordered by created_at DESC
router.get('/', async (_req, res, next) => {
  try {
    // TODO: expenseService.listExpenses()
    next(new AppError(501, 'Not implemented'))
  } catch (err) {
    next(err)
  }
})

// GET /expenses/:id — single expense; used by client to poll processing_status
router.get('/:id', async (req, res, next) => {
  try {
    // TODO: expenseService.getExpense(req.params.id)
    next(new AppError(501, 'Not implemented'))
  } catch (err) {
    next(err)
  }
})

// POST /expenses — manual expense creation
// source: manual, confidence: 1.0, processing_status: verified, is_user_verified: true
router.post('/', async (req, res, next) => {
  try {
    // TODO: validate(createExpenseSchema), expenseService.createManualExpense(req.body)
    next(new AppError(501, 'Not implemented'))
  } catch (err) {
    next(err)
  }
})

// PATCH /expenses/:id — partial update of editable fields
// Setting is_user_verified: true transitions processing_status to 'verified'
router.patch('/:id', async (req, res, next) => {
  try {
    // TODO: validate(updateExpenseSchema), expenseService.updateExpense(req.params.id, req.body)
    next(new AppError(501, 'Not implemented'))
  } catch (err) {
    next(err)
  }
})

// DELETE /expenses/:id — delete expense; cascades to processing_jobs
router.delete('/:id', async (req, res, next) => {
  try {
    // TODO: expenseService.deleteExpense(req.params.id)
    next(new AppError(501, 'Not implemented'))
  } catch (err) {
    next(err)
  }
})

export default router
