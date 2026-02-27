import { suggestCategory } from '../../workers/categoryMatcher'

describe('suggestCategory', () => {
  it('returns null when both merchant and text are empty', () => {
    expect(suggestCategory(null, '')).toBeNull()
  })

  it('matches Groceries from merchant name', () => {
    expect(suggestCategory('Metro', '')).toBe('Groceries')
    expect(suggestCategory('Costco', '')).toBe('Groceries')
    expect(suggestCategory('Loblaws', '')).toBe('Groceries')
  })

  it('matches Groceries from text', () => {
    expect(suggestCategory(null, 'grocery store visit')).toBe('Groceries')
    expect(suggestCategory(null, 'food market receipt')).toBe('Groceries')
  })

  it('matches Restaurant', () => {
    expect(suggestCategory("McDonald's", '')).toBe('Restaurant')
    expect(suggestCategory('Tim Hortons', 'coffee and muffin')).toBe('Restaurant')
    expect(suggestCategory(null, 'pizza order')).toBe('Restaurant')
  })

  it('matches Fuel', () => {
    expect(suggestCategory('Shell', '')).toBe('Fuel')
    expect(suggestCategory('Petro-Canada', '')).toBe('Fuel')
    expect(suggestCategory(null, 'gas station fill-up')).toBe('Fuel')
  })

  it('matches Transport', () => {
    expect(suggestCategory('Uber', '')).toBe('Transport')
    expect(suggestCategory(null, 'parking fee')).toBe('Transport')
    expect(suggestCategory(null, 'transit pass')).toBe('Transport')
  })

  it('matches Utilities', () => {
    expect(suggestCategory('Bell', '')).toBe('Utilities')
    expect(suggestCategory(null, 'hydro electric bill')).toBe('Utilities')
    expect(suggestCategory('Rogers', '')).toBe('Utilities')
  })

  it('matches Healthcare', () => {
    expect(suggestCategory('Shoppers Drug Mart', '')).toBe('Healthcare')
    expect(suggestCategory(null, 'dental clinic visit')).toBe('Healthcare')
    expect(suggestCategory('Rexall', '')).toBe('Healthcare')
  })

  it('matches Shopping', () => {
    expect(suggestCategory('Amazon', '')).toBe('Shopping')
    expect(suggestCategory('IKEA', '')).toBe('Shopping')
    expect(suggestCategory(null, 'best buy electronics')).toBe('Shopping')
  })

  it('matches Entertainment', () => {
    expect(suggestCategory(null, 'Netflix subscription')).toBe('Entertainment')
    expect(suggestCategory(null, 'cinema tickets')).toBe('Entertainment')
    expect(suggestCategory(null, 'spotify premium')).toBe('Entertainment')
  })

  it('returns null for unrecognised merchant and text', () => {
    expect(suggestCategory('Jane Doe Consulting', 'invoice for services')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(suggestCategory('WALMART', '')).toBe('Groceries')
    expect(suggestCategory(null, 'COFFEE SHOP')).toBe('Restaurant')
  })

  it('text match takes precedence over null merchant', () => {
    expect(suggestCategory(null, 'uber ride home')).toBe('Transport')
  })
})
