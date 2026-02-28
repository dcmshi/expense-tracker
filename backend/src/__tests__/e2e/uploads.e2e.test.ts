// uploads.e2e.test.ts
// Presigned upload URL creation and idempotency against a real database.
// The AWS S3 presigner is mocked so no real S3 connection is needed.

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://fake-s3.example.com/presigned-put'),
}))

// When jest.mock() is present in a file, Jest's module resolution can fall
// back to __mocks__/uuid.js instead of the moduleNameMapper stub. Override
// explicitly to guarantee real UUIDs are generated for object_key uniqueness.
jest.mock('uuid', () => ({ v4: () => require('crypto').randomUUID() }))

import request from 'supertest'
import prisma from '../../lib/db'
import { createApp, truncateAll } from './helpers'

const app = createApp()

// Valid UUIDs required by the Idempotency-Key validation schema
const KEY_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const KEY_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const KEY_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

beforeEach(async () => { await truncateAll() })
afterAll(async () => { await prisma.$disconnect() })

// ── POST /uploads ──────────────────────────────────────────────────────────

describe('POST /uploads', () => {
  it('creates an Upload record and returns presigned URL → 200', async () => {
    const res = await request(app)
      .post('/uploads')
      .set('Idempotency-Key', KEY_A)

    expect(res.status).toBe(200)
    expect(res.body.presigned_url).toBe('https://fake-s3.example.com/presigned-put')
    expect(res.body.object_key).toMatch(/^receipts\/[0-9a-f-]{36}$/)
    expect(res.body.expires_at).toBeTruthy()

    // Verify Upload record in DB
    const row = await prisma.upload.findUnique({ where: { idempotency_key: KEY_A } })
    expect(row).not.toBeNull()
    expect(row!.object_key).toBe(res.body.object_key)
    expect(row!.presigned_url_expires_at.getTime()).toBeGreaterThan(Date.now())
  })

  it('idempotency: same key returns same object_key without creating a duplicate → 200', async () => {
    const first = await request(app).post('/uploads').set('Idempotency-Key', KEY_B)
    expect(first.status).toBe(200)

    const second = await request(app).post('/uploads').set('Idempotency-Key', KEY_B)
    expect(second.status).toBe(200)
    expect(second.body.object_key).toBe(first.body.object_key)

    // Exactly one row in the DB
    const rows = await prisma.upload.findMany({ where: { idempotency_key: KEY_B } })
    expect(rows).toHaveLength(1)
  })

  it('idempotency with expired URL: refreshes expires_at and keeps same object_key', async () => {
    // Seed an already-expired Upload record
    await prisma.upload.create({
      data: {
        object_key:               'receipts/expired-test-key',
        idempotency_key:          KEY_C,
        presigned_url_expires_at: new Date(Date.now() - 60_000), // 1 min ago
      },
    })

    const res = await request(app).post('/uploads').set('Idempotency-Key', KEY_C)

    expect(res.status).toBe(200)
    expect(res.body.object_key).toBe('receipts/expired-test-key')

    // DB record should have a refreshed expiry
    const row = await prisma.upload.findUnique({ where: { idempotency_key: KEY_C } })
    expect(row!.presigned_url_expires_at.getTime()).toBeGreaterThan(Date.now())
  })

  it('returns 400 when Idempotency-Key header is absent', async () => {
    const res = await request(app).post('/uploads')
    expect(res.status).toBe(400)
  })

  it('returns 400 when Idempotency-Key is not a valid UUID', async () => {
    const res = await request(app).post('/uploads').set('Idempotency-Key', 'not-a-uuid')
    expect(res.status).toBe(400)
  })
})
