import request from 'supertest'
import express from 'express'
import ingestRouter from '../../routes/ingest'
import { errorHandler } from '../../middleware/errorHandler'
import * as ingestService from '../../services/ingestService'

jest.mock('../../services/ingestService')

const app = express()
app.use(express.json())
app.use('/ingest', ingestRouter)
app.use(errorHandler)

const mockReceipt = ingestService.ingestReceipt as jest.Mock
const mockVoice   = ingestService.ingestVoice   as jest.Mock

const VALID_UUID   = '550e8400-e29b-41d4-a716-446655440000'
const RECEIPT_RESP = { expense_id: 'exp-r', processing_status: 'uploaded' }
const VOICE_RESP   = { expense_id: 'exp-v', processing_status: 'uploaded' }

// ── POST /ingest/receipt ──────────────────────────────────────────────────────

describe('POST /ingest/receipt', () => {
  it('returns 200 with expense_id and processing_status', async () => {
    mockReceipt.mockResolvedValueOnce(RECEIPT_RESP)
    const res = await request(app)
      .post('/ingest/receipt')
      .set('Idempotency-Key', VALID_UUID)
      .send({ object_key: 'receipts/test.jpg' })
    expect(res.status).toBe(200)
    expect(res.body.expense_id).toBe('exp-r')
    expect(res.body.processing_status).toBe('uploaded')
  })

  it('passes object_key and idempotency key to the service', async () => {
    mockReceipt.mockResolvedValueOnce(RECEIPT_RESP)
    await request(app)
      .post('/ingest/receipt')
      .set('Idempotency-Key', VALID_UUID)
      .send({ object_key: 'receipts/test.jpg' })
    expect(mockReceipt).toHaveBeenCalledWith('receipts/test.jpg', VALID_UUID)
  })

  it('returns 400 when Idempotency-Key is missing', async () => {
    const res = await request(app)
      .post('/ingest/receipt')
      .send({ object_key: 'receipts/test.jpg' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when Idempotency-Key is not a UUID', async () => {
    const res = await request(app)
      .post('/ingest/receipt')
      .set('Idempotency-Key', 'not-a-uuid')
      .send({ object_key: 'receipts/test.jpg' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when object_key is missing', async () => {
    const res = await request(app)
      .post('/ingest/receipt')
      .set('Idempotency-Key', VALID_UUID)
      .send({})
    expect(res.status).toBe(400)
  })
})

// ── POST /ingest/voice ────────────────────────────────────────────────────────

describe('POST /ingest/voice', () => {
  it('returns 200 with expense_id and processing_status', async () => {
    mockVoice.mockResolvedValueOnce(VOICE_RESP)
    const res = await request(app)
      .post('/ingest/voice')
      .set('Idempotency-Key', VALID_UUID)
      .send({ transcript: 'spent $20 at Metro today' })
    expect(res.status).toBe(200)
    expect(res.body.expense_id).toBe('exp-v')
  })

  it('passes transcript and idempotency key to the service', async () => {
    mockVoice.mockResolvedValueOnce(VOICE_RESP)
    await request(app)
      .post('/ingest/voice')
      .set('Idempotency-Key', VALID_UUID)
      .send({ transcript: 'spent $20 at Metro today' })
    expect(mockVoice).toHaveBeenCalledWith('spent $20 at Metro today', VALID_UUID)
  })

  it('returns 400 when transcript is missing', async () => {
    const res = await request(app)
      .post('/ingest/voice')
      .set('Idempotency-Key', VALID_UUID)
      .send({})
    expect(res.status).toBe(400)
  })

  it('returns 400 when Idempotency-Key is missing', async () => {
    const res = await request(app)
      .post('/ingest/voice')
      .send({ transcript: 'hello' })
    expect(res.status).toBe(400)
  })
})
