import React from 'react'
import { View, Text, Button, StyleSheet } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AddStackParamList } from '../navigation/types'

type Props = NativeStackScreenProps<AddStackParamList, 'AddHub'>

// TODO: Replace with designed entry-point UI (icons, descriptions per method).
export default function AddHubScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add an Expense</Text>
      <View style={styles.buttonRow}>
        <Button
          title="Manual Entry"
          onPress={() => navigation.navigate('ManualEntry')}
        />
      </View>
      <View style={styles.buttonRow}>
        <Button
          title="Scan Receipt"
          onPress={() => navigation.navigate('ReceiptCapture')}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  buttonRow: { width: 200 },
})
