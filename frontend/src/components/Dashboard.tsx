import type { ReactNode } from 'react'
import { formatEuro, formatDateFR } from '../utils/dataProcessing'
import type { ProcessedData } from '../types'
import CategoryOverview from './charts/CategoryOverview'
import MonthlyTrend from './charts/MonthlyTrend'
import MonthlyByCategory from './charts/MonthlyByCategory'
import TopExpenses from './charts/TopExpenses'
import TopMerchants from './charts/TopMerchants'
import DailyTimeline from './charts/DailyTimeline'
import SpendingHeatmap from './charts/SpendingHeatmap'
import CategoryBoxPlot from './charts/CategoryBoxPlot'
import CumulativeSpending from './charts/CumulativeSpending'
import SummaryTable from './SummaryTable'
import './Dashboard.css'

interface Props { data: ProcessedData }

function StatCard({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${accent ?? ''}`}>{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="chart-card">
      <h3 className="chart-title">{title}</h3>
      {children}
    </div>
  )
}

export default function Dashboard({ data }: Props) {
  const {
    expenses, income, months, stats,
    totalExpenses, totalIncome, net, dateMin, dateMax, nMonths,
  } = data

  return (
    <div className="dashboard">
      {/* Summary stats bar */}
      <div className="stats-bar">
        <StatCard
          label="Total expenses"
          value={formatEuro(totalExpenses)}
          sub={`${expenses.length} transactions`}
          accent="red"
        />
        <StatCard
          label="Total income"
          value={formatEuro(totalIncome)}
          sub={`${income.length} transactions`}
          accent="green"
        />
        <StatCard
          label="Net"
          value={formatEuro(net)}
          accent={net >= 0 ? 'green' : 'red'}
        />
        <StatCard
          label="Period"
          value={`${formatDateFR(dateMin)} → ${formatDateFR(dateMax)}`}
          sub={`${nMonths} month${nMonths !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="Avg / month"
          value={formatEuro(nMonths > 0 ? totalExpenses / nMonths : 0)}
        />
        {stats.debit_differe_removed > 0 && (
          <StatCard
            label="Debit différé filtered"
            value={formatEuro(stats.debit_differe_total)}
            sub={`${stats.debit_differe_removed} rows excluded`}
          />
        )}
      </div>

      {/* Charts grid */}
      <div className="charts-grid">
        <ChartCard title="Spending by category">
          <CategoryOverview expenses={expenses} />
        </ChartCard>

        <ChartCard title="Monthly income vs expenses">
          <MonthlyTrend expenses={expenses} income={income} months={months} />
        </ChartCard>

        <ChartCard title="Monthly breakdown by category">
          <MonthlyByCategory expenses={expenses} months={months} />
        </ChartCard>

        <ChartCard title="Top 20 individual expenses">
          <TopExpenses expenses={expenses} />
        </ChartCard>

        <ChartCard title="Top 15 merchants">
          <TopMerchants expenses={expenses} />
        </ChartCard>

        <ChartCard title="Daily spending & 7-day rolling average">
          <DailyTimeline expenses={expenses} />
        </ChartCard>

        <ChartCard title="Spending heatmap (category × month)">
          <SpendingHeatmap expenses={expenses} months={months} />
        </ChartCard>

        <ChartCard title="Transaction distribution per category">
          <CategoryBoxPlot expenses={expenses} />
        </ChartCard>

        <ChartCard title="Cumulative spending by category">
          <CumulativeSpending expenses={expenses} />
        </ChartCard>
      </div>

      {/* Summary table */}
      <div className="chart-card mt">
        <h3 className="chart-title">Category breakdown</h3>
        <SummaryTable
          expenses={expenses}
          totalExpenses={totalExpenses}
          nMonths={nMonths}
        />
      </div>
    </div>
  )
}
