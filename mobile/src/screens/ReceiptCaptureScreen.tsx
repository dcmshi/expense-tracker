import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

// TODO: Request camera permission, capture photo, on-device preprocessing.
//       Generate idempotency key (UUID), call POST /uploads → upload to presigned URL
//       → POST /ingest/receipt. Save LocalExpenseDraft, navigate to EditVerify.
export default function ReceiptCaptureScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Receipt Capture — coming soon</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholder: { color: '#888' },
})
