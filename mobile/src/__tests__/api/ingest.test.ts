import * as ingestApi from '../../api/ingest'
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

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('ingestReceipt', () => {
  it('posts to /ingest/receipt with object_key and idempotency header', async () => {
    mockPost.mockResolvedValueOnce({
      data: { expense_id: 'exp-r', processing_status: 'uploaded' },
    })
    const result = await ingestApi.ingestReceipt('receipts/test.jpg', VALID_UUID)
    expect(result.expense_id).toBe('exp-r')
    expect(result.processing_status).toBe('uploaded')
    expect(mockPost).toHaveBeenCalledWith(
      '/ingest/receipt',
      { object_key: 'receipts/test.jpg' },
      { headers: { 'Idempotency-Key': VALID_UUID } },
    )
  })

  it('passes the object_key in the body', async () => {
    mockPost.mockResolvedValueOnce({ data: { expense_id: 'x', processing_status: 'uploaded' } })
    await ingestApi.ingestReceipt('receipts/photo.jpg', VALID_UUID)
    expect(mockPost).toHaveBeenCalledWith(
      expect.any(String),
      { object_key: 'receipts/photo.jpg' },
      expect.any(Object),
    )
  })
})

describe('ingestVoice', () => {
  it('posts to /ingest/voice with transcript and idempotency header', async () => {
    mockPost.mockResolvedValueOnce({
      data: { expense_id: 'exp-v', processing_status: 'uploaded' },
    })
    const result = await ingestApi.ingestVoice('spent $20 at Metro', VALID_UUID)
    expect(result.expense_id).toBe('exp-v')
    expect(mockPost).toHaveBeenCalledWith(
      '/ingest/voice',
      { transcript: 'spent $20 at Metro' },
      { headers: { 'Idempotency-Key': VALID_UUID } },
    )
  })

  it('passes the transcript in the body', async () => {
    mockPost.mockResolvedValueOnce({ data: { expense_id: 'y', processing_status: 'uploaded' } })
    await ingestApi.ingestVoice('bought coffee', VALID_UUID)
    expect(mockPost).toHaveBeenCalledWith(
      expect.any(String),
      { transcript: 'bought coffee' },
      expect.any(Object),
    )
  })
})
