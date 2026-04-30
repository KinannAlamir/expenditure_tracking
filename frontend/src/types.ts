// ---------------------------------------------------------------------------
// Raw shape returned by the Python backend
// ---------------------------------------------------------------------------

export interface RawTransaction {
  'Date de comptabilisation': string
  'Libelle simplifie': string
  'Libelle operation': string
  Debit: string
  Credit: string
  Reference?: string
  'Informations complementaires'?: string
  predicted_category: string
  category_source: string
}

export interface AnalysisStats {
  total_rows: number
  debit_differe_removed: number
  debit_differe_total: number
  llm_resolved: number
  llm_unresolved: number
}

export interface AnalysisResult {
  transactions: RawTransaction[]
  stats: AnalysisStats
  category_summary: Record<string, number>
}

// ---------------------------------------------------------------------------
// Enriched shape used in the frontend
// ---------------------------------------------------------------------------

export interface Transaction extends RawTransaction {
  debit: number // absolute value of spending
  credit: number
  amount: number // negative = expense, positive = income
  dateISO: string // YYYY-MM-DD
  month: string // YYYY-MM
  category: string
}

export interface ProcessedData {
  transactions: Transaction[]
  expenses: Transaction[]
  income: Transaction[]
  stats: AnalysisStats
  totalExpenses: number
  totalIncome: number
  net: number
  dateMin: string
  dateMax: string
  months: string[]
  nMonths: number
}
