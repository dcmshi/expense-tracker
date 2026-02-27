import * as uploadsApi from '../../api/uploads'
import client from '../../api/client'

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    get:    jest.fn(),
    post:   jest.fn(),
    patch:  jest.fn(),
    delete: jest.fn(),
    put:    jest.fn(),
  },
}))

const mockPost = client.post as jest.Mock

const UPLOAD_RESPONSE = {
  presigned_url: 'https://s3.example.com/presigned',
  object_key: 'receipts/abc.jpg',
  expires_at: '2026-01-01T01:00:00.000Z',
}

describe('createPresignedUpload', () => {
  it('posts to /uploads with the Idempotency-Key header', async () => {
    mockPost.mockResolvedValueOnce({ data: UPLOAD_RESPONSE })
    const result = await uploadsApi.createPresignedUpload('uuid-key-123')
    expect(mockPost).toHaveBeenCalledWith(
      '/uploads',
      {},
      { headers: { 'Idempotency-Key': 'uuid-key-123' } },
    )
    expect(result).toEqual(UPLOAD_RESPONSE)
  })

  it('returns presigned_url, object_key, and expires_at', async () => {
    mockPost.mockResolvedValueOnce({ data: UPLOAD_RESPONSE })
    const result = await uploadsApi.createPresignedUpload('uuid-key-456')
    expect(result.presigned_url).toBe(UPLOAD_RESPONSE.presigned_url)
    expect(result.object_key).toBe(UPLOAD_RESPONSE.object_key)
    expect(result.expires_at).toBe(UPLOAD_RESPONSE.expires_at)
  })

  it('uses the supplied idempotency key verbatim', async () => {
    mockPost.mockResolvedValueOnce({ data: UPLOAD_RESPONSE })
    await uploadsApi.createPresignedUpload('my-specific-key')
    expect(mockPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      { headers: { 'Idempotency-Key': 'my-specific-key' } },
    )
  })
})
