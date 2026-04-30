import { useMemo } from 'react'
import { groupBy, sumBy, formatEuro } from '../utils/dataProcessing'
import type { Transaction } from '../types'
import './SummaryTable.css'

interface Props {
  expenses: Transaction[]
  totalExpenses: number
  nMonths: number
}

export default function SummaryTable({ expenses, totalExpenses, nMonths }: Props) {
  const rows = useMemo(() => {
    const grouped = groupBy(expenses, (t) => t.category)
    return Object.entries(grouped)
      .map(([cat, txs]) => {
        const total = sumBy(txs, (t) => t.debit)
        const sorted = [...txs].sort((a, b) => b.debit - a.debit)
        const amounts = txs.map((t) => t.debit)
        const avg = total / amounts.length
        const median = sorted[Math.floor(amounts.length / 2)]?.debit ?? 0
        const max = sorted[0]?.debit ?? 0
        const pct = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0
        return {
          cat,
          count: txs.length,
          total,
          avg,
          median,
          max,
          perMonth: nMonths > 0 ? total / nMonths : 0,
          pct,
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [expenses, totalExpenses, nMonths])

  return (
    <div className="table-wrapper">
      <table className="summary-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>#</th>
            <th>Total</th>
            <th>% of spend</th>
            <th>Avg / tx</th>
            <th>Median</th>
            <th>Max</th>
            <th>Avg / month</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cat}>
              <td className="cat-name">{r.cat}</td>
              <td className="num">{r.count}</td>
              <td className="num bold">{formatEuro(r.total)}</td>
              <td className="num">
                <span className="pct-bar">
                  <span className="pct-fill" style={{ width: `${r.pct}%` }} />
                  <span className="pct-label">{r.pct.toFixed(1)}%</span>
                </span>
              </td>
              <td className="num">{formatEuro(r.avg)}</td>
              <td className="num">{formatEuro(r.median)}</td>
              <td className="num">{formatEuro(r.max)}</td>
              <td className="num">{formatEuro(r.perMonth)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
