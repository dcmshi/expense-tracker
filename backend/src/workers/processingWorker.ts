import 'dotenv/config'
import prisma from '../lib/db'
import { fetchImageFromS3, extractOcrText } from './ocrClient'
import { parseReceiptText } from './receiptParser'
import { parseVoiceTranscript } from './voiceParser'
import { suggestCategory } from './categoryMatcher'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS ?? '5000')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Inlined to avoid coupling to Prisma internals — matches the findMany payload.
interface ActiveJob {
  job_id:        string
  expense_id:    string
  attempt_count: number
  max_attempts:  number
  expense: {
    source:            string
    receipt_url:       string | null
    raw_input:         Record<string, unknown>
    processing_status: string
  }
}

// ---------------------------------------------------------------------------
// Confidence scoring — shared across receipt and voice jobs
// ---------------------------------------------------------------------------

function computeConfidence(parsed: {
  amount:   number | null
  date:     string | null
  merchant: string | null
}): number {
  return (parsed.amount   !== null ? 0.5 : 0)
       + (parsed.date     !== null ? 0.3 : 0)
       + (parsed.merchant !== null ? 0.2 : 0)
}

// ---------------------------------------------------------------------------
// Poll loop
// ---------------------------------------------------------------------------

async function processPendingJobs(): Promise<void> {
  const jobs = await prisma.processingJob.findMany({
    where:   { status: { in: ['uploaded', 'processing'] } },
    orderBy: { created_at: 'asc' },       // FIFO — uses the partial index
    include: {
      expense: {
        select: {
          source:            true,
          receipt_url:       true,
          raw_input:         true,
          processing_status: true,
        },
      },
    },
  })

  if (jobs.length > 0) {
    console.log(`[worker] Found ${jobs.length} pending job(s)`)
  }

  for (const job of jobs) {
    await processJob(job as ActiveJob)
  }
}

// ---------------------------------------------------------------------------
// Job dispatcher — branches on expense source
// ---------------------------------------------------------------------------

async function processJob(job: ActiveJob): Promise<void> {
  console.log(`[worker] Processing job ${job.job_id} (attempt ${job.attempt_count + 1}/${job.max_attempts}, source: ${job.expense.source})`)

  try {
    await setStatus(job.job_id, job.expense_id, 'processing')

    if (job.expense.source === 'voice') {
      await processVoiceJob(job)
    } else {
      await processReceiptJob(job)
    }
  } catch (err) {
    await handleJobFailure(job, err)
  }
}

// ---------------------------------------------------------------------------
// Receipt job — OCR → heuristic parse → persist
// ---------------------------------------------------------------------------

async function processReceiptJob(job: ActiveJob): Promise<void> {
  // 1. Get the receipt image from S3 (receipt_url stores the object key)
  const objectKey = job.expense.receipt_url
  if (!objectKey) {
    throw new Error('Expense has no receipt_url — cannot process')
  }
  const imageBuffer = await fetchImageFromS3(objectKey)

  // 2. OCR via Google Vision API
  const ocrText = await extractOcrText(imageBuffer)
  console.log(`[worker] OCR complete for job ${job.job_id} (${ocrText.length} chars)`)

  // 3. Heuristic parsing
  const parsed = parseReceiptText(ocrText)
  console.log(`[worker] Parsed — amount: ${parsed.amount}, merchant: ${parsed.merchant}, date: ${parsed.date}`)

  // 4. Category suggestion + confidence
  const category   = suggestCategory(parsed.merchant, ocrText)
  const confidence = computeConfidence(parsed)

  // 5. Persist parsed data and transition → awaiting_user
  //    'parsed' and 'awaiting_user' are combined into a single write for MVP.
  await prisma.$transaction(async (tx) => {
    await tx.expense.update({
      where: { id: job.expense_id },
      data: {
        processing_status: 'awaiting_user',
        ...(parsed.amount   !== null && { amount:   parsed.amount }),
        ...(parsed.merchant !== null && { merchant: parsed.merchant }),
        ...(parsed.date     !== null && { date:     new Date(parsed.date) }),
        ...(category        !== null && { category }),
        currency:   parsed.currency,
        confidence,
        raw_input: JSON.parse(JSON.stringify({
          ocr_text:   ocrText,
          line_items: parsed.line_items,
        })),
      },
    })

    await tx.processingJob.update({
      where: { job_id: job.job_id },
      data:  { status: 'awaiting_user' },
    })
  })

  console.log(`[worker] Receipt job ${job.job_id} → awaiting_user (confidence: ${confidence.toFixed(3)}, category: ${category ?? 'none'})`)
}

