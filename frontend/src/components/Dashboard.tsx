import { type ReactNode, useState, useMemo } from 'react'
import { formatEuro, formatDateFR, cropToDateRange } from '../utils/dataProcessing'
import type { ProcessedData } from '../types'
import MonthlyTrend from './charts/MonthlyTrend'
import SummaryTable from './SummaryTable'
import DetectedSubscriptions from './DetectedSubscriptions'
import TransactionList from './TransactionList'
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
  const [rangeMin, setRangeMin] = useState(data.dateMin)
  const [rangeMax, setRangeMax] = useState(data.dateMax)

  // Apply time filter
  const filtered = useMemo(
    () => cropToDateRange(data, rangeMin, rangeMax),
    [data, rangeMin, rangeMax],
  )

  const {
    expenses, income, months, stats,
    totalExpenses, totalIncome, net, dateMin, dateMax, nMonths,
  } = filtered

  return (
    <div className="dashboard">

      {/* ── Time period filter ── */}
      <div className="period-filter chart-card">
        <span className="period-filter-label">📅 Filter period</span>
        <div className="period-filter-inputs">
          <div className="period-input-group">
            <label>From</label>
            <input
              type="date"
              value={rangeMin}
              min={data.dateMin}
              max={rangeMax}
              onChange={e => setRangeMin(e.target.value)}
            />
          </div>
          <span className="period-arrow">→</span>
          <div className="period-input-group">
            <label>To</label>
            <input
              type="date"
              value={rangeMax}
              min={rangeMin}
              max={data.dateMax}
              onChange={e => setRangeMax(e.target.value)}
            />
          </div>
          {(rangeMin !== data.dateMin || rangeMax !== data.dateMax) && (
            <button
              className="period-reset"
              onClick={() => { setRangeMin(data.dateMin); setRangeMax(data.dateMax) }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Summary stats bar ── */}
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

      {/* ── Detected subscriptions ── */}
      <div className="chart-card">
        <h3 className="chart-title">🔁 Detected subscriptions</h3>
        <DetectedSubscriptions expenses={expenses} months={months} />
      </div>

      {/* ── Transaction explorer ── */}
      <div className="chart-card">
        <h3 className="chart-title">💳 Transactions</h3>
        <TransactionList transactions={filtered.transactions} />
      </div>

      {/* ── Monthly trend ── */}
      <ChartCard title="Monthly income vs expenses">
        <MonthlyTrend expenses={expenses} income={income} months={months} />
      </ChartCard>

      {/* ── Summary table ── */}
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
