import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { VictoryPie, VictoryBar, VictoryChart, VictoryAxis } from 'victory-native'
import { getAnalyticsSummary } from '../api/analytics'
import type { AnalyticsSummary, CategoryBreakdown } from '../api/analytics'

// ── Constants ─────────────────────────────────────────────────────────────────

const CHART_COLOURS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
]

type Period = '1M' | '3M' | '1Y' | 'All'
const PERIODS: { label: string; value: Period }[] = [
  { label: '1M',       value: '1M' },
  { label: '3M',       value: '3M' },
  { label: '1Y',       value: '1Y' },
  { label: 'All Time', value: 'All' },
]

const SCREEN_WIDTH = Dimensions.get('window').width

// ── Helpers ───────────────────────────────────────────────────────────────────

function periodToDates(period: Period): { from?: string; to?: string } {
  const to = new Date()
  const toStr = to.toISOString().slice(0, 10)

  if (period === 'All') return {}

  const from = new Date(to)
  if (period === '1M') from.setMonth(from.getMonth() - 1)
  if (period === '3M') from.setMonth(from.getMonth() - 3)
  if (period === '1Y') from.setFullYear(from.getFullYear() - 1)

  return { from: from.toISOString().slice(0, 10), to: toStr }
}

function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-')
  const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1)
  return d.toLocaleString('default', { month: 'short' })
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const [period, setPeriod] = useState<Period>('1M')
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true)
    setError(null)
    try {
      const { from, to } = periodToDates(p)
      const data = await getAnalyticsSummary(from, to)
      setSummary(data)
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData(period)
  }, [fetchData, period])

  function handlePeriod(p: Period) {
    setPeriod(p)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Period chips */}
      <View style={styles.chips}>
        {PERIODS.map(({ label, value }) => (
          <TouchableOpacity
            key={value}
            style={[styles.chip, period === value && styles.chipActive]}
            onPress={() => handlePeriod(value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipLabel, period === value && styles.chipLabelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      )}

      {!loading && error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData(period)}>
            <Text style={styles.retryLabel}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && summary && (
        <>
          {/* Total card */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total Spending</Text>
            <Text style={styles.totalAmount}>{formatCurrency(summary.total)}</Text>
          </View>

          {summary.categories.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No expenses in this period.</Text>
            </View>
          ) : (
            <>
              {/* Category donut */}
              <Text style={styles.sectionTitle}>By Category</Text>
              <View style={styles.chartContainer}>
                <VictoryPie
                  data={summary.categories.map((c, i) => ({
                    x: c.category ?? 'Uncategorized',
                    y: c.total,
                    fill: CHART_COLOURS[i % CHART_COLOURS.length],
                  }))}
                  colorScale={summary.categories.map((_, i) => CHART_COLOURS[i % CHART_COLOURS.length])}
                  innerRadius={SCREEN_WIDTH * 0.14}
                  width={SCREEN_WIDTH - 32}
                  height={220}
                  padding={{ top: 20, bottom: 20, left: 20, right: 20 }}
                  labels={() => null}
                />
              </View>

              {/* Legend */}
              <View style={styles.legend}>
                {summary.categories.map((c: CategoryBreakdown, i: number) => {
                  const pct = summary.total > 0
                    ? ((c.total / summary.total) * 100).toFixed(1)
                    : '0.0'
                  return (
                    <View key={i} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: CHART_COLOURS[i % CHART_COLOURS.length] }]} />
                      <Text style={styles.legendName} numberOfLines={1}>
                        {c.category ?? 'Uncategorized'}
                      </Text>
                      <Text style={styles.legendAmount}>{formatCurrency(c.total)}</Text>
                      <Text style={styles.legendPct}>{pct}%</Text>
                    </View>
                  )
                })}
              </View>

              {/* Monthly bar chart */}
              {summary.monthly.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Monthly Trend</Text>
                  <View style={styles.chartContainer}>
                    <VictoryChart
                      width={SCREEN_WIDTH - 32}
                      height={220}
                      padding={{ top: 20, bottom: 40, left: 55, right: 20 }}
                    >
                      <VictoryAxis
                        tickFormat={(t: string) => formatMonth(t)}
                        style={{ tickLabels: { fontSize: 11, fill: '#6B7280' } }}
                      />
                      <VictoryAxis
                        dependentAxis
                        tickFormat={(t: number) => `$${t}`}
                        style={{ tickLabels: { fontSize: 11, fill: '#6B7280' } }}
                      />
                      <VictoryBar
                        data={summary.monthly.map((m) => ({ x: m.month, y: m.total }))}
                        style={{ data: { fill: '#3B82F6' } }}
                        barRatio={0.6}
                      />
                    </VictoryChart>
                  </View>
                </>
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 40 },

  // Period chips
  chips: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  chipLabel: { fontSize: 13, color: '#374151', fontWeight: '500' },
  chipLabelActive: { color: '#fff' },

  // Total card
  totalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  totalLabel:  { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  totalAmount: { fontSize: 32, fontWeight: '700', color: '#111827' },

  // Section titles
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 4 },

  // Chart wrapper
  chartContainer: { alignItems: 'center', marginBottom: 8 },

  // Legend
  legend: { marginBottom: 24 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  legendDot:    { width: 10, height: 10, borderRadius: 5 },
  legendName:   { flex: 1, fontSize: 14, color: '#374151' },
  legendAmount: { fontSize: 14, fontWeight: '500', color: '#111827' },
  legendPct:    { fontSize: 13, color: '#6B7280', width: 40, textAlign: 'right' },

  // States
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyText: { color: '#6B7280', fontSize: 14 },
  errorText: { color: '#991B1B', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  retryBtn: {
    backgroundColor: '#111827',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryLabel: { color: '#fff', fontWeight: '600' },
})
