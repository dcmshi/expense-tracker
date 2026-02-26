// voiceParser.ts — heuristic extraction of structured fields from a voice transcript.
//
// Transcripts are free-form sentences ("spent $23 at Metro yesterday"), so
// the patterns target spoken-language idioms rather than receipt formatting.

import { suggestCategory } from './categoryMatcher'

export interface ParsedVoice {
  amount:     number | null
  merchant:   string | null
  date:       string | null
  currency:   string        // always 'CAD' in Phase 1
  category:   string | null // from categoryMatcher
  line_items: []            // always empty for voice
}

// ---------------------------------------------------------------------------
// Amount — "$X", "X dollars", "X bucks"
// ---------------------------------------------------------------------------

function extractAmount(text: string): number | null {
  // Dollar sign prefix: "$23", "$23.50", "$ 5"
  const dollar = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/)
  if (dollar) {
    const n = parseFloat(dollar[1].replace(/,/g, ''))
    if (isFinite(n) && n > 0) return n
  }

  // Spoken amount: "23 dollars", "23.50 bucks"
  const spoken = text.match(/([\d,]+(?:\.\d{1,2})?)\s+(?:dollars?|bucks?)/i)
  if (spoken) {
    const n = parseFloat(spoken[1].replace(/,/g, ''))
    if (isFinite(n) && n > 0) return n
  }

  return null
}

// ---------------------------------------------------------------------------
// Merchant — "at <Name>" or "from <Name>"
// ---------------------------------------------------------------------------

function extractMerchant(text: string): string | null {
  // Match "at Metro", "at Tim Hortons", "from Costco" etc.
  // Capture up to ~4 title-cased words; stop before common boundary words.
  const match = text.match(
    /\b(?:at|from)\s+([A-Z][a-zA-Z&'.]{1,}(?:\s+[A-Z][a-zA-Z&'.]{1,}){0,3})(?=\s+(?:for|on|yesterday|today|last|\d)|[,.]|$)/i,
  )
  if (match) return match[1].trim()
  return null
}

// ---------------------------------------------------------------------------
// Date — relative ("today", "yesterday") + common date formats
// ---------------------------------------------------------------------------

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

function extractDate(text: string): string | null {
  const now = new Date()

  if (/\btoday\b/i.test(text)) {
    return now.toISOString().slice(0, 10)
  }

  if (/\byesterday\b/i.test(text)) {
    const d = new Date(now)
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }

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

  // "Jan 15, 2026" / "January 15 2026"
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
// Public API
// ---------------------------------------------------------------------------

export function parseVoiceTranscript(transcript: string): ParsedVoice {
  const amount   = extractAmount(transcript)
  const merchant = extractMerchant(transcript)
  const date     = extractDate(transcript)
  const category = suggestCategory(merchant, transcript)

  return {
    amount,
    merchant,
    date,
    currency:   'CAD',
    category,
    line_items: [],
  }
}
