import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { ExpensesStackParamList } from '../navigation/types'
import { listExpenses } from '../api/expenses'
import type { Expense, ProcessingStatus } from '../types'

type Props = NativeStackScreenProps<ExpensesStackParamList, 'ExpenseList'>

// ── Status badge ────────────────────────────────────────────────────────────

const STATUS_META: Record<
  ProcessingStatus,
  { label: string; bg: string; text: string }
> = {
  uploaded:      { label: 'Uploading',  bg: '#FEF3C7', text: '#92400E' },
  processing:    { label: 'Processing', bg: '#FEF3C7', text: '#92400E' },
  parsed:        { label: 'Parsing',    bg: '#DBEAFE', text: '#1E40AF' },
  awaiting_user: { label: 'Review',     bg: '#DBEAFE', text: '#1E40AF' },
  verified:      { label: 'Verified',   bg: '#D1FAE5', text: '#065F46' },
  failed:        { label: 'Failed',     bg: '#FEE2E2', text: '#991B1B' },
}

function StatusBadge({ status }: { status: ProcessingStatus }) {
  const { label, bg, text } = STATUS_META[status]
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: text }]}>{label}</Text>
    </View>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-')
  const d = new Date(Number(year), Number(month) - 1, Number(day))
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatAmount(amount: string | null, currency: string): string {
  if (!amount) return '—'
  const num = parseFloat(amount)
  return `${num.toFixed(2)} ${currency}`
}

// ── Row ──────────────────────────────────────────────────────────────────────

function ExpenseRow({
  item,
  onPress,
}: {
  item: Expense
  onPress: () => void
}) {
  const isInFlight =
    item.processing_status === 'uploaded' ||
    item.processing_status === 'processing'

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowLeft}>
        <Text style={styles.merchant} numberOfLines={1}>
          {item.merchant ?? 'Unknown merchant'}
        </Text>
        {item.category ? (
          <Text style={styles.category} numberOfLines={1}>
            {item.category}
          </Text>
        ) : null}
        <Text style={styles.date}>{formatDate(item.date)}</Text>
      </View>

      <View style={styles.rowRight}>
        <View style={styles.amountRow}>
          {isInFlight ? (
            <ActivityIndicator size="small" color="#92400E" style={styles.spinner} />
          ) : null}
          <Text style={styles.amount}>
            {formatAmount(item.amount, item.currency)}
          </Text>
        </View>
        <StatusBadge status={item.processing_status} />
      </View>
    </TouchableOpacity>
  )
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function ExpenseListScreen({ navigation }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchExpenses = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    setError(null)
    try {
      const data = await listExpenses()
      setExpenses(data)
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ?? 'Failed to load expenses'
      setError(msg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchExpenses()}>
          <Text style={styles.retryLabel}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <FlatList
      data={expenses}
      keyExtractor={(item) => item.id}
      contentContainerStyle={
        expenses.length === 0 ? styles.emptyContainer : styles.listContent
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchExpenses(true)}
        />
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No expenses yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap Add to record your first expense.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <ExpenseRow
          item={item}
          onPress={() => navigation.navigate('EditVerify', { expenseId: item.id })}
        />
      )}
    />
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  rowLeft: {
    flex: 1,
    marginRight: 12,
    gap: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  merchant: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  category: {
    fontSize: 13,
    color: '#6B7280',
  },
  date: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  spinner: {
    marginRight: 2,
  },

  // Badge
  badge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginLeft: 16,
  },

  // Error
  errorText: {
    fontSize: 15,
    color: '#991B1B',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#111827',
    borderRadius: 8,
  },
  retryLabel: {
    color: '#fff',
    fontWeight: '600',
  },

  // Empty
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
})
