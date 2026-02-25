import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'
import prisma from '../lib/db'
import s3, { S3_BUCKET, PRESIGNED_URL_TTL_SECONDS } from '../lib/s3'

export interface PresignedUploadResult {
  presigned_url: string
  object_key: string
  expires_at: Date
}

// createPresignedUpload — idempotency-safe presigned URL generation.
//
// The presigned URL is never stored in the DB (it contains auth credentials
// and has its own TTL). Instead, we store only the object_key and
// regenerate the URL on every call — including idempotency hits.
//
// Idempotency behaviour:
//   - Key exists, URL still valid → return fresh URL for same object_key
//   - Key exists, URL expired     → refresh expires_at, return new URL for same object_key
//   - Key not found               → generate new object_key, create Upload record, return URL
export async function createPresignedUpload(
  idempotencyKey: string,
): Promise<PresignedUploadResult> {
  const existing = await prisma.upload.findUnique({
    where: { idempotency_key: idempotencyKey },
  })

  if (existing) {
    const isExpired = existing.presigned_url_expires_at <= new Date()
    const expiresAt = isExpired
      ? new Date(Date.now() + PRESIGNED_URL_TTL_SECONDS * 1000)
      : existing.presigned_url_expires_at

    if (isExpired) {
      await prisma.upload.update({
        where: { idempotency_key: idempotencyKey },
        data: { presigned_url_expires_at: expiresAt },
      })
    }

    const presignedUrl = await generatePresignedPutUrl(existing.object_key)
    return { presigned_url: presignedUrl, object_key: existing.object_key, expires_at: expiresAt }
  }

  // New upload — generate a unique object key and store the Upload record
  const objectKey = `receipts/${uuidv4()}`
  const expiresAt = new Date(Date.now() + PRESIGNED_URL_TTL_SECONDS * 1000)

  await prisma.upload.create({
    data: {
      object_key: objectKey,
      idempotency_key: idempotencyKey,
      presigned_url_expires_at: expiresAt,
    },
  })

  const presignedUrl = await generatePresignedPutUrl(objectKey)
  return { presigned_url: presignedUrl, object_key: objectKey, expires_at: expiresAt }
}

async function generatePresignedPutUrl(objectKey: string): Promise<string> {
  const command = new PutObjectCommand({ Bucket: S3_BUCKET, Key: objectKey })
  return getSignedUrl(s3, command, { expiresIn: PRESIGNED_URL_TTL_SECONDS })
}
