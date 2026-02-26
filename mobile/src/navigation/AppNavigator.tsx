import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

import type {
  RootTabParamList,
  ExpensesStackParamList,
  AddStackParamList,
} from './types'

import ExpenseListScreen from '../screens/ExpenseListScreen'
import EditVerifyScreen from '../screens/EditVerifyScreen'
import ManualEntryScreen from '../screens/ManualEntryScreen'
import ReceiptCaptureScreen from '../screens/ReceiptCaptureScreen'
import VoiceCaptureScreen from '../screens/VoiceCaptureScreen'
import AddHubScreen from '../screens/AddHubScreen'

const Tab = createBottomTabNavigator<RootTabParamList>()
const ExpensesStack = createNativeStackNavigator<ExpensesStackParamList>()
const AddStack = createNativeStackNavigator<AddStackParamList>()

function ExpensesNavigator() {
  return (
    <ExpensesStack.Navigator>
      <ExpensesStack.Screen
        name="ExpenseList"
        component={ExpenseListScreen}
        options={{ title: 'Expenses' }}
      />
      <ExpensesStack.Screen
        name="EditVerify"
        component={EditVerifyScreen}
        options={{ title: 'Edit & Verify' }}
      />
    </ExpensesStack.Navigator>
  )
}

function AddNavigator() {
  return (
    <AddStack.Navigator>
      <AddStack.Screen
        name="AddHub"
        component={AddHubScreen}
        options={{ title: 'Add Expense' }}
      />
      <AddStack.Screen
        name="ManualEntry"
        component={ManualEntryScreen}
        options={{ title: 'Manual Entry' }}
      />
      <AddStack.Screen
        name="ReceiptCapture"
        component={ReceiptCaptureScreen}
        options={{ title: 'Scan Receipt' }}
      />
      <AddStack.Screen
        name="VoiceCapture"
        component={VoiceCaptureScreen}
        options={{ title: 'Voice Entry' }}
      />
    </AddStack.Navigator>
  )
}

export default function AppNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="ExpensesTab"
        component={ExpensesNavigator}
        options={{ headerShown: false, title: 'Expenses' }}
      />
      <Tab.Screen
        name="AddTab"
        component={AddNavigator}
        options={{ headerShown: false, title: 'Add' }}
      />
    </Tab.Navigator>
  )
}
