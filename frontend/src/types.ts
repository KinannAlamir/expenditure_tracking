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

export interface FileRange {
  filename: string
  date_min: string      // DD/MM/YYYY
  date_max: string      // DD/MM/YYYY
  date_min_iso: string  // YYYY-MM-DD
  date_max_iso: string  // YYYY-MM-DD
  row_count: number
}

export interface DateGap {
  file_a: string
  file_b: string
  gap_days: number
  end_iso: string    // last date of file_a
  start_iso: string  // first date of file_b
}

export interface AnalysisStats {
  total_rows: number
  debit_differe_removed: number
  debit_differe_total: number
  llm_resolved: number
  llm_unresolved: number
  file_ranges: FileRange[]
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
