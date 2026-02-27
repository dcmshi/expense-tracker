import request from 'supertest'
import express from 'express'
import uploadsRouter from '../../routes/uploads'
import { errorHandler } from '../../middleware/errorHandler'
import * as uploadService from '../../services/uploadService'

jest.mock('../../services/uploadService')

const app = express()
app.use(express.json())
app.use('/uploads', uploadsRouter)
app.use(errorHandler)

const mockCreate = uploadService.createPresignedUpload as jest.Mock

const UPLOAD_RESULT = {
  presigned_url: 'https://s3.example.com/presigned',
  object_key:    'receipts/abc.jpg',
  expires_at:    new Date('2026-02-17T11:00:00Z'),
}

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('POST /uploads', () => {
  it('returns 200 with presigned URL and object_key', async () => {
    mockCreate.mockResolvedValueOnce(UPLOAD_RESULT)
    const res = await request(app)
      .post('/uploads')
      .set('Idempotency-Key', VALID_UUID)
    expect(res.status).toBe(200)
    expect(res.body.presigned_url).toBe(UPLOAD_RESULT.presigned_url)
    expect(res.body.object_key).toBe(UPLOAD_RESULT.object_key)
    expect(res.body.expires_at).toBe(UPLOAD_RESULT.expires_at.toISOString())
  })

  it('passes the idempotency key to the service', async () => {
    mockCreate.mockResolvedValueOnce(UPLOAD_RESULT)
    await request(app).post('/uploads').set('Idempotency-Key', VALID_UUID)
    expect(mockCreate).toHaveBeenCalledWith(VALID_UUID)
  })

  it('returns 400 when Idempotency-Key header is missing', async () => {
    const res = await request(app).post('/uploads')
    expect(res.status).toBe(400)
  })

  it('returns 400 when Idempotency-Key is not a UUID', async () => {
    const res = await request(app)
      .post('/uploads')
      .set('Idempotency-Key', 'not-a-uuid')
    expect(res.status).toBe(400)
  })
})
