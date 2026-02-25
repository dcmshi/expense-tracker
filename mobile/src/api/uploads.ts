import client from './client'
import type { CreateUploadResponse } from '../types'

export async function createPresignedUpload(
  idempotencyKey: string,
): Promise<CreateUploadResponse> {
  const response = await client.post<CreateUploadResponse>(
    '/uploads',
    {},
    {
      headers: { 'Idempotency-Key': idempotencyKey },
    },
  )
  return response.data
}
