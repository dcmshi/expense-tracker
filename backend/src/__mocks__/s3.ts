// Lightweight S3 client mock — prevents AWS SDK from loading real credentials.
const s3 = {}

export default s3
export const S3_BUCKET = 'test-bucket'
export const PRESIGNED_URL_TTL_SECONDS = 300
