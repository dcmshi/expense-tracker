import React from 'react'
import { render, screen } from '@testing-library/react-native'
import NetInfo from '@react-native-community/netinfo'
import OfflineBanner from '../../components/OfflineBanner'

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    useNetInfo:      jest.fn(),
    addEventListener: jest.fn(() => jest.fn()),
    fetch:           jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
  },
}))

const mockUseNetInfo = (NetInfo as unknown as { useNetInfo: jest.Mock }).useNetInfo

describe('OfflineBanner', () => {
  it('renders nothing when connected with internet access', () => {
    mockUseNetInfo.mockReturnValue({ isConnected: true, isInternetReachable: true })
    render(<OfflineBanner />)
    expect(screen.queryByText('No internet connection')).toBeNull()
  })

  it('renders the banner when isConnected is false', () => {
    mockUseNetInfo.mockReturnValue({ isConnected: false, isInternetReachable: null })
    render(<OfflineBanner />)
    expect(screen.getByText('No internet connection')).toBeTruthy()
  })

  it('renders the banner when connected but internet is unreachable (captive portal)', () => {
    mockUseNetInfo.mockReturnValue({ isConnected: true, isInternetReachable: false })
    render(<OfflineBanner />)
    expect(screen.getByText('No internet connection')).toBeTruthy()
  })

  it('renders nothing when connectivity state is unknown (null)', () => {
    mockUseNetInfo.mockReturnValue({ isConnected: null, isInternetReachable: null })
    render(<OfflineBanner />)
    expect(screen.queryByText('No internet connection')).toBeNull()
  })
})
