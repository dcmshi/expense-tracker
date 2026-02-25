import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { ExpensesStackParamList } from '../navigation/types'
import { getExpense, updateExpense, deleteExpense } from '../api/expenses'
import { deleteDraftByExpenseId } from '../storage/draftStorage'
import type { Expense, ProcessingStatus } from '../types'

type Props = NativeStackScreenProps<ExpensesStackParamList, 'EditVerify'>

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 3000

const IN_FLIGHT: ReadonlySet<ProcessingStatus> = new Set(['uploaded', 'processing'])

const STATUS_META: Record<ProcessingStatus, { label: string; bg: string; fg: string }> = {
  uploaded:      { label: 'Uploading',   bg: '#FEF3C7', fg: '#92400E' },
  processing:    { label: 'Processing',  bg: '#FEF3C7', fg: '#92400E' },
  parsed:        { label: 'Parsing',     bg: '#DBEAFE', fg: '#1E40AF' },
  awaiting_user: { label: 'Review',      bg: '#DBEAFE', fg: '#1E40AF' },
  verified:      { label: 'Verified',    bg: '#D1FAE5', fg: '#065F46' },
  failed:        { label: 'Failed',      bg: '#FEE2E2', fg: '#991B1B' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function StatusBadge({ status }: { status: ProcessingStatus }) {
  const { label, bg, fg } = STATUS_META[status]
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  )
}

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

export default function EditVerifyScreen({ route, navigation }: Props) {
  const { expenseId } = route.params

  const [expense, setExpense] = useState<Expense | null>(null)
  const [loadPhase, setLoadPhase] = useState<'loading' | 'error' | 'ready'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    amount: '', merchant: '', category: '', date: '', notes: '',
  })
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const formInitialized = useRef(false)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showFormFromFailed, setShowFormFromFailed] = useState(false)

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchExpense = useCallback(async () => {
    try {
      const data = await getExpense(expenseId)
      setExpense(data)
      setLoadPhase('ready')
    } catch (err: unknown) {
      setLoadError(
        (err as { message?: string })?.message ?? 'Failed to load expense',
      )
      setLoadPhase('error')
    }
  }, [expenseId])

  useEffect(() => {
    fetchExpense()
  }, [fetchExpense])

  // ── Polling — reschedules after every update while in-flight ────────────────

  useEffect(() => {
    if (!expense || !IN_FLIGHT.has(expense.processing_status)) return
    const id = setTimeout(async () => {
      try {
        const fresh = await getExpense(expenseId)
        setExpense(fresh)
        if (!IN_FLIGHT.has(fresh.processing_status)) {
          void deleteDraftByExpenseId(expenseId)
        }
      } catch {
        // Silently ignore poll failures — next tick will retry
      }
    }, POLL_INTERVAL_MS)
    return () => clearTimeout(id)
  }, [expense, expenseId])

  // ── Form population — runs once when expense first reaches an editable state ─

  useEffect(() => {
    if (!expense || formInitialized.current) return
    if (IN_FLIGHT.has(expense.processing_status)) return
    formInitialized.current = true
    setForm({
      amount:   expense.amount   ?? '',
      merchant: expense.merchant ?? '',
      category: expense.category ?? '',
      date:     expense.date     ?? '',
      notes:    expense.notes    ?? '',
    })
  }, [expense])

  // ── Field helpers ───────────────────────────────────────────────────────────

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (field === 'amount' || field === 'date') {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handleConfirm() {
    const amountErr = validateAmount(form.amount)
    const dateErr = validateDate(form.date)
    if (amountErr || dateErr) {
      setFormErrors({ amount: amountErr, date: dateErr })
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      const updated = await updateExpense(expenseId, {
        amount:           parseFloat(form.amount).toFixed(2),
        merchant:         form.merchant.trim()  || undefined,
        category:         form.category.trim()  || undefined,
        date:             form.date.trim(),
        notes:            form.notes.trim()     || undefined,
        is_user_verified: true,
      })
      setExpense(updated)
      void deleteDraftByExpenseId(expenseId)
    } catch (err: unknown) {
      setSaveError(
        (err as { message?: string })?.message ?? 'Failed to save expense',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    Alert.alert(
      'Delete expense',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            try {
              await deleteExpense(expenseId)
              void deleteDraftByExpenseId(expenseId)
              navigation.goBack()
            } catch (err: unknown) {
              setDeleting(false)
              Alert.alert(
                'Error',
                (err as { message?: string })?.message ?? 'Failed to delete expense',
              )
            }
          },
        },
      ],
    )
  }

  // ── Render states ───────────────────────────────────────────────────────────

  if (loadPhase === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (loadPhase === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity style={styles.btn} onPress={fetchExpense}>
          <Text style={styles.btnLabel}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const exp = expense!

  // In-flight: show spinner + status, poll is running in background
  if (IN_FLIGHT.has(exp.processing_status)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#92400E" />
        <Text style={styles.processingTitle}>Processing your receipt…</Text>
        <Text style={styles.processingSubtitle}>
          This usually takes a few seconds.
        </Text>
        <StatusBadge status={exp.processing_status} />
      </View>
    )
  }

  // Failed: show error card with options
  if (exp.processing_status === 'failed' && !showFormFromFailed) {
    return (
      <ScrollView contentContainerStyle={styles.centered}>
        <View style={styles.failedCard}>
          <Text style={styles.failedTitle}>Processing failed</Text>
          {exp.raw_input?.last_error_message ? (
            <Text style={styles.failedDetail}>
              {String(exp.raw_input.last_error_message)}
            </Text>
          ) : (
            <Text style={styles.failedDetail}>
              We couldn't parse this receipt. You can enter the details
              manually or delete this expense.
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.btn}
          onPress={() => {
            if (!formInitialized.current) {
              formInitialized.current = true
              setForm({
                amount:   exp.amount   ?? '',
                merchant: exp.merchant ?? '',
                category: exp.category ?? '',
                date:     exp.date     ?? '',
                notes:    exp.notes    ?? '',
              })
            }
            setShowFormFromFailed(true)
          }}
        >
          <Text style={styles.btnLabel}>Edit Manually</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnDestructive, { marginTop: 10 }]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnLabel}>Delete</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    )
  }

  // Editable form: awaiting_user | parsed | verified | failed+showForm
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Receipt image preview */}
        {exp.receipt_url ? (
          <Image
            source={{ uri: exp.receipt_url }}
            style={styles.receiptImage}
            resizeMode="contain"
          />
        ) : null}

        {/* Status + verified indicator */}
        <View style={styles.statusRow}>
          <StatusBadge status={exp.processing_status} />
          {exp.is_user_verified ? (
            <Text style={styles.verifiedNote}>You verified this</Text>
          ) : null}
        </View>

        <Field label="Amount *" error={formErrors.amount}>
          <TextInput
            style={[styles.input, formErrors.amount && styles.inputError]}
            value={form.amount}
            onChangeText={(v) => setField('amount', v)}
            placeholder="0.00"
            keyboardType="decimal-pad"
            returnKeyType="next"
          />
        </Field>

        <Field label="Merchant">
          <TextInput
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
            style={styles.input}
            value={form.category}
            onChangeText={(v) => setField('category', v)}
            placeholder="e.g. Groceries"
            autoCapitalize="words"
            returnKeyType="next"
          />
        </Field>

        <Field label="Date *" error={formErrors.date}>
          <TextInput
            style={[styles.input, formErrors.date && styles.inputError]}
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

        {saveError ? (
          <Text style={styles.saveError}>{saveError}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.btn, saving && styles.btnDisabled]}
          onPress={handleConfirm}
          disabled={saving || deleting}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnLabel}>
              {exp.is_user_verified ? 'Save Changes' : 'Confirm & Verify'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnDestructive, { marginTop: 10 }]}
          onPress={handleDelete}
          disabled={saving || deleting}
          activeOpacity={0.8}
        >
          {deleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnLabel}>Delete</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 14,
  },

  formContent: {
    padding: 20,
    paddingBottom: 48,
    gap: 4,
  },

  // Processing state
  processingTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  processingSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 4,
  },

  // Failed card
  failedCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 16,
    width: '100%',
    marginBottom: 4,
  },
  failedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 6,
  },
  failedDetail: {
    fontSize: 14,
    color: '#7F1D1D',
    lineHeight: 20,
  },

  // Status row
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  verifiedNote: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '500',
  },

  // Receipt image
  receiptImage: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#F3F4F6',
  },

  // Badge
  badge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Field
  field: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
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
  inputError: { borderColor: '#EF4444' },
  multiline: { height: 88, paddingTop: 10 },
  fieldError: { marginTop: 4, fontSize: 12, color: '#DC2626' },

  // Buttons
  btn: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  btnDisabled: { opacity: 0.5 },
  btnDestructive: { backgroundColor: '#DC2626' },
  btnLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Errors
  errorText: {
    fontSize: 15,
    color: '#991B1B',
    textAlign: 'center',
  },
  saveError: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 8,
  },
})
