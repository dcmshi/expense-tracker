import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import AnalyticsScreen from '../../screens/AnalyticsScreen'
import { getAnalyticsSummary } from '../../api/analytics'

jest.mock('../../api/analytics', () => ({
  getAnalyticsSummary: jest.fn(),
}))

// Stub Victory chart components — tests focus on data/text, not SVG rendering.
jest.mock('victory-native', () => ({
  VictoryPie:   () => null,
  VictoryBar:   () => null,
  VictoryChart: () => null,
  VictoryAxis:  () => null,
}))

const mockGetSummary = getAnalyticsSummary as jest.Mock

const EMPTY_SUMMARY = { total: 0, categories: [], monthly: [] }

const FULL_SUMMARY = {
  total: 250,
  categories: [
    { category: 'Groceries',   total: 150, count: 3 },
    { category: 'Restaurant',  total: 100, count: 2 },
  ],
  monthly: [{ month: '2026-01', total: 250, count: 5 }],
}

describe('AnalyticsScreen', () => {
  it('shows period chips on mount', async () => {
    mockGetSummary.mockResolvedValue(EMPTY_SUMMARY)
    render(<AnalyticsScreen />)
    expect(screen.getByText('1M')).toBeTruthy()
    expect(screen.getByText('3M')).toBeTruthy()
    expect(screen.getByText('1Y')).toBeTruthy()
    expect(screen.getByText('All Time')).toBeTruthy()
  })

  it('shows the empty state when there are no expenses in the period', async () => {
    mockGetSummary.mockResolvedValue(EMPTY_SUMMARY)
    render(<AnalyticsScreen />)
    await waitFor(() => expect(screen.getByText('No expenses in this period.')).toBeTruthy())
  })

  it('shows the total spending amount after data loads', async () => {
    mockGetSummary.mockResolvedValue(FULL_SUMMARY)
    render(<AnalyticsScreen />)
    await waitFor(() => expect(screen.getByText('$250.00')).toBeTruthy())
  })

  it('shows category names in the legend', async () => {
    mockGetSummary.mockResolvedValue(FULL_SUMMARY)
    render(<AnalyticsScreen />)
    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeTruthy()
      expect(screen.getByText('Restaurant')).toBeTruthy()
    })
  })

  it('shows per-category amounts formatted as currency', async () => {
    mockGetSummary.mockResolvedValue(FULL_SUMMARY)
    render(<AnalyticsScreen />)
    await waitFor(() => {
      expect(screen.getByText('$150.00')).toBeTruthy()
      expect(screen.getByText('$100.00')).toBeTruthy()
    })
  })

  it('renders "Uncategorized" for a null category', async () => {
    mockGetSummary.mockResolvedValue({
      total: 50,
      categories: [{ category: null, total: 50, count: 1 }],
      monthly: [],
    })
    render(<AnalyticsScreen />)
    await waitFor(() => expect(screen.getAllByText('Uncategorized')[0]).toBeTruthy())
  })

  it('shows an error message when the API call fails', async () => {
    mockGetSummary.mockRejectedValue({ message: 'Network error' })
    render(<AnalyticsScreen />)
    await waitFor(() => expect(screen.getByText('Network error')).toBeTruthy())
  })

  it('shows a retry button on error', async () => {
    mockGetSummary.mockRejectedValue({ message: 'Oops' })
    render(<AnalyticsScreen />)
    await waitFor(() => expect(screen.getByText('Try Again')).toBeTruthy())
  })

  it('refetches data when the retry button is tapped', async () => {
    mockGetSummary
      .mockRejectedValueOnce({ message: 'Oops' })
      .mockResolvedValueOnce(EMPTY_SUMMARY)
    render(<AnalyticsScreen />)
    await waitFor(() => screen.getByText('Try Again'))
    fireEvent.press(screen.getByText('Try Again'))
    await waitFor(() => expect(mockGetSummary).toHaveBeenCalledTimes(2))
  })

  it('refetches data when a different period chip is tapped', async () => {
    mockGetSummary.mockResolvedValue(EMPTY_SUMMARY)
    render(<AnalyticsScreen />)
    await waitFor(() => screen.getByText('No expenses in this period.'))

    fireEvent.press(screen.getByText('3M'))
    await waitFor(() => expect(mockGetSummary).toHaveBeenCalledTimes(2))
  })
})
