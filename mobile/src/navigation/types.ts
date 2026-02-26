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
  // resumeLocalId + resumeImageUri are set when recovering a pending receipt draft
  ReceiptCapture: { resumeLocalId?: string; resumeImageUri?: string }
  // resumeLocalId + resumeTranscript are set when recovering a pending voice draft
  VoiceCapture: { resumeLocalId?: string; resumeTranscript?: string }
}

// ---------- Root tab navigator ----------
export type RootTabParamList = {
  ExpensesTab: NavigatorScreenParams<ExpensesStackParamList>
  AddTab: NavigatorScreenParams<AddStackParamList>
}
