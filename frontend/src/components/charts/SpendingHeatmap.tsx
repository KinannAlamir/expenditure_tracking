import { useMemo } from 'react'
import Plot from '../Plot'
import { groupBy, sumBy } from '../../utils/dataProcessing'
import type { Transaction } from '../../types'

interface Props {
  expenses: Transaction[]
  months: string[]
}

export default function SpendingHeatmap({ expenses, months }: Props) {
  const categories = useMemo(
    () => [...new Set(expenses.map((t) => t.category))].sort(),
    [expenses],
  )

  const zValues = useMemo(() => {
    const byMonthCat = groupBy(expenses, (t) => `${t.month}||${t.category}`)
    return categories.map((cat) =>
      months.map((m) => {
        const key = `${m}||${cat}`
        return sumBy(byMonthCat[key] ?? [], (t) => t.debit)
      }),
    )
  }, [expenses, months, categories])

  return (
    <Plot
      data={[
        {
          type: 'heatmap',
          x: months,
          y: categories,
          z: zValues,
          colorscale: 'Plasma',
          reversescale: false,
          hovertemplate: '%{y}<br>%{x}: %{z:,.2f} €<extra></extra>',
          colorbar: { title: '€' },
        },
      ]}
      layout={{
        height: 420,
        margin: { t: 20, b: 80, l: 160, r: 80 },
        font: { family: 'Inter, system-ui, sans-serif', size: 11 },
        xaxis: { tickangle: -30 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%' }}
      useResizeHandler
    />
  )
}
