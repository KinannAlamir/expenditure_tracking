import { useMemo } from 'react'
import Plot from '../Plot'
import { groupBy, sumBy } from '../../utils/dataProcessing'
import type { Transaction } from '../../types'

interface Props { expenses: Transaction[] }

export default function TopMerchants({ expenses }: Props) {
  const top15 = useMemo(() => {
    const grouped = groupBy(expenses, (t) => t['Libelle simplifie'] || t['Libelle operation'])
    return Object.entries(grouped)
      .map(([name, rows]) => ({
        name,
        total: sumBy(rows, (r) => r.debit),
        count: rows.length,
        category: rows[0]?.category ?? 'Other',
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)
  }, [expenses])

  const labels = top15.map((m) => m.name)
  const values = top15.map((m) => m.total)
  const counts = top15.map((m) => m.count)

  return (
    <Plot
      data={[
        {
          type: 'bar',
          orientation: 'h',
          x: values,
          y: labels,
          marker: { color: '#6366f1', opacity: 0.85 },
          text: values.map((v) => `${v.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`),
          textposition: 'outside',
          customdata: counts,
          hovertemplate: '%{y}<br>Total: %{x:,.2f} €<br>Transactions: %{customdata}<extra></extra>',
        },
      ]}
      layout={{
        height: 500,
        margin: { t: 20, b: 40, l: 220, r: 80 },
        font: { family: 'Inter, system-ui, sans-serif', size: 11 },
        xaxis: { title: 'Total spent (€)' },
        yaxis: { autorange: 'reversed' },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%' }}
      useResizeHandler
    />
  )
}
