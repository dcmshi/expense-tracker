import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AddStackParamList } from '../navigation/types'
import { createExpense } from '../api/expenses'

type Props = NativeStackScreenProps<AddStackParamList, 'ManualEntry'>

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

function validateAmount(v: string): string | undefined {
  if (!v.trim()) return 'Amount is required'
  const n = parseFloat(v)
  if (isNaN(n) || n <= 0) return 'Enter a valid positive amount'
  return undefined
}

function validateDate(v: string): string | undefined {
  if (!v.trim()) return 'Date is required'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Use YYYY-MM-DD format'
  if (isNaN(new Date(v).getTime())) return 'Invalid date'
  return undefined
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

interface FormState {
  amount: string
  merchant: string
  category: string
  date: string
  notes: string
}

interface FormErrors {
  amount?: string
  date?: string
}

export default function ManualEntryScreen({ navigation }: Props) {
  const [form, setForm] = useState<FormState>({
    amount: '',
    merchant: '',
    category: '',
    date: todayISO(),
    notes: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (field === 'amount' || field === 'date') {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  async function handleSubmit() {
    const amountErr = validateAmount(form.amount)
    const dateErr = validateDate(form.date)
    if (amountErr || dateErr) {
      setErrors({ amount: amountErr, date: dateErr })
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      await createExpense({
        amount: parseFloat(form.amount).toFixed(2),
        merchant: form.merchant.trim() || undefined,
        category: form.category.trim() || undefined,
        date: form.date.trim(),
        notes: form.notes.trim() || undefined,
      })
      // Switch to the Expenses tab so the user sees their new entry
      navigation.getParent()?.navigate('ExpensesTab' as never)
    } catch (err: unknown) {
      setSubmitError(
        (err as { message?: string })?.message ?? 'Failed to save expense',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Amount *" error={errors.amount}>
          <TextInput
            testID="amount-input"
            style={[styles.input, errors.amount ? styles.inputError : null]}
            value={form.amount}
            onChangeText={(v) => setField('amount', v)}
            placeholder="0.00"
            keyboardType="decimal-pad"
            returnKeyType="next"
            autoFocus
          />
        </Field>

        <Field label="Merchant">
          <TextInput
            testID="merchant-input"
            style={styles.input}
            value={form.merchant}
            onChangeText={(v) => setField('merchant', v)}
            placeholder="e.g. Costco"
            autoCapitalize="words"
            returnKeyType="next"
          />
        </Field>

        <Field label="Category">
          <TextInput
            testID="category-input"
            style={styles.input}
            value={form.category}
            onChangeText={(v) => setField('category', v)}
            placeholder="e.g. Groceries"
            autoCapitalize="words"
            returnKeyType="next"
          />
        </Field>

        <Field label="Date *" error={errors.date}>
          <TextInput
            testID="date-input"
            style={[styles.input, errors.date ? styles.inputError : null]}
            value={form.date}
            onChangeText={(v) => setField('date', v)}
            placeholder="YYYY-MM-DD"
            keyboardType="numeric"
            returnKeyType="next"
            maxLength={10}
          />
        </Field>

        <Field label="Notes">
          <TextInput
            testID="notes-input"
            style={[styles.input, styles.multiline]}
            value={form.notes}
            onChangeText={(v) => setField('notes', v)}
            placeholder="Optional"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            returnKeyType="done"
          />
        </Field>

        {submitError ? (
          <Text style={styles.submitError}>{submitError}</Text>
        ) : null}

        <TouchableOpacity
          testID="save-button"
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonLabel}>Save Expense</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: 20,
    gap: 4,
    paddingBottom: 40,
  },

  // Field wrapper
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Inputs
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 16,
    color: '#111827',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  multiline: {
    height: 88,
    paddingTop: 10,
  },
  fieldError: {
    marginTop: 4,
    fontSize: 12,
    color: '#DC2626',
  },

  // Submit
  submitError: {
    fontSize: 14,
    color: '#DC2626',
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
