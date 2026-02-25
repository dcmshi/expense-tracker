import { Router } from 'express'
import { AppError } from '../middleware/errorHandler'

const router = Router()

// POST /uploads — request a presigned URL for direct-to-S3 upload
//
// Headers: Idempotency-Key: <UUID>
// Returns: { presigned_url, object_key, expires_at }
//
// Idempotency: if the key was used before and the URL hasn't expired,
// returns the existing Upload record without generating a new URL.
router.post('/', async (req, res, next) => {
  try {
    // TODO: extract + validate Idempotency-Key header
    //       uploadService.createPresignedUpload(idempotencyKey)
    next(new AppError(501, 'Not implemented'))
  } catch (err) {
    next(err)
  }
})

export default router
