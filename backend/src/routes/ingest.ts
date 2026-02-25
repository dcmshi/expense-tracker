import { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../middleware/errorHandler'
import { validate } from '../middleware/validate'
import { ingestReceipt } from '../services/ingestService'

const router = Router()

const idempotencyKeySchema = z.string().uuid('must be a valid UUID')

const ingestReceiptSchema = z.object({
  object_key: z.string().min(1, 'object_key is required'),
})

// POST /ingest/receipt — submit object key after direct S3 upload; creates processing job
//
// Headers:
//   Idempotency-Key: <UUID>  (required)
//
// Body:
//   { object_key: string }
//
// Response 200:
//   { expense_id, processing_status }
//
// Idempotency: duplicate requests return the existing expense_id without
// creating a second job. Safe for mobile retry on network failure.
router.post('/receipt', validate(ingestReceiptSchema), async (req, res, next) => {
  try {
    const rawKey = req.headers['idempotency-key']

    if (!rawKey) {
      throw new AppError(400, 'Idempotency-Key header is required')
    }

    const parsed = idempotencyKeySchema.safeParse(
      Array.isArray(rawKey) ? rawKey[0] : rawKey,
    )
    if (!parsed.success) {
      throw new AppError(400, `Invalid Idempotency-Key: ${parsed.error.issues[0].message}`)
    }

    const result = await ingestReceipt(req.body.object_key, parsed.data)

    res.status(200).json({
      expense_id: result.expense_id,
      processing_status: result.processing_status,
    })
  } catch (err) {
    next(err)
  }
})

// POST /ingest/voice — Phase 2
// router.post('/voice', ...)

export default router
