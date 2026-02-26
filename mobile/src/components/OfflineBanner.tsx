import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import NetInfo from '@react-native-community/netinfo'

export default function OfflineBanner() {
  const netInfo = NetInfo.useNetInfo()
  const isOffline =
    netInfo.isConnected === false ||
    (netInfo.isConnected === true && netInfo.isInternetReachable === false)

  if (!isOffline) return null

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>No internet connection</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '500',
  },
})
