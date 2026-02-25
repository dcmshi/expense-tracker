// receiptParser.ts — heuristic extraction of structured fields from raw OCR text.
//
// Receipts vary significantly in format, so these heuristics are designed to
// be permissive rather than strict — prefer returning a reasonable value over
// returning null. Confidence scoring (Phase 2) will communicate parse quality.

export interface ParsedReceipt {
  amount:     number | null   // total amount due
  merchant:   string | null   // merchant / store name
  date:       string | null   // YYYY-MM-DD
  currency:   string          // ISO 4217 — defaults to CAD
  line_items: LineItem[]
}

export interface LineItem {
  description: string
  amount:      number
}

export function parseReceiptText(text: string): ParsedReceipt {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  return {
    amount:     extractTotal(text, lines),
    merchant:   extractMerchant(lines),
    date:       extractDate(text),
    currency:   'CAD',
    line_items: extractLineItems(lines),
  }
}

// ---------------------------------------------------------------------------
// Amount — try explicit total labels first, fall back to largest value
// ---------------------------------------------------------------------------

function extractTotal(text: string, lines: string[]): number | null {
  // Receipts repeat totals (subtotal → tax → total). The labelled "total" on
  // its own line is most reliable; take the LAST match to skip subtotals.
  const labelledPattern = /(?:total|amount\s*due|grand\s*total|balance\s*due|net\s*total)[:\s]*\$?\s*([\d,]+\.?\d{0,2})/gi
  const labelledMatches = [...text.matchAll(labelledPattern)]

  if (labelledMatches.length > 0) {
    const raw = labelledMatches[labelledMatches.length - 1][1].replace(/,/g, '')
    const amount = parseFloat(raw)
    if (isFinite(amount) && amount > 0) return amount
  }

  // Fallback: collect every dollar amount in the text, return the largest.
  // The total is almost always the single largest figure on the receipt.
  const allAmounts = [...text.matchAll(/\$?\s*([\d,]+\.\d{2})/g)]
    .map(m => parseFloat(m[1].replace(/,/g, '')))
    .filter(n => isFinite(n) && n > 0)

  return allAmounts.length > 0 ? Math.max(...allAmounts) : null
}

// ---------------------------------------------------------------------------
// Merchant — first meaningful line before any numeric content
// ---------------------------------------------------------------------------

function extractMerchant(lines: string[]): string | null {
  const skipPatterns = [
    /^\d+$/,                                            // bare numbers
    /^\+?[\d\s\-().]{7,}$/,                            // phone numbers
    /^\d+\s+\w+.*\b(st|ave|dr|rd|blvd|ln|cres|way)\b/i, // addresses
    /^(receipt|invoice|order|bill|thank|welcome)/i,     // boilerplate headers
    /\$|(?:total|subtotal|tax|hst|gst|pst)/i,           // price lines
  ]

  for (const line of lines.slice(0, 6)) {
    if (line.length < 2) continue
    if (skipPatterns.some(p => p.test(line))) continue
    return line
  }

  return null
}

// ---------------------------------------------------------------------------
// Date — try common formats, normalise to YYYY-MM-DD
// ---------------------------------------------------------------------------

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

function extractDate(text: string): string | null {
  // YYYY-MM-DD (ISO)
  const iso = text.match(/\b(20\d{2})[\/\-](0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])\b/)
  if (iso) {
    const [, y, m, d] = iso
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // MM/DD/YYYY or MM-DD-YYYY
  const mdy = text.match(/\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](20\d{2})\b/)
  if (mdy) {
    const [, m, d, y] = mdy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // "Jan 15, 2026" or "January 15 2026"
  const mdy2 = text.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})[,\s]+(20\d{2})\b/i,
  )
  if (mdy2) {
    const [, mon, d, y] = mdy2
    const m = MONTH_MAP[mon.toLowerCase().slice(0, 3)]
    return `${y}-${m}-${d.padStart(2, '0')}`
  }

  // "15 Jan 2026"
  const dmy = text.match(
    /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(20\d{2})\b/i,
  )
  if (dmy) {
    const [, d, mon, y] = dmy
    const m = MONTH_MAP[mon.toLowerCase().slice(0, 3)]
    return `${y}-${m}-${d.padStart(2, '0')}`
  }

  return null
}

// ---------------------------------------------------------------------------
// Line items — description + trailing price pairs
// ---------------------------------------------------------------------------

function extractLineItems(lines: string[]): LineItem[] {
  const skipPatterns = /(?:total|subtotal|tax|hst|gst|pst|discount|tip|gratuity|change|cash|credit|debit)/i
  const priceAtEnd = /^(.+?)\s{2,}\$?\s*([\d,]+\.\d{2})\s*$/

  const items: LineItem[] = []

  for (const line of lines) {
    if (skipPatterns.test(line)) continue

    const match = line.match(priceAtEnd)
    if (!match) continue

    const description = match[1].trim()
    const amount = parseFloat(match[2].replace(/,/g, ''))

    if (description && isFinite(amount) && amount > 0) {
      items.push({ description, amount })
    }
  }

  return items
}
