import { useMemo } from 'react'
import Plot from '../Plot'
import { groupBy, sumBy } from '../../utils/dataProcessing'
import type { Transaction } from '../../types'

const CATEGORY_COLORS: Record<string, string> = {
  'Food & Dining': '#f59e0b', Shopping: '#6366f1', 'Leisure & Culture': '#ec4899',
  'Finance & Transfers': '#3b82f6', Other: '#9ca3af', Transport: '#14b8a6',
  Health: '#10b981', 'Housing & Utilities': '#8b5cf6', Income: '#22c55e', Education: '#f97316',
}

interface Props { expenses: Transaction[] }

export default function CumulativeSpending({ expenses }: Props) {
  const { dates, catData } = useMemo(() => {
    const byDate = groupBy(expenses, (t) => t.dateISO)
    const allDates = Object.keys(byDate).sort()
    const categories = [...new Set(expenses.map((t) => t.category))].sort()

    const catData = categories.map((cat) => {
      let running = 0
      const ys = allDates.map((d) => {
        const dayExpenses = (byDate[d] ?? []).filter((t) => t.category === cat)
        running += sumBy(dayExpenses, (t) => t.debit)
        return running
      })
      return { cat, ys }
    })

    return { dates: allDates, catData }
  }, [expenses])

  const traces = catData.map(({ cat, ys }) => ({
    type: 'scatter' as const,
    mode: 'lines' as const,
    name: cat,
    x: dates,
    y: ys,
    stackgroup: 'one',
    fill: 'tonexty' as const,
    line: { color: CATEGORY_COLORS[cat] ?? '#9ca3af', width: 0.5 },
    fillcolor: CATEGORY_COLORS[cat] ?? '#9ca3af',
    hovertemplate: `${cat}<br>%{x}<br>Cumulative: %{y:,.2f} €<extra></extra>`,
  }))

  return (
    <Plot
      data={traces}
      layout={{
        height: 420,
        margin: { t: 20, b: 60, l: 70, r: 20 },
        font: { family: 'Inter, system-ui, sans-serif', size: 12 },
        legend: { orientation: 'h', y: -0.28, font: { size: 10 } },
        xaxis: { type: 'date', tickangle: -30 },
        yaxis: { title: 'Cumulative (€)' },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%' }}
      useResizeHandler
    />
  )
}
