import { useMemo } from 'react'
import Plot from '../Plot'
import { groupBy, sumBy } from '../../utils/dataProcessing'
import type { Transaction } from '../../types'

const COLORS = [
  '#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6',
  '#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16',
]

interface Props { expenses: Transaction[] }

export default function CategoryOverview({ expenses }: Props) {
  const data = useMemo(() => {
    const grouped = groupBy(expenses, (t) => t.category)
    const totals = Object.entries(grouped)
      .map(([cat, rows]) => ({ cat, total: sumBy(rows, (r) => r.debit) }))
      .sort((a, b) => b.total - a.total)
    return totals
  }, [expenses])

  const labels = data.map((d) => d.cat)
  const values = data.map((d) => d.total)

  const layout = {
    grid: { rows: 1, columns: 2, pattern: 'independent' },
    height: 440,
    margin: { t: 40, b: 80, l: 20, r: 20 },
    font: { family: 'Inter, system-ui, sans-serif', size: 12 },
    showlegend: true,
    legend: {
      orientation: 'v' as const,
      x: 0.38,
      y: 0.5,
      xanchor: 'left' as const,
      yanchor: 'middle' as const,
      font: { size: 11 },
      bgcolor: 'transparent',
    },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
  }

  return (
    <Plot
      data={[
        {
          type: 'pie',
          labels,
          values,
          hole: 0.42,
          textinfo: 'percent',
          textposition: 'inside',
          insidetextorientation: 'radial',
          hovertemplate: '%{label}<br>%{value:,.2f} €<br>%{percent}<extra></extra>',
          marker: { colors: COLORS },
          domain: { column: 0, x: [0, 0.38] },
          sort: false,
        },
        {
          type: 'bar',
          x: labels,
          y: values,
          marker: { color: COLORS.slice(0, labels.length) },
          text: values.map((v) => `${v.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`),
          textposition: 'outside',
          hovertemplate: '%{x}<br>%{y:,.2f} €<extra></extra>',
          xaxis: 'x2',
          yaxis: 'y2',
        },
      ]}
      layout={{
        ...layout,
        xaxis2: { domain: [0.62, 1], tickangle: -30 },
        yaxis2: { title: 'Amount (€)' },
        annotations: [
          { text: 'Share', x: 0.19, y: 0.5, xref: 'paper', yref: 'paper', showarrow: false, font: { size: 14, color: '#6b7280' } },
          { text: 'Total per category', x: 0.81, y: 1.04, xref: 'paper', yref: 'paper', showarrow: false, font: { size: 13, color: '#374151' } },
        ],
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%' }}
      useResizeHandler
    />
  )
}
