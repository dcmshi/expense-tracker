import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

// TODO: Poll GET /expenses/{id} while status is uploaded/processing.
//       Show spinner during processing, editable form on awaiting_user,
//       error UI on failed. Confirm via PATCH with is_user_verified: true.
//       Delete via DELETE /expenses/{id}.
export default function EditVerifyScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Edit & Verify — coming soon</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholder: { color: '#888' },
})
