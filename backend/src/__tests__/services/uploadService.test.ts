import { createPresignedUpload } from '../../services/uploadService'
import prisma from '../../lib/db'

// Mock the presigner — lib/s3 is already stubbed via moduleNameMapper.
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/presigned'),
}))
jest.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: jest.fn(),
}))

const mockFindUnique = prisma.upload.findUnique as jest.Mock
const mockCreate     = prisma.upload.create     as jest.Mock
const mockUpdate     = prisma.upload.update     as jest.Mock

const FUTURE = new Date(Date.now() + 300_000) // 5 min from now
const PAST   = new Date(Date.now() - 300_000) // 5 min ago

describe('createPresignedUpload', () => {
  it('creates a new Upload record on first call', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    mockCreate.mockResolvedValueOnce({})

    const result = await createPresignedUpload('idem-key-1')

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ idempotency_key: 'idem-key-1' }),
      }),
    )
    expect(result.presigned_url).toBe('https://s3.example.com/presigned')
    expect(result.object_key).toMatch(/^receipts\//)
  })

  it('returns a fresh presigned URL for a non-expired existing upload', async () => {
    mockFindUnique.mockResolvedValueOnce({
      object_key:               'receipts/existing.jpg',
      idempotency_key:          'idem-key-2',
      presigned_url_expires_at: FUTURE,
    })

    const result = await createPresignedUpload('idem-key-2')

    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(result.object_key).toBe('receipts/existing.jpg')
    expect(result.presigned_url).toBe('https://s3.example.com/presigned')
  })

  it('refreshes expires_at and returns new presigned URL for expired upload', async () => {
    mockFindUnique.mockResolvedValueOnce({
      object_key:               'receipts/expired.jpg',
      idempotency_key:          'idem-key-3',
      presigned_url_expires_at: PAST,
    })
    mockUpdate.mockResolvedValueOnce({})

    const result = await createPresignedUpload('idem-key-3')

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { idempotency_key: 'idem-key-3' },
        data:  expect.objectContaining({ presigned_url_expires_at: expect.any(Date) }),
      }),
    )
    expect(result.object_key).toBe('receipts/expired.jpg')
    // New expires_at must be in the future
    expect(result.expires_at.getTime()).toBeGreaterThan(Date.now())
  })
})
