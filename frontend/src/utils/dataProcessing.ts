import type { AnalysisResult, ProcessedData, Transaction } from '../types'

// ---------------------------------------------------------------------------
// Amount parsing (mirrors the Python logic)
// ---------------------------------------------------------------------------

function parseAmount(val: string | undefined): number {
  if (!val || val.trim() === '') return 0
  let s = val.replace(/\xa0/g, '').replace(/\s/g, '').replace(/\u202f/g, '')
  if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.')
  } else {
    s = s.replace(',', '')
  }
  return parseFloat(s) || 0
}

// DD/MM/YYYY → YYYY-MM-DD
function parseFrenchDate(dateStr: string): string {
  const parts = dateStr.trim().split('/')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}-${parts[1]}-${parts[0]}`
}

// ---------------------------------------------------------------------------
// Main transformation
// ---------------------------------------------------------------------------

export function processData(result: AnalysisResult): ProcessedData {
  const transactions: Transaction[] = result.transactions.map((raw) => {
    const debit = Math.abs(parseAmount(raw.Debit))
    const credit = parseAmount(raw.Credit)
    const amount = credit - debit
    const dateISO = parseFrenchDate(raw['Date de comptabilisation'])
    const month = dateISO.substring(0, 7)
    return {
      ...raw,
      debit,
      credit,
      amount,
      dateISO,
      month,
      category: raw.predicted_category,
    }
  })

  // Sort ascending for time-series charts
  transactions.sort((a, b) => a.dateISO.localeCompare(b.dateISO))

  const expenses: Transaction[] = transactions
    .filter((t) => t.amount < 0)
    .map((t) => ({ ...t, debit: Math.abs(t.amount) }))

  const income: Transaction[] = transactions.filter((t) => t.amount > 0)

  const totalExpenses = expenses.reduce((s, t) => s + t.debit, 0)
  const totalIncome = income.reduce((s, t) => s + t.amount, 0)
  const net = totalIncome - totalExpenses

  const dates = transactions.map((t) => t.dateISO).filter(Boolean).sort()
  const dateMin = dates[0] ?? ''
  const dateMax = dates[dates.length - 1] ?? ''

  const months = [...new Set(transactions.map((t) => t.month))].sort()

  return {
    transactions,
    expenses,
    income,
    stats: result.stats,
    totalExpenses,
    totalIncome,
    net,
    dateMin,
    dateMax,
    months,
    nMonths: months.length,
  }
}

// ---------------------------------------------------------------------------
// Generic chart helpers
// ---------------------------------------------------------------------------

/** Group an array into a Record<key, T[]> */
export function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const k = key(item)
      if (!acc[k]) acc[k] = []
      acc[k].push(item)
      return acc
    },
    {} as Record<string, T[]>,
  )
}

/** Sum a numeric field across an array */
export function sumBy<T>(arr: T[], key: (item: T) => number): number {
  return arr.reduce((s, item) => s + key(item), 0)
}

/** Format a number as a Euro currency string */
export function formatEuro(val: number): string {
  return (
    val.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' €'
  )
}

/** Format YYYY-MM-DD as DD/MM/YYYY */
export function formatDateFR(dateISO: string): string {
  if (!dateISO) return ''
  const [y, m, d] = dateISO.split('-')
  return `${d}/${m}/${y}`
}

/** Compute a rolling mean over a numeric array */
export function rollingMean(arr: number[], window: number): number[] {
  return arr.map((_, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = arr.slice(start, i + 1)
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
}
