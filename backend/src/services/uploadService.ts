import prisma from '../lib/db'
import s3, { S3_BUCKET, PRESIGNED_URL_TTL_SECONDS } from '../lib/s3'

// createPresignedUpload — idempotency-safe presigned URL generation
//
// Flow:
//   1. Check if idempotency key already exists in uploads table
//   2. If yes and URL not expired → return existing record
//   3. If no → generate object key, create presigned PUT URL, store Upload record
//
// Returns: { presigned_url, object_key, expires_at }
export async function createPresignedUpload(idempotencyKey: string) {
  // TODO
}
