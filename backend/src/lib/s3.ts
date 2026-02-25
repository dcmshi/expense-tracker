import { S3Client } from '@aws-sdk/client-s3'

// forcePathStyle is required for MinIO (local dev).
// For AWS S3 in production, S3_ENDPOINT is unset and forcePathStyle is false.
const s3 = new S3Client({
  region: process.env.S3_REGION ?? 'us-east-1',
  ...(process.env.S3_ENDPOINT && { endpoint: process.env.S3_ENDPOINT }),
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: !!process.env.S3_ENDPOINT,
})

export const S3_BUCKET = process.env.S3_BUCKET ?? 'expense-tracker-receipts'
export const PRESIGNED_URL_TTL_SECONDS = parseInt(process.env.S3_PRESIGNED_URL_TTL_SECONDS ?? '300')

export default s3
