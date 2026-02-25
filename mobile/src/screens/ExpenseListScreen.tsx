import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

// TODO: Fetch expenses from GET /expenses, render list with status badges,
//       pull-to-refresh, empty state, and tap-to-navigate to EditVerify.
export default function ExpenseListScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Expense List — coming soon</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholder: { color: '#888' },
})
