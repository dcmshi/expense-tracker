import type { NavigatorScreenParams } from '@react-navigation/native'

// ---------- Expenses stack ----------
export type ExpensesStackParamList = {
  ExpenseList: undefined
  EditVerify: { expenseId: string }
}

// ---------- Add stack ----------
export type AddStackParamList = {
  AddHub: undefined
  ManualEntry: undefined
  ReceiptCapture: undefined
}

// ---------- Root tab navigator ----------
export type RootTabParamList = {
  ExpensesTab: NavigatorScreenParams<ExpensesStackParamList>
  AddTab: NavigatorScreenParams<AddStackParamList>
}
