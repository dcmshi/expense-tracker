import client from './client'
import type { IngestReceiptResponse } from '../types'

export async function ingestReceipt(
  objectKey: string,
  idempotencyKey: string,
): Promise<IngestReceiptResponse> {
  const response = await client.post<IngestReceiptResponse>(
    '/ingest/receipt',
    { object_key: objectKey },
    {
      headers: { 'Idempotency-Key': idempotencyKey },
    },
  )
  return response.data
}
