// ingest.e2e.test.ts
// Receipt and voice ingestion endpoints — job creation and idempotency —
// against a real PostgreSQL test database.

import request from 'supertest'
import prisma from '../../lib/db'
import { createApp, truncateAll } from './helpers'

const app = createApp()

// Valid UUIDs required by the Idempotency-Key validation schema
const KEY_RECEIPT_1 = 'd1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1'
const KEY_RECEIPT_2 = 'd2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2'
const KEY_VOICE_1   = 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1'
const KEY_VOICE_2   = 'e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2'

beforeEach(async () => { await truncateAll() })
afterAll(async () => { await prisma.$disconnect() })

// ── POST /ingest/receipt ───────────────────────────────────────────────────

describe('POST /ingest/receipt', () => {
  it('creates an Expense (status=uploaded) and a ProcessingJob → 200', async () => {
    const res = await request(app)
      .post('/ingest/receipt')
      .set('Idempotency-Key', KEY_RECEIPT_1)
      .send({ object_key: 'receipts/test-image.jpg' })

    expect(res.status).toBe(200)
    expect(res.body.expense_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    expect(res.body.processing_status).toBe('uploaded')

    // Expense in DB
    const expense = await prisma.expense.findUnique({ where: { id: res.body.expense_id } })
    expect(expense).not.toBeNull()
    expect(expense!.source).toBe('receipt')
    expect(expense!.processing_status).toBe('uploaded')
    expect(expense!.receipt_url).toBe('receipts/test-image.jpg')
    expect(expense!.amount).toBeNull()   // not yet parsed

    // ProcessingJob in DB
    const job = await prisma.processingJob.findUnique({ where: { idempotency_key: KEY_RECEIPT_1 } })
    expect(job).not.toBeNull()
    expect(job!.expense_id).toBe(res.body.expense_id)
    expect(job!.status).toBe('uploaded')
    expect(job!.attempt_count).toBe(0)
  })

  it('idempotency: duplicate key returns same expense_id without creating a second job', async () => {
    const first = await request(app)
      .post('/ingest/receipt')
      .set('Idempotency-Key', KEY_RECEIPT_2)
      .send({ object_key: 'receipts/idempotent.jpg' })
    expect(first.status).toBe(200)

    const second = await request(app)
      .post('/ingest/receipt')
      .set('Idempotency-Key', KEY_RECEIPT_2)
      .send({ object_key: 'receipts/idempotent.jpg' })
    expect(second.status).toBe(200)
    expect(second.body.expense_id).toBe(first.body.expense_id)

    // Exactly one job for this idempotency key
    const jobs = await prisma.processingJob.findMany({
      where: { idempotency_key: KEY_RECEIPT_2 },
    })
    expect(jobs).toHaveLength(1)

    // Exactly one expense
    const expenses = await prisma.expense.findMany()
    expect(expenses).toHaveLength(1)
  })

  it('returns 400 when Idempotency-Key header is absent', async () => {
    const res = await request(app)
      .post('/ingest/receipt')
      .send({ object_key: 'receipts/test.jpg' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when object_key is missing from body', async () => {
    const res = await request(app)
      .post('/ingest/receipt')
      .set('Idempotency-Key', KEY_RECEIPT_1)
      .send({})
    expect(res.status).toBe(400)
  })
})

// ── POST /ingest/voice ─────────────────────────────────────────────────────

describe('POST /ingest/voice', () => {
  it('creates an Expense (status=uploaded) and a ProcessingJob → 200', async () => {
    const transcript = 'I spent 25 dollars at Starbucks today'

    const res = await request(app)
      .post('/ingest/voice')
      .set('Idempotency-Key', KEY_VOICE_1)
      .send({ transcript })

    expect(res.status).toBe(200)
    expect(res.body.expense_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    expect(res.body.processing_status).toBe('uploaded')

    // Expense in DB
    const expense = await prisma.expense.findUnique({ where: { id: res.body.expense_id } })
    expect(expense).not.toBeNull()
    expect(expense!.source).toBe('voice')
    expect(expense!.processing_status).toBe('uploaded')
    expect(expense!.raw_input).toEqual({ transcript })
    expect(expense!.amount).toBeNull()   // not yet parsed

    // ProcessingJob in DB
    const job = await prisma.processingJob.findUnique({ where: { idempotency_key: KEY_VOICE_1 } })
    expect(job).not.toBeNull()
    expect(job!.status).toBe('uploaded')
  })

  it('idempotency: duplicate key returns same expense_id without creating a second job', async () => {
    const first = await request(app)
      .post('/ingest/voice')
      .set('Idempotency-Key', KEY_VOICE_2)
      .send({ transcript: 'fifty dollars at Metro' })
    expect(first.status).toBe(200)

    const second = await request(app)
      .post('/ingest/voice')
      .set('Idempotency-Key', KEY_VOICE_2)
      .send({ transcript: 'fifty dollars at Metro' })
    expect(second.status).toBe(200)
    expect(second.body.expense_id).toBe(first.body.expense_id)

    const jobs = await prisma.processingJob.findMany({
      where: { idempotency_key: KEY_VOICE_2 },
    })
    expect(jobs).toHaveLength(1)
  })

  it('returns 400 when Idempotency-Key header is absent', async () => {
    const res = await request(app)
      .post('/ingest/voice')
      .send({ transcript: 'some text' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when transcript is missing from body', async () => {
    const res = await request(app)
      .post('/ingest/voice')
      .set('Idempotency-Key', KEY_VOICE_1)
      .send({})
    expect(res.status).toBe(400)
  })
})