// ---------------------------------------------------------------------------
// Voice job — parse transcript → persist (no S3/OCR step)
// ---------------------------------------------------------------------------

async function processVoiceJob(job: ActiveJob): Promise<void> {
  const transcript = job.expense.raw_input.transcript as string
  if (!transcript) {
    throw new Error('Expense raw_input has no transcript — cannot process')
  }

  // 1. Parse the transcript with heuristic rules
  const parsed = parseVoiceTranscript(transcript)
  console.log(`[worker] Voice parsed — amount: ${parsed.amount}, merchant: ${parsed.merchant}, date: ${parsed.date}`)

  // 2. Confidence + category (category already set by voiceParser but recompute for consistency)
  const confidence = computeConfidence(parsed)

  // 3. Persist and transition → awaiting_user
  await prisma.$transaction(async (tx) => {
    await tx.expense.update({
      where: { id: job.expense_id },
      data: {
        processing_status: 'awaiting_user',
        ...(parsed.amount   !== null && { amount:   parsed.amount }),
        ...(parsed.merchant !== null && { merchant: parsed.merchant }),
        ...(parsed.date     !== null && { date:     new Date(parsed.date) }),
        ...(parsed.category !== null && { category: parsed.category }),
        currency:   parsed.currency,
        confidence,
        raw_input: JSON.parse(JSON.stringify({ transcript })),
      },
    })

    await tx.processingJob.update({
      where: { job_id: job.job_id },
      data:  { status: 'awaiting_user' },
    })
  })

  console.log(`[worker] Voice job ${job.job_id} → awaiting_user (confidence: ${confidence.toFixed(3)}, category: ${parsed.category ?? 'none'})`)
}

// ---------------------------------------------------------------------------
// Failure handling
// ---------------------------------------------------------------------------

// On failure the job stays in (or returns to) 'processing' so the next poll
// picks it up again. The poll interval acts as the minimum retry delay.
//
// Note: proper exponential backoff would require a next_attempt_at column
// on processing_jobs. Deferred to a post-MVP schema migration.
async function handleJobFailure(job: ActiveJob, err: unknown): Promise<void> {
  const message      = err instanceof Error ? err.message : String(err)
  const newCount     = job.attempt_count + 1
  const isFinal      = newCount >= job.max_attempts
  const nextStatus   = isFinal ? 'failed' : 'processing'

  console[isFinal ? 'error' : 'warn'](
    `[worker] Job ${job.job_id} ${isFinal ? 'FAILED' : `attempt ${newCount}/${job.max_attempts} failed`}: ${message}`,
  )

  await prisma.$transaction(async (tx) => {
    await tx.processingJob.update({
      where: { job_id: job.job_id },
      data: {
        status:             nextStatus,
        attempt_count:      newCount,
        last_error_message: message,
      },
    })

    await tx.expense.update({
      where: { id: job.expense_id },
      data:  { processing_status: nextStatus },
    })
  })
}

// ---------------------------------------------------------------------------
// Status transition helper
// ---------------------------------------------------------------------------

async function setStatus(
  jobId:     string,
  expenseId: string,
  status:    string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.processingJob.update({ where: { job_id: jobId },  data: { status } })
    await tx.expense.update(      { where: { id: expenseId },  data: { processing_status: status } })
  })
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function runWorker(): Promise<void> {
  console.log(`[worker] Started — polling every ${POLL_INTERVAL_MS}ms`)

  // Graceful shutdown on SIGTERM / SIGINT
  let running = true
  const stop = () => { running = false }
  process.once('SIGTERM', stop)
  process.once('SIGINT',  stop)

  while (running) {
    try {
      await processPendingJobs()
    } catch (err) {
      // Log poll-level errors without crashing; individual job errors are
      // handled inside processJob via handleJobFailure.
      console.error('[worker] Poll error:', err)
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  console.log('[worker] Shutting down gracefully')
  await prisma.$disconnect()
}

runWorker().catch(err => {
  console.error('[worker] Fatal error:', err)
  process.exit(1)
})
