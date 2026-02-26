import client from './client'
import type { IngestReceiptResponse, IngestVoiceResponse } from '../types'

export async function ingestReceipt(
  objectKey: string,
  idempotencyKey: string,
): Promise<IngestReceiptResponse> {
  const response = await client.post<IngestReceiptResponse>(
    '/ingest/receipt',
    { object_key: objectKey },
    { headers: { 'Idempotency-Key': idempotencyKey } },
  )
  return response.data
}

export async function ingestVoice(
  transcript: string,
  idempotencyKey: string,
): Promise<IngestVoiceResponse> {
  const response = await client.post<IngestVoiceResponse>(
    '/ingest/voice',
    { transcript },
    { headers: { 'Idempotency-Key': idempotencyKey } },
  )
  return response.data
}
