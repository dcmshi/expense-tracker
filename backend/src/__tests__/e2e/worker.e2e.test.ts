// worker.e2e.test.ts
// Processing pipeline e2e tests: create jobs via the ingest API, trigger a
// single poll cycle, then assert that expense + job records transition to the
// expected states in the real test database.
//
// ocrClient (fetchImageFromS3 + extractOcrText) is mocked so no real S3 or
// Google Vision API calls are made. All other code runs against the real DB.

jest.mock('../../workers/ocrClient', () => ({
  fetchImageFromS3: jest.fn().mockResolvedValue(Buffer.from('fake-image-bytes')),
  extractOcrText:   jest.fn().mockResolvedValue(
    'STARBUCKS\nVancouver BC\n2026-01-15\nLatte    $5.50\nTotal: $5.50',
  ),
}))

import request from 'supertest'
import prisma from '../../lib/db'
import { processPendingJobs } from '../../workers/processingWorker'
import { createApp, truncateAll } from './helpers'

const app = createApp()

const KEY_VOICE   = 'f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1'
const KEY_RECEIPT = 'f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2'
const KEY_FAIL    = 'f3f3f3f3-f3f3-4f3f-8f3f-f3f3f3f3f3f3'

beforeEach(async () => { await truncateAll() })
afterAll(async () => { await prisma.$disconnect() })

// ── Voice job ─────────────────────────────────────────────────────────────

describe('voice processing job', () => {
  it('transitions uploaded → awaiting_user and populates parsed fields', async () => {
    const ingestRes = await request(app)
      .post('/ingest/voice')
      .set('Idempotency-Key', KEY_VOICE)
      .send({ transcript: 'I spent 25 dollars at Starbucks today' })

    expect(ingestRes.status).toBe(200)
    const { expense_id } = ingestRes.body

    // Run one worker poll cycle
    await processPendingJobs()

    // Expense should be awaiting_user with parsed data
    const expense = await prisma.expense.findUniqueOrThrow({ where: { id: expense_id } })
    expect(expense.processing_status).toBe('awaiting_user')
    expect(Number(expense.amount)).toBeCloseTo(25, 1)
    expect(expense.merchant).toMatch(/starbucks/i)
    expect(expense.confidence).not.toBeNull()
    expect(Number(expense.confidence)).toBeGreaterThan(0)

    // Job mirrors the same status
    const job = await prisma.processingJob.findFirstOrThrow({ where: { expense_id } })
    expect(job.status).toBe('awaiting_user')
    expect(job.attempt_count).toBe(0)

    // Confirm via GET /expenses/:id
    const getRes = await request(app).get(`/expenses/${expense_id}`)
    expect(getRes.status).toBe(200)
    expect(getRes.body.expense.processing_status).toBe('awaiting_user')
  })
})

// ── Receipt job ────────────────────────────────────────────────────────────

describe('receipt processing job', () => {
  it('transitions uploaded → awaiting_user using mocked OCR output', async () => {
    const ingestRes = await request(app)
      .post('/ingest/receipt')
      .set('Idempotency-Key', KEY_RECEIPT)
      .send({ object_key: 'receipts/starbucks.jpg' })

    expect(ingestRes.status).toBe(200)
    const { expense_id } = ingestRes.body

    await processPendingJobs()

    const expense = await prisma.expense.findUniqueOrThrow({ where: { id: expense_id } })
    expect(expense.processing_status).toBe('awaiting_user')
    // Heuristic parser should extract $5.50 from the mocked OCR text
    expect(Number(expense.amount)).toBeCloseTo(5.5, 1)
    expect(expense.merchant).toMatch(/starbucks/i)
    expect(expense.confidence).not.toBeNull()

    const job = await prisma.processingJob.findFirstOrThrow({ where: { expense_id } })
    expect(job.status).toBe('awaiting_user')

    // raw_input stores OCR text and line items (no transcript)
    const raw = expense.raw_input as Record<string, unknown>
    expect(raw).toHaveProperty('ocr_text')
  })
})

// ── Failure and retry behaviour ────────────────────────────────────────────

describe('job failure handling', () => {
  it('exhausts max_attempts and transitions to failed', async () => {
    // Make extractOcrText throw on every call for this test
    const { extractOcrText } = jest.requireMock('../../workers/ocrClient') as {
      extractOcrText: jest.Mock
    }
    extractOcrText.mockRejectedValue(new Error('Vision API unavailable'))

    const ingestRes = await request(app)
      .post('/ingest/receipt')
      .set('Idempotency-Key', KEY_FAIL)
      .send({ object_key: 'receipts/broken.jpg' })

    expect(ingestRes.status).toBe(200)
    const { expense_id } = ingestRes.body

    // The job has max_attempts = 3; run one poll per attempt.
    // After each poll the job stays in 'processing' (retryable) until the last.
    await processPendingJobs() // attempt 1 → still processing (attempt_count=1)
    await processPendingJobs() // attempt 2 → still processing (attempt_count=2)
    await processPendingJobs() // attempt 3 → failed (attempt_count=3, terminal)

    const job = await prisma.processingJob.findFirstOrThrow({ where: { expense_id } })
    expect(job.status).toBe('failed')
    expect(job.attempt_count).toBe(3)
    expect(job.last_error_message).toBe('Vision API unavailable')

    const expense = await prisma.expense.findUniqueOrThrow({ where: { id: expense_id } })
    expect(expense.processing_status).toBe('failed')
  })
})

// ── Verify flow after worker processing ───────────────────────────────────

describe('verify flow', () => {
  it('user can verify an awaiting_user expense via PATCH after worker processes it', async () => {
    const { extractOcrText } = jest.requireMock('../../workers/ocrClient') as {
      extractOcrText: jest.Mock
    }
    // Restore success for this test (was mocked to fail in previous describe)
    extractOcrText.mockResolvedValue(
      'METRO\nToronto ON\n2026-02-01\nTotal: $87.43',
    )

    const ingestRes = await request(app)
      .post('/ingest/receipt')
      .set('Idempotency-Key', 'f4f4f4f4-f4f4-4f4f-8f4f-f4f4f4f4f4f4')
      .send({ object_key: 'receipts/metro.jpg' })

    const { expense_id } = ingestRes.body

    await processPendingJobs()

    // Confirm awaiting_user
    const beforeVerify = await prisma.expense.findUniqueOrThrow({ where: { id: expense_id } })
    expect(beforeVerify.processing_status).toBe('awaiting_user')

    // User verifies via API
    const patchRes = await request(app)
      .patch(`/expenses/${expense_id}`)
      .send({ is_user_verified: true })

    expect(patchRes.status).toBe(200)
    expect(patchRes.body.expense.processing_status).toBe('verified')
    expect(patchRes.body.expense.is_user_verified).toBe(true)

    // Job also transitions to verified
    const job = await prisma.processingJob.findFirstOrThrow({ where: { expense_id } })
    expect(job.status).toBe('verified')
  })
})
