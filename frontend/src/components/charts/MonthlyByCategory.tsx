import { useMemo } from 'react'
import Plot from '../Plot'
import { groupBy, sumBy } from '../../utils/dataProcessing'
import type { Transaction } from '../../types'

const CATEGORY_COLORS: Record<string, string> = {
  'Food & Dining': '#f59e0b',
  Shopping: '#6366f1',
  'Leisure & Culture': '#ec4899',
  'Finance & Transfers': '#3b82f6',
  Other: '#9ca3af',
  Transport: '#14b8a6',
  Health: '#10b981',
  'Housing & Utilities': '#8b5cf6',
  Income: '#22c55e',
  Education: '#f97316',
}

interface Props {
  expenses: Transaction[]
  months: string[]
}

export default function MonthlyByCategory({ expenses, months }: Props) {
  const categories = useMemo(
    () => [...new Set(expenses.map((t) => t.category))].sort(),
    [expenses],
  )

  const traces = useMemo(
    () =>
      categories.map((cat) => {
        const byCat = expenses.filter((t) => t.category === cat)
        const byMonth = groupBy(byCat, (t) => t.month)
        return {
          type: 'bar' as const,
          name: cat,
          x: months,
          y: months.map((m) => sumBy(byMonth[m] ?? [], (t) => t.debit)),
          marker: { color: CATEGORY_COLORS[cat] ?? '#9ca3af' },
          hovertemplate: `${cat}<br>%{x}: %{y:,.2f} €<extra></extra>`,
        }
      }),
    [expenses, months, categories],
  )

  return (
    <Plot
      data={traces}
      layout={{
        barmode: 'stack',
        height: 420,
        margin: { t: 20, b: 60, l: 70, r: 20 },
        font: { family: 'Inter, system-ui, sans-serif', size: 12 },
        legend: { orientation: 'h', y: -0.3, font: { size: 10 } },
        xaxis: { tickangle: -30 },
        yaxis: { title: 'Amount (€)' },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%' }}
      useResizeHandler
    />
  )
}
