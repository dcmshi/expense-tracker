import { parseVoiceTranscript } from '../../workers/voiceParser'

// Fix "today" and "yesterday" relative to a known date so tests are deterministic.
const FIXED_DATE = new Date('2026-02-17T12:00:00Z')

beforeAll(() => {
  jest.useFakeTimers()
  jest.setSystemTime(FIXED_DATE)
})

afterAll(() => {
  jest.useRealTimers()
})

describe('parseVoiceTranscript', () => {
  describe('amount extraction', () => {
    it('extracts dollar-sign prefix amount', () => {
      expect(parseVoiceTranscript('spent $23 at Metro').amount).toBe(23)
    })

    it('extracts decimal dollar amount', () => {
      expect(parseVoiceTranscript('paid $12.50 for coffee').amount).toBe(12.5)
    })

    it('extracts spoken "dollars" amount', () => {
      expect(parseVoiceTranscript('forty-five dollars at Shell').amount).toBeNull() // words, not digits
      expect(parseVoiceTranscript('45 dollars at Shell').amount).toBe(45)
    })

    it('extracts "bucks" spoken amount', () => {
      expect(parseVoiceTranscript('10 bucks for parking').amount).toBe(10)
    })

    it('returns null when no amount found', () => {
      expect(parseVoiceTranscript('bought some groceries').amount).toBeNull()
    })
  })

  describe('merchant extraction', () => {
    it('extracts merchant after "at"', () => {
      expect(parseVoiceTranscript('spent $23 at Metro').merchant).toBe('Metro')
    })

    it('extracts merchant after "from"', () => {
      expect(parseVoiceTranscript('$5 from Tim Hortons').merchant).toBe('Tim Hortons')
    })

    it('extracts multi-word merchant', () => {
      expect(parseVoiceTranscript('bought coffee at Second Cup').merchant).toBe('Second Cup')
    })

    it('returns null when no at/from pattern', () => {
      expect(parseVoiceTranscript('spent $15 on groceries').merchant).toBeNull()
    })
  })

  describe('date extraction', () => {
    it('returns today\'s date for "today"', () => {
      expect(parseVoiceTranscript('bought lunch today').date).toBe('2026-02-17')
    })

    it('returns yesterday\'s date for "yesterday"', () => {
      expect(parseVoiceTranscript('filled up gas yesterday').date).toBe('2026-02-16')
    })

    it('parses ISO date in transcript', () => {
      expect(parseVoiceTranscript('expense on 2026-01-10').date).toBe('2026-01-10')
    })

    it('parses MM/DD/YYYY in transcript', () => {
      expect(parseVoiceTranscript('dated 01/10/2026').date).toBe('2026-01-10')
    })

    it('returns null when no date found', () => {
      expect(parseVoiceTranscript('spent $20 at Costco').date).toBeNull()
    })
  })

  describe('category', () => {
    it('suggests category from merchant', () => {
      expect(parseVoiceTranscript('$10 at Metro today').category).toBe('Groceries')
    })

    it('suggests category from transcript text', () => {
      expect(parseVoiceTranscript('$5 for coffee').category).toBe('Restaurant')
    })

    it('returns null when nothing matches', () => {
      expect(parseVoiceTranscript('$50 payment to consultant').category).toBeNull()
    })
  })

  describe('fixed fields', () => {
    it('always returns CAD currency', () => {
      expect(parseVoiceTranscript('$10').currency).toBe('CAD')
    })

    it('always returns empty line_items', () => {
      expect(parseVoiceTranscript('$10 at Metro').line_items).toEqual([])
    })
  })
})
