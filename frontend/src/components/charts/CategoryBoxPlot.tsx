import { useMemo } from 'react'
import Plot from '../Plot'
import { groupBy } from '../../utils/dataProcessing'
import type { Transaction } from '../../types'

interface Props { expenses: Transaction[] }

export default function CategoryBoxPlot({ expenses }: Props) {
  const categories = useMemo(
    () => [...new Set(expenses.map((t) => t.category))].sort(),
    [expenses],
  )

  const traces = useMemo(() => {
    const byCategory = groupBy(expenses, (t) => t.category)
    return categories.map((cat) => ({
      type: 'box' as const,
      name: cat,
      y: (byCategory[cat] ?? []).map((t) => t.debit),
      boxpoints: 'outliers' as const,
      hovertemplate: `${cat}<br>%{y:,.2f} €<extra></extra>`,
    }))
  }, [expenses, categories])

  return (
    <Plot
      data={traces}
      layout={{
        height: 440,
        margin: { t: 20, b: 100, l: 70, r: 20 },
        font: { family: 'Inter, system-ui, sans-serif', size: 11 },
        showlegend: false,
        xaxis: { tickangle: -30 },
        yaxis: { title: 'Transaction amount (€)' },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%' }}
      useResizeHandler
    />
  )
}
