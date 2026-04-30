import { useMemo } from 'react'
import Plot from '../Plot'
import type { Transaction } from '../../types'

interface Props { expenses: Transaction[] }

export default function TopExpenses({ expenses }: Props) {
  const top20 = useMemo(
    () =>
      [...expenses]
        .sort((a, b) => b.debit - a.debit)
        .slice(0, 20),
    [expenses],
  )

  const labels = top20.map(
    (t) => `${t['Libelle simplifie'] || t['Libelle operation']} · ${t['Date de comptabilisation']}`,
  )
  const values = top20.map((t) => t.debit)
  const colors = top20.map((t) => {
    const hue: Record<string, string> = {
      'Food & Dining': '#f59e0b', Shopping: '#6366f1', 'Leisure & Culture': '#ec4899',
      Transport: '#14b8a6', Health: '#10b981', 'Housing & Utilities': '#8b5cf6',
      Education: '#f97316', 'Finance & Transfers': '#3b82f6', Other: '#9ca3af',
    }
    return hue[t.category] ?? '#9ca3af'
  })

  return (
    <Plot
      data={[
        {
          type: 'bar',
          orientation: 'h',
          x: values,
          y: labels,
          marker: { color: colors },
          text: values.map((v) => `${v.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`),
          textposition: 'outside',
          hovertemplate: '%{y}<br>%{x:,.2f} €<extra></extra>',
        },
      ]}
      layout={{
        height: 540,
        margin: { t: 20, b: 40, l: 280, r: 80 },
        font: { family: 'Inter, system-ui, sans-serif', size: 11 },
        xaxis: { title: 'Amount (€)' },
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
