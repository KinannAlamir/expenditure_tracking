import { useMemo } from 'react'
import Plot from '../Plot'
import { groupBy, sumBy } from '../../utils/dataProcessing'
import type { Transaction } from '../../types'

interface Props {
  expenses: Transaction[]
  income: Transaction[]
  months: string[]
}

export default function MonthlyTrend({ expenses, income, months }: Props) {
  const { monthlyExpenses, monthlyIncome } = useMemo(() => {
    const expByMonth = groupBy(expenses, (t) => t.month)
    const incByMonth = groupBy(income, (t) => t.month)
    return {
      monthlyExpenses: months.map((m) => sumBy(expByMonth[m] ?? [], (t) => t.debit)),
      monthlyIncome: months.map((m) => sumBy(incByMonth[m] ?? [], (t) => t.amount)),
    }
  }, [expenses, income, months])

  return (
    <Plot
      data={[
        {
          type: 'bar',
          name: 'Expenses',
          x: months,
          y: monthlyExpenses,
          marker: { color: '#ef4444' },
          hovertemplate: '%{x}<br>Expenses: %{y:,.2f} €<extra></extra>',
        },
        {
          type: 'bar',
          name: 'Income',
          x: months,
          y: monthlyIncome,
          marker: { color: '#10b981' },
          hovertemplate: '%{x}<br>Income: %{y:,.2f} €<extra></extra>',
        },
        {
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Net',
          x: months,
          y: months.map((_, i) => monthlyIncome[i] - monthlyExpenses[i]),
          line: { color: '#6366f1', width: 2.5 },
          marker: { size: 6 },
          hovertemplate: '%{x}<br>Net: %{y:,.2f} €<extra></extra>',
        },
      ]}
      layout={{
        barmode: 'group',
        height: 420,
        margin: { t: 20, b: 60, l: 70, r: 20 },
        font: { family: 'Inter, system-ui, sans-serif', size: 12 },
        legend: { orientation: 'h', y: -0.2 },
        xaxis: { tickangle: -30 },
        yaxis: { title: 'Amount (€)' },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        shapes: [{ type: 'line', x0: 0, x1: 1, y0: 0, y1: 0, xref: 'paper', line: { color: '#e5e7eb', width: 1 } }],
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%' }}
      useResizeHandler
    />
  )
}
