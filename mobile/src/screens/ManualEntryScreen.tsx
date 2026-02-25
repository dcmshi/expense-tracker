import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

// TODO: Form with amount (numeric keyboard), merchant, category, date, notes.
//       Validate required fields, submit via POST /expenses, navigate back to list.
export default function ManualEntryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Manual Entry — coming soon</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholder: { color: '#888' },
})
