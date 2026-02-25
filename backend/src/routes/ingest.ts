import { Router } from 'express'
import { AppError } from '../middleware/errorHandler'

const router = Router()

// POST /ingest/receipt — submit object key after S3 upload; creates processing job
//
// Headers: Idempotency-Key: <UUID>
// Body:    { object_key: string }
// Returns: { expense_id, processing_status }
//
// Idempotency: if the key was used before, returns the existing
// expense_id without creating a duplicate job.
router.post('/receipt', async (req, res, next) => {
  try {
    // TODO: validate Idempotency-Key header + body (ingestReceiptSchema)
    //       ingestService.ingestReceipt(req.body.object_key, idempotencyKey)
    next(new AppError(501, 'Not implemented'))
  } catch (err) {
    next(err)
  }
})

// POST /ingest/voice — Phase 2
// router.post('/voice', ...)

export default router
