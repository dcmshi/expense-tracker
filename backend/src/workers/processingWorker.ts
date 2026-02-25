import 'dotenv/config'
import prisma from '../lib/db'

// Processing worker — polls for pending jobs and processes receipts via OCR.
//
// State machine:
//   uploaded   → processing      on job pickup
//   processing → parsed          OCR + parse success
//   parsed     → awaiting_user   draft ready for user
//   processing → processing      on retry (exponential backoff)
//   processing → failed          after max_attempts exceeded

const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS ?? '5000')

// processPendingJobs — picks up all jobs in 'uploaded' or 'processing' state
// ordered by created_at ASC (FIFO), processes each one
async function processPendingJobs() {
  // TODO:
  //   1. Query: SELECT * FROM processing_jobs WHERE status IN ('uploaded', 'processing') ORDER BY created_at ASC
  //   2. For each job:
  //      a. Transition job + expense to 'processing'
  //      b. Fetch image from S3
  //      c. Call Google Vision API for OCR (lib/vision.ts)
  //      d. Parse OCR output for amount, merchant, date, currency (receiptParser)
  //      e. Store raw OCR + line items in expense.raw_input
  //      f. Transition to 'parsed' → 'awaiting_user' on success
  //      g. On error: increment attempt_count, store last_error_message
  //      h. If attempt_count >= max_attempts: transition to 'failed'
}

async function runWorker() {
  console.log(`Worker started. Polling every ${POLL_INTERVAL_MS}ms`)
  while (true) {
    await processPendingJobs()
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

runWorker().catch(err => {
  console.error('Worker crashed:', err)
  process.exit(1)
})
