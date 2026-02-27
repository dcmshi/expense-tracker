import * as Notifications from 'expo-notifications'
import client from '../../api/client'
import { navigationRef } from '../../navigation/navigationRef'
import * as notificationService from '../../services/notificationService'

jest.mock('expo-notifications', () => ({
  getPermissionsAsync:                   jest.fn(),
  requestPermissionsAsync:               jest.fn(),
  getExpoPushTokenAsync:                 jest.fn(),
  setNotificationHandler:                jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
}))

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

jest.mock('../../navigation/navigationRef', () => ({
  navigationRef: {
    isReady:  jest.fn(),
    navigate: jest.fn(),
  },
}))

const mockGetPermissions      = Notifications.getPermissionsAsync                     as jest.Mock
const mockRequestPermissions  = Notifications.requestPermissionsAsync                 as jest.Mock
const mockGetToken            = Notifications.getExpoPushTokenAsync                   as jest.Mock
const mockSetHandler          = Notifications.setNotificationHandler                  as jest.Mock
const mockAddListener         = Notifications.addNotificationResponseReceivedListener as jest.Mock

const mockPut      = client.put              as jest.Mock
const mockIsReady  = navigationRef.isReady   as jest.Mock
const mockNavigate = navigationRef.navigate  as jest.Mock

// ── requestPermissionsAndRegister ─────────────────────────────────────────────

describe('requestPermissionsAndRegister', () => {
  it('does nothing when permission is denied', async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: 'denied' })
    mockRequestPermissions.mockResolvedValueOnce({ status: 'denied' })

    await notificationService.requestPermissionsAndRegister()

    expect(mockGetToken).not.toHaveBeenCalled()
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('skips the permission prompt when already granted', async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: 'granted' })
    mockGetToken.mockResolvedValueOnce({ data: 'ExponentPushToken[abc]' })
    mockPut.mockResolvedValueOnce({})

    await notificationService.requestPermissionsAndRegister()

    expect(mockRequestPermissions).not.toHaveBeenCalled()
    expect(mockPut).toHaveBeenCalledWith('/device-token', { token: 'ExponentPushToken[abc]' })
  })

  it('requests permission when not yet determined and registers on grant', async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: 'undetermined' })
    mockRequestPermissions.mockResolvedValueOnce({ status: 'granted' })
    mockGetToken.mockResolvedValueOnce({ data: 'ExponentPushToken[xyz]' })
    mockPut.mockResolvedValueOnce({})

    await notificationService.requestPermissionsAndRegister()

    expect(mockRequestPermissions).toHaveBeenCalled()
    expect(mockPut).toHaveBeenCalledWith('/device-token', { token: 'ExponentPushToken[xyz]' })
  })

  it('does not throw when PUT /device-token fails (fire-and-forget)', async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: 'granted' })
    mockGetToken.mockResolvedValueOnce({ data: 'token' })
    mockPut.mockRejectedValueOnce(new Error('Network error'))

    await expect(notificationService.requestPermissionsAndRegister()).resolves.toBeUndefined()
  })
})

// ── setupNotificationHandler ──────────────────────────────────────────────────

describe('setupNotificationHandler', () => {
  it('calls setNotificationHandler', () => {
    notificationService.setupNotificationHandler()
    expect(mockSetHandler).toHaveBeenCalledWith(
      expect.objectContaining({ handleNotification: expect.any(Function) }),
    )
  })

  it('handler returns shouldShowAlert: true and shouldPlaySound: false', async () => {
    notificationService.setupNotificationHandler()
    const [{ handleNotification }] = mockSetHandler.mock.calls[0] as [{ handleNotification: () => Promise<Record<string, unknown>> }]
    const result = await handleNotification()
    expect(result.shouldShowAlert).toBe(true)
    expect(result.shouldPlaySound).toBe(false)
  })
})

// ── addNotificationResponseListener ──────────────────────────────────────────

describe('addNotificationResponseListener', () => {
  it('returns the subscription object from Notifications', () => {
    const fakeSub = { remove: jest.fn() }
    mockAddListener.mockReturnValueOnce(fakeSub)
    const sub = notificationService.addNotificationResponseListener()
    expect(sub).toBe(fakeSub)
    expect(mockAddListener).toHaveBeenCalled()
  })

  it('navigates to EditVerify when a notification is tapped with correct data', () => {
    mockIsReady.mockReturnValue(true)
    mockAddListener.mockImplementationOnce((cb: (r: unknown) => void) => {
      cb({
        notification: {
          request: { content: { data: { expenseId: 'exp-1', screen: 'EditVerify' } } },
        },
      })
      return { remove: jest.fn() }
    })

    notificationService.addNotificationResponseListener()

    expect(mockNavigate).toHaveBeenCalledWith(
      'ExpensesTab',
      expect.objectContaining({ screen: 'EditVerify', params: { expenseId: 'exp-1' } }),
    )
  })

  it('does not navigate when navigationRef is not ready', () => {
    mockIsReady.mockReturnValue(false)
    mockAddListener.mockImplementationOnce((cb: (r: unknown) => void) => {
      cb({
        notification: {
          request: { content: { data: { expenseId: 'exp-1', screen: 'EditVerify' } } },
        },
      })
      return { remove: jest.fn() }
    })

    notificationService.addNotificationResponseListener()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('does not navigate when screen is not EditVerify', () => {
    mockIsReady.mockReturnValue(true)
    mockAddListener.mockImplementationOnce((cb: (r: unknown) => void) => {
      cb({
        notification: {
          request: { content: { data: { expenseId: 'exp-1', screen: 'OtherScreen' } } },
        },
      })
      return { remove: jest.fn() }
    })

    notificationService.addNotificationResponseListener()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
