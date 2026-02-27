// syncManager uses module-level state (_isConnected, _isSyncing, _unsubscribe).
// We reset modules before each test to get a clean state.

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('syncManager', () => {
  let syncManager: typeof import('../../services/syncManager')
  let capturedCallback: ((state: Record<string, unknown>) => void) | undefined
  let mockUnsubscribe: jest.Mock
  let mockGetDrafts: jest.Mock
  let mockUpdateDraft: jest.Mock
  let mockPreprocessImage: jest.Mock
  let mockCreatePresignedUpload: jest.Mock
  let mockUploadToPresignedUrl: jest.Mock
  let mockIngestReceipt: jest.Mock
  let mockIngestVoice: jest.Mock

  beforeEach(() => {
    jest.resetModules()

    mockUnsubscribe          = jest.fn()
    mockGetDrafts            = jest.fn().mockResolvedValue([])
    mockUpdateDraft          = jest.fn().mockResolvedValue(null)
    mockPreprocessImage      = jest.fn().mockResolvedValue('file://processed.jpg')
    mockCreatePresignedUpload = jest.fn().mockResolvedValue({
      presigned_url: 'https://s3.example.com/presigned',
      object_key:    'receipts/abc.jpg',
    })
    mockUploadToPresignedUrl = jest.fn().mockResolvedValue(undefined)
    mockIngestReceipt        = jest.fn().mockResolvedValue({ expense_id: 'exp-r', processing_status: 'uploaded' })
    mockIngestVoice          = jest.fn().mockResolvedValue({ expense_id: 'exp-v', processing_status: 'uploaded' })

    jest.doMock('@react-native-community/netinfo', () => ({
      __esModule: true,
      default: {
        addEventListener: jest.fn((cb: (state: Record<string, unknown>) => void) => {
          capturedCallback = cb
          return mockUnsubscribe
        }),
      },
    }))

    jest.doMock('../../storage/draftStorage', () => ({
      getDrafts:    mockGetDrafts,
      updateDraft:  mockUpdateDraft,
    }))

    jest.doMock('../../services/uploadHelpers', () => ({
      preprocessImage:       mockPreprocessImage,
      uploadToPresignedUrl:  mockUploadToPresignedUrl,
    }))

    jest.doMock('../../api/uploads', () => ({
      createPresignedUpload: mockCreatePresignedUpload,
    }))

    jest.doMock('../../api/ingest', () => ({
      ingestReceipt: mockIngestReceipt,
      ingestVoice:   mockIngestVoice,
    }))

    jest.doMock('expo-crypto', () => ({
      randomUUID: jest.fn().mockReturnValue('mock-uuid'),
    }))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    syncManager = require('../../services/syncManager')
  })

  afterEach(() => {
    syncManager.stopListening()
  })

  // ── startListening / stopListening ──────────────────────────────────────────

  it('registers a NetInfo listener on startListening', () => {
    syncManager.startListening()
    expect(capturedCallback).toBeDefined()
  })

  it('does not re-subscribe when startListening is called twice', () => {
    syncManager.startListening()
    syncManager.startListening()
    const NetInfo = require('@react-native-community/netinfo').default
    expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1)
  })

  it('calls the unsubscribe function on stopListening', () => {
    syncManager.startListening()
    syncManager.stopListening()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  // ── voice draft sync ────────────────────────────────────────────────────────

  it('syncs a pending voice draft when coming back online', async () => {
    mockGetDrafts.mockResolvedValue([{
      local_id:        'local-v',
      sync_status:     'pending',
      transcript_text: 'spent $20 at Metro',
      edited_fields:   {},
      created_at:      '2026-01-01T00:00:00Z',
      updated_at:      '2026-01-01T00:00:00Z',
    }])

    syncManager.startListening()
    capturedCallback!({ isConnected: false, isInternetReachable: null })  // go offline
    capturedCallback!({ isConnected: true,  isInternetReachable: true  }) // come online

    await flushPromises()
    await flushPromises()

    expect(mockIngestVoice).toHaveBeenCalledWith('spent $20 at Metro', 'mock-uuid')
    expect(mockUpdateDraft).toHaveBeenCalledWith('local-v', {
      sync_status: 'uploaded',
      expense_id:  'exp-v',
    })
  })

  // ── receipt draft sync ──────────────────────────────────────────────────────

  it('syncs a pending receipt draft when coming back online', async () => {
    mockGetDrafts.mockResolvedValue([{
      local_id:             'local-r',
      sync_status:          'pending',
      captured_image_path:  'file://image.jpg',
      edited_fields:        {},
      created_at:           '2026-01-01T00:00:00Z',
      updated_at:           '2026-01-01T00:00:00Z',
    }])

    syncManager.startListening()
    capturedCallback!({ isConnected: false, isInternetReachable: null })
    capturedCallback!({ isConnected: true,  isInternetReachable: true  })

    await flushPromises()
    await flushPromises()

    expect(mockPreprocessImage).toHaveBeenCalledWith('file://image.jpg')
    expect(mockCreatePresignedUpload).toHaveBeenCalledWith('mock-uuid')
    expect(mockUploadToPresignedUrl).toHaveBeenCalledWith(
      'https://s3.example.com/presigned',
      'file://processed.jpg',
    )
    expect(mockIngestReceipt).toHaveBeenCalledWith('receipts/abc.jpg', 'mock-uuid')
    expect(mockUpdateDraft).toHaveBeenCalledWith('local-r', {
      sync_status: 'uploaded',
      expense_id:  'exp-r',
    })
  })

  // ── no duplicate sync ───────────────────────────────────────────────────────

  it('does not trigger a second sync when already connected', async () => {
    syncManager.startListening()
    // First event: _isConnected starts false → justCameOnline = true
    capturedCallback!({ isConnected: true, isInternetReachable: true })
    await flushPromises()
    const callsAfterFirst = mockGetDrafts.mock.calls.length

    // Second event: still connected → justCameOnline = false
    capturedCallback!({ isConnected: true, isInternetReachable: true })
    await flushPromises()

    expect(mockGetDrafts).toHaveBeenCalledTimes(callsAfterFirst)
  })

  // ── skips empty drafts ──────────────────────────────────────────────────────

  it('skips a pending draft that has neither image path nor transcript', async () => {
    mockGetDrafts.mockResolvedValue([{
      local_id:     'local-empty',
      sync_status:  'pending',
      edited_fields: {},
      created_at:   '',
      updated_at:   '',
    }])

    syncManager.startListening()
    capturedCallback!({ isConnected: true, isInternetReachable: true })
    await flushPromises()
    await flushPromises()

    expect(mockIngestReceipt).not.toHaveBeenCalled()
    expect(mockIngestVoice).not.toHaveBeenCalled()
  })

  // ── already-uploaded drafts are skipped ────────────────────────────────────

  it('skips drafts whose sync_status is already uploaded', async () => {
    mockGetDrafts.mockResolvedValue([{
      local_id:        'local-done',
      sync_status:     'uploaded',
      transcript_text: 'should not be synced again',
      edited_fields:   {},
      created_at:      '',
      updated_at:      '',
    }])

    syncManager.startListening()
    capturedCallback!({ isConnected: true, isInternetReachable: true })
    await flushPromises()
    await flushPromises()

    expect(mockIngestVoice).not.toHaveBeenCalled()
  })
})
