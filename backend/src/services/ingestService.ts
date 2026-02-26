import prisma from '../lib/db'

export interface IngestReceiptResult {
  expense_id: string
  processing_status: string
}

export interface IngestVoiceResult {
  expense_id: string
  processing_status: string
}

// ingestReceipt — idempotency-safe receipt ingestion.
//
// Creates an Expense draft and a ProcessingJob in a single transaction.
// The worker picks up the job and transitions both records through the
// processing lifecycle.
//
// Idempotency behaviour:
//   - Key exists → return existing expense_id and current processing_status
//   - Key not found → create Expense draft (status: uploaded) + ProcessingJob
//
// amount and date are null on the draft — the worker populates them after parsing.
export async function ingestReceipt(
  objectKey: string,
  idempotencyKey: string,
): Promise<IngestReceiptResult> {
  const existingJob = await prisma.processingJob.findUnique({
    where: { idempotency_key: idempotencyKey },
    include: {
      expense: { select: { processing_status: true } },
    },
  })

  if (existingJob) {
    return {
      expense_id: existingJob.expense_id,
      processing_status: existingJob.expense.processing_status,
    }
  }

  // Create Expense draft and ProcessingJob atomically.
  // If either insert fails the whole transaction rolls back,
  // keeping the two records always consistent.
  const result = await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        source: 'receipt',
        processing_status: 'uploaded',
        receipt_url: objectKey,   // object key stored as durable receipt reference
        raw_input: {},
        is_user_verified: false,
        // amount and date intentionally null — populated by worker after OCR parsing
      },
    })

    const job = await tx.processingJob.create({
      data: {
        expense_id: expense.id,
        status: 'uploaded',
        idempotency_key: idempotencyKey,
      },
    })

    return { expense, job }
  })

  return {
    expense_id: result.expense.id,
    processing_status: result.expense.processing_status,
  }
}

// ingestVoice — idempotency-safe voice ingestion.
//
// Same pattern as ingestReceipt: creates an Expense + ProcessingJob in one
// transaction. The worker picks up the job, parses the transcript, and
// transitions both records through the processing lifecycle.
//
// The transcript is stored in raw_input so the worker can access it without
// needing to re-read the expense record.
export async function ingestVoice(
  transcript: string,
  idempotencyKey: string,
): Promise<IngestVoiceResult> {
  const existingJob = await prisma.processingJob.findUnique({
    where: { idempotency_key: idempotencyKey },
    include: {
      expense: { select: { processing_status: true } },
    },
  })

  if (existingJob) {
    return {
      expense_id: existingJob.expense_id,
      processing_status: existingJob.expense.processing_status,
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        source: 'voice',
        processing_status: 'uploaded',
        receipt_url: null,
        raw_input: JSON.parse(JSON.stringify({ transcript })),
        is_user_verified: false,
        // amount and date intentionally null — populated by worker after parsing
      },
    })

    const job = await tx.processingJob.create({
      data: {
        expense_id: expense.id,
        status: 'uploaded',
        idempotency_key: idempotencyKey,
      },
    })

    return { expense, job }
  })

  return {
    expense_id: result.expense.id,
    processing_status: result.expense.processing_status,
  }
}
