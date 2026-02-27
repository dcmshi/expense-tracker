// notificationService uses module-level state (_pushToken), so we reload
// the module fresh for each test via jest.resetModules().

let fetchSpy: jest.SpyInstance

beforeEach(() => {
  jest.resetModules()
  delete process.env.EXPO_PUSH_TOKEN
  fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    text: async () => '{}',
  } as unknown as Response)
})

afterEach(() => {
  fetchSpy.mockRestore()
})

async function loadService() {
  // Dynamic import gives a fresh module after resetModules()
  return import('../../services/notificationService')
}

describe('setToken + sendProcessingComplete', () => {
  it('is a no-op when no token is registered', async () => {
    const svc = await loadService()
    await svc.sendProcessingComplete('exp-1')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('posts to Expo Push API after setToken', async () => {
    const svc = await loadService()
    svc.setToken('ExponentPushToken[abc]')
    await svc.sendProcessingComplete('exp-1')

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.objectContaining({ method: 'POST' }),
    )
    const body = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string,
    )
    expect(body.to).toBe('ExponentPushToken[abc]')
    expect(body.title).toBe('Receipt processed')
    expect(body.data.expenseId).toBe('exp-1')
    expect(body.data.screen).toBe('EditVerify')
  })

  it('seeds token from EXPO_PUSH_TOKEN env var on load', async () => {
    process.env.EXPO_PUSH_TOKEN = 'ExponentPushToken[env]'
    const svc = await loadService()
    await svc.sendProcessingComplete('exp-2')
    expect(fetchSpy).toHaveBeenCalled()
  })
})

describe('sendProcessingFailed', () => {
  it('sends a failure notification with the correct title', async () => {
    const svc = await loadService()
    svc.setToken('ExponentPushToken[abc]')
    await svc.sendProcessingFailed('exp-3')

    const body = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string,
    )
    expect(body.title).toBe('Processing failed')
    expect(body.data.expenseId).toBe('exp-3')
  })
})

describe('error resilience', () => {
  it('does not throw when Expo API returns non-ok', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false, status: 500, text: async () => 'Server Error',
    } as unknown as Response)

    const svc = await loadService()
    svc.setToken('ExponentPushToken[abc]')
    await expect(svc.sendProcessingComplete('exp-4')).resolves.toBeUndefined()
  })

  it('does not throw when fetch rejects', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'))

    const svc = await loadService()
    svc.setToken('ExponentPushToken[abc]')
    await expect(svc.sendProcessingComplete('exp-5')).resolves.toBeUndefined()
  })
})
