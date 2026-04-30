import { useMemo } from 'react'
import Plot from '../Plot'
import { groupBy, sumBy, rollingMean } from '../../utils/dataProcessing'
import type { Transaction } from '../../types'

interface Props { expenses: Transaction[] }

export default function DailyTimeline({ expenses }: Props) {
  const { dates, dailyTotals, rolling7 } = useMemo(() => {
    const byDate = groupBy(expenses, (t) => t.dateISO)
    const allDates = Object.keys(byDate).sort()
    const totals = allDates.map((d) => sumBy(byDate[d], (t) => t.debit))
    return {
      dates: allDates,
      dailyTotals: totals,
      rolling7: rollingMean(totals, 7),
    }
  }, [expenses])

  return (
    <Plot
      data={[
        {
          type: 'bar',
          name: 'Daily spending',
          x: dates,
          y: dailyTotals,
          marker: { color: '#6366f1', opacity: 0.55 },
          hovertemplate: '%{x}<br>%{y:,.2f} €<extra></extra>',
        },
        {
          type: 'scatter',
          mode: 'lines',
          name: '7-day avg',
          x: dates,
          y: rolling7,
          line: { color: '#ef4444', width: 2.5 },
          hovertemplate: '%{x}<br>7d avg: %{y:,.2f} €<extra></extra>',
        },
      ]}
      layout={{
        height: 380,
        margin: { t: 20, b: 60, l: 70, r: 20 },
        font: { family: 'Inter, system-ui, sans-serif', size: 12 },
        legend: { orientation: 'h', y: -0.25 },
        xaxis: { tickangle: -30, type: 'date' },
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
