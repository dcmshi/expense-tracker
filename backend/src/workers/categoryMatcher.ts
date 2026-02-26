// categoryMatcher.ts — keyword-based category suggestion from merchant name and text.
//
// Returns the first matching category or null if nothing matches.
// Patterns are intentionally broad to maximize recall over precision.

const CATEGORY_PATTERNS: Array<{ category: string; patterns: RegExp[] }> = [
  { category: 'Groceries',     patterns: [/costco|walmart|loblaws|metro|sobeys|superstore|grocery|market|food/i] },
  { category: 'Restaurant',    patterns: [/restaurant|mcdonald|subway|pizza|cafe|coffee|sushi|burger|grill|dine|bistro/i] },
  { category: 'Fuel',          patterns: [/shell|esso|petro|chevron|gas\s*station|fuel|petrol/i] },
  { category: 'Transport',     patterns: [/uber|lyft|taxi|transit|parking|go\s*train|via\s*rail/i] },
  { category: 'Utilities',     patterns: [/hydro|bell|rogers|telus|electric|internet|phone|cable/i] },
  { category: 'Healthcare',    patterns: [/pharmacy|shoppers|rexall|dental|clinic|drug|medical/i] },
  { category: 'Shopping',      patterns: [/amazon|best\s*buy|home\s*depot|ikea|canadian\s*tire|winners|zara/i] },
  { category: 'Entertainment', patterns: [/cinema|movie|netflix|spotify|apple|google\s*play|steam/i] },
]

// suggestCategory — concatenates merchant and text, tests each pattern group,
// returns the first matching category label or null.
export function suggestCategory(merchant: string | null, text: string): string | null {
  const combined = `${merchant ?? ''} ${text}`.trim()
  if (!combined) return null

  for (const { category, patterns } of CATEGORY_PATTERNS) {
    if (patterns.some((p) => p.test(combined))) {
      return category
    }
  }

  return null
}
