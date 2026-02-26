// Push notification service — sends Expo push notifications to a registered device token.
//
// Token storage is in-memory (single-device MVP). A production implementation
// would persist tokens to the database keyed by user_id.

let _pushToken: string | null = process.env.EXPO_PUSH_TOKEN ?? null

export function setToken(token: string): void {
  _pushToken = token
  console.log('[notifications] Push token registered')
}

interface ExpoPushMessage {
  to:    string
  title: string
  body:  string
  data?: Record<string, unknown>
}

async function sendNotification(msg: ExpoPushMessage): Promise<void> {
  if (!_pushToken) return // no token registered — silent no-op

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(msg),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[notifications] Expo push API error:', response.status, text)
    }
  } catch (err) {
    console.error('[notifications] Failed to send push notification:', err)
  }
}

export async function sendProcessingComplete(expenseId: string): Promise<void> {
  await sendNotification({
    to:    _pushToken!,
    title: 'Receipt processed',
    body:  'Your receipt has been processed. Tap to review.',
    data:  { expenseId, screen: 'EditVerify' },
  })
}

export async function sendProcessingFailed(expenseId: string): Promise<void> {
  await sendNotification({
    to:    _pushToken!,
    title: 'Processing failed',
    body:  'We could not process your receipt. Tap to enter details manually.',
    data:  { expenseId, screen: 'EditVerify' },
  })
}
