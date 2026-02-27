import { parseReceiptText } from '../../workers/receiptParser'

describe('parseReceiptText', () => {
  describe('amount extraction', () => {
    it('extracts labelled total', () => {
      const text = 'Subtotal  $8.00\nHST  $1.04\nTotal  $9.04'
      expect(parseReceiptText(text).amount).toBe(9.04)
    })

    it('takes the LAST total label to skip subtotals', () => {
      const text = 'Total $5.00\nGrand Total $12.50'
      expect(parseReceiptText(text).amount).toBe(12.50)
    })

    it('falls back to the largest dollar amount when no label', () => {
      const text = 'Item A  $3.50\nItem B  $7.25\nItem C  $1.00'
      expect(parseReceiptText(text).amount).toBe(7.25)
    })

    it('handles comma-formatted amounts', () => {
      const text = 'Total  $1,234.56'
      expect(parseReceiptText(text).amount).toBe(1234.56)
    })

    it('handles "Amount Due" label', () => {
      const text = 'Amount Due: $42.00'
      expect(parseReceiptText(text).amount).toBe(42.00)
    })

    it('returns null when no amounts found', () => {
      expect(parseReceiptText('No prices here').amount).toBeNull()
    })
  })

  describe('merchant extraction', () => {
    it('returns the first non-numeric, non-address, non-boilerplate line', () => {
      const text = 'Tim Hortons\n100 Main St\nSubtotal $3.00\nTotal $3.00'
      expect(parseReceiptText(text).merchant).toBe('Tim Hortons')
    })

    it('skips phone number lines', () => {
      const text = '(416) 555-1234\nMetro Grocery\nTotal $20.00'
      expect(parseReceiptText(text).merchant).toBe('Metro Grocery')
    })

    it('skips receipt/invoice header boilerplate', () => {
      const text = 'Receipt\nShell Gas Station\nTotal $55.00'
      expect(parseReceiptText(text).merchant).toBe('Shell Gas Station')
    })

    it('returns null when all early lines match skip patterns', () => {
      const text = '12345\n(800) 555-0000\nTotal $10.00'
      expect(parseReceiptText(text).merchant).toBeNull()
    })
  })

  describe('date extraction', () => {
    it('parses ISO format YYYY-MM-DD', () => {
      expect(parseReceiptText('Date: 2026-02-15').date).toBe('2026-02-15')
    })

    it('parses MM/DD/YYYY format', () => {
      expect(parseReceiptText('Date: 02/15/2026').date).toBe('2026-02-15')
    })

    it('parses "Jan 15, 2026"', () => {
      expect(parseReceiptText('Date: Jan 15, 2026').date).toBe('2026-01-15')
    })

    it('parses "15 Jan 2026"', () => {
      expect(parseReceiptText('Date: 15 Jan 2026').date).toBe('2026-01-15')
    })

    it('parses "February 3 2026"', () => {
      expect(parseReceiptText('February 3 2026').date).toBe('2026-02-03')
    })

    it('returns null when no date found', () => {
      expect(parseReceiptText('No date here').date).toBeNull()
    })
  })

  describe('currency', () => {
    it('always returns CAD', () => {
      expect(parseReceiptText('Total $10').currency).toBe('CAD')
    })
  })

  describe('line items', () => {
    it('extracts items with trailing price', () => {
      const text = 'Milk 2%         $3.49\nBread           $2.50\nTotal           $5.99'
      const items = parseReceiptText(text).line_items
      expect(items).toContainEqual({ description: 'Milk 2%', amount: 3.49 })
      expect(items).toContainEqual({ description: 'Bread', amount: 2.50 })
    })

    it('skips total/tax/subtotal lines', () => {
      const text = 'Subtotal        $5.99\nHST             $0.78\nTotal           $6.77'
      expect(parseReceiptText(text).line_items).toHaveLength(0)
    })

    it('returns empty array when no line items found', () => {
      expect(parseReceiptText('Tim Hortons\nTotal $2.50').line_items).toEqual([])
    })
  })
})
