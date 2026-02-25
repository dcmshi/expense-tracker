import prisma from '../lib/db'

// ingestReceipt — idempotency-safe receipt ingestion
//
// Flow:
//   1. Check if idempotency key already exists in processing_jobs
//   2. If yes → return existing expense_id and processing_status
//   3. If no → create Expense draft (status: uploaded) + ProcessingJob record
//
// Returns: { expense_id, processing_status }
export async function ingestReceipt(objectKey: string, idempotencyKey: string) {
  // TODO
}
