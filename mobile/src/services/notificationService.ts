import * as Notifications from 'expo-notifications'
import client from '../api/client'
import { navigationRef } from '../navigation/navigationRef'

export async function requestPermissionsAndRegister(): Promise<void> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync()
    let finalStatus = existing

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      console.log('[notifications] Push permission not granted')
      return
    }

    const tokenData = await Notifications.getExpoPushTokenAsync()
    const token = tokenData.data

    // Fire-and-forget — failure here must never crash the app
    client.put('/device-token', { token }).catch((err) => {
      console.warn('[notifications] Failed to register push token:', err)
    })
  } catch (err) {
    console.warn('[notifications] requestPermissionsAndRegister error:', err)
  }
}

export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge:  false,
    }),
  })
}

export function addNotificationResponseListener(): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as {
      expenseId?: string
      screen?: string
    }

    if (data?.expenseId && data?.screen === 'EditVerify') {
      if (navigationRef.isReady()) {
        navigationRef.navigate('ExpensesTab', {
          screen: 'EditVerify',
          params: { expenseId: data.expenseId },
        } as never)
      }
    }
  })
}
