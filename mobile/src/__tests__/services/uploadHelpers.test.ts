import { preprocessImage, uploadToPresignedUrl } from '../../services/uploadHelpers'

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}))

import { manipulateAsync } from 'expo-image-manipulator'

const mockManipulate = manipulateAsync as jest.Mock

// ── preprocessImage ───────────────────────────────────────────────────────────

describe('preprocessImage', () => {
  it('calls manipulateAsync with resize + compress options', async () => {
    mockManipulate.mockResolvedValueOnce({ uri: 'file://processed.jpg' })
    const result = await preprocessImage('file://original.jpg')
    expect(result).toBe('file://processed.jpg')
    expect(mockManipulate).toHaveBeenCalledWith(
      'file://original.jpg',
      [{ resize: { width: 1600 } }],
      { compress: 0.85, format: 'jpeg' },
    )
  })

  it('returns the processed URI from manipulateAsync', async () => {
    mockManipulate.mockResolvedValueOnce({ uri: 'file://output.jpg' })
    expect(await preprocessImage('file://input.jpg')).toBe('file://output.jpg')
  })
})

// ── uploadToPresignedUrl ──────────────────────────────────────────────────────

describe('uploadToPresignedUrl', () => {
  let mockFetch: jest.Mock

  beforeEach(() => {
    mockFetch = jest.fn()
    global.fetch = mockFetch
  })

  it('fetches the local file then PUTs it to the presigned URL', async () => {
    const mockBlob = { type: 'image/jpeg' }
    mockFetch
      .mockResolvedValueOnce({ blob: () => Promise.resolve(mockBlob) }) // local file
      .mockResolvedValueOnce({ ok: true })                              // S3 PUT

    await uploadToPresignedUrl('https://s3.example.com/presigned', 'file://image.jpg')

    expect(mockFetch).toHaveBeenNthCalledWith(1, 'file://image.jpg')
    expect(mockFetch).toHaveBeenNthCalledWith(2, 'https://s3.example.com/presigned', {
      method: 'PUT',
      body: mockBlob,
      headers: { 'Content-Type': 'image/jpeg' },
    })
  })

  it('throws when the S3 PUT returns a non-ok status', async () => {
    mockFetch
      .mockResolvedValueOnce({ blob: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: false, status: 403 })

    await expect(
      uploadToPresignedUrl('https://s3.example.com/presigned', 'file://image.jpg'),
    ).rejects.toThrow('Storage upload failed (403)')
  })

  it('propagates fetch network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))

    await expect(
      uploadToPresignedUrl('https://s3.example.com/presigned', 'file://image.jpg'),
    ).rejects.toThrow('Network failure')
  })
})
