import { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../middleware/errorHandler'
import { createPresignedUpload } from '../services/uploadService'

const router = Router()

const idempotencyKeySchema = z.string().uuid('must be a valid UUID')

// POST /uploads — request a presigned URL for direct-to-S3 upload
//
// Headers:
//   Idempotency-Key: <UUID>  (required)
//
// Response 200:
//   { presigned_url, object_key, expires_at }
//
// The client uploads the receipt image directly to S3 via presigned_url (HTTP PUT),
// then passes object_key to POST /ingest/receipt to start processing.
router.post('/', async (req, res, next) => {
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

    const result = await createPresignedUpload(parsed.data)

    res.status(200).json({
      presigned_url: result.presigned_url,
      object_key: result.object_key,
      expires_at: result.expires_at.toISOString(),
    })
  } catch (err) {
    next(err)
  }
})

export default router
