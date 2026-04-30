import { useMemo, useState } from 'react'
import type { Transaction } from '../types'
import { formatEuro } from '../utils/dataProcessing'

interface Subscription {
  label: string
  category: string
  amount: number          // median debit amount
  monthsActive: string[]  // sorted YYYY-MM list
  consistency: number     // 0–1, fraction of total months it appeared in
  totalPaid: number
  typicalDay: number      // day-of-month the charge usually falls on
}

interface Props {
  expenses: Transaction[]
  months: string[]        // all months in the dataset
}

/** Round to nearest 50-cent bucket to tolerate tiny amount drift */
function bucket(amount: number): number {
  return Math.round(amount * 2) / 2
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

export default function DetectedSubscriptions({ expenses, months }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const subscriptions = useMemo((): Subscription[] => {
    if (months.length < 2) return []

    // Group by simplified label
    const byLabel: Record<string, Transaction[]> = {}
    for (const t of expenses) {
      const key = t['Libelle simplifie'].trim().toLowerCase()
      if (!byLabel[key]) byLabel[key] = []
      byLabel[key].push(t)
    }

    const results: Subscription[] = []

    for (const [, txs] of Object.entries(byLabel)) {
      // Group transactions by month
      const byMonth: Record<string, Transaction[]> = {}
      for (const t of txs) {
        if (!byMonth[t.month]) byMonth[t.month] = []
        byMonth[t.month].push(t)
      }

      const activeMonths = Object.keys(byMonth).sort()

      // Must appear in at least 2 different months
      if (activeMonths.length < 2) continue

      // Each month must have 1 or 2 occurrences (not a supermarket etc.)
      const allCounts = activeMonths.map(m => byMonth[m].length)
      if (allCounts.some(c => c > 2)) continue

      // Amount must be consistent — bucket all per-month medians and check they share a bucket
      const monthlyAmounts = activeMonths.map(m => median(byMonth[m].map(t => t.debit)))
      const buckets = monthlyAmounts.map(bucket)
      const dominantBucket = buckets
        .reduce<Record<number, number>>((acc, b) => { acc[b] = (acc[b] ?? 0) + 1; return acc }, {})
      const maxAmountCount = Math.max(...Object.values(dominantBucket))

      // At least 75% of months must share the same amount bucket
      if (maxAmountCount / activeMonths.length < 0.75) continue

      // Day-of-month consistency: pick one representative tx per month,
      // check that ≥75% fall within ±2 days of the same day-of-month
      const days = activeMonths.map(m => {
        const t = byMonth[m][0]
        return new Date(t.dateISO).getDate()
      })
      // Find the mode day (most common)
      const dayCounts = days.reduce<Record<number, number>>(
        (acc, d) => { acc[d] = (acc[d] ?? 0) + 1; return acc }, {}
      )
      const modeDay = Number(
        Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0][0]
      )
      const nearModeDay = days.filter(d => Math.abs(d - modeDay) <= 2).length
      // At least 75% of occurrences must be within ±2 days of the mode day
      if (nearModeDay / days.length < 0.75) continue

      const consistency = activeMonths.length / months.length
      const amt = median(monthlyAmounts)

      results.push({
        label: txs[0]['Libelle simplifie'].trim(),
        category: txs[0].category,
        amount: amt,
        monthsActive: activeMonths,
        consistency,
        totalPaid: txs.reduce((s, t) => s + t.debit, 0),
        typicalDay: modeDay,
      })
    }

    // Sort by consistency desc, then amount desc
    return results.sort((a, b) =>
      b.consistency - a.consistency || b.amount - a.amount
    )
  }, [expenses, months])

  if (subscriptions.length === 0) {
    return (
      <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
        No recurring subscriptions detected — need at least 2 months of data with consistent amounts.
      </p>
    )
  }

  const totalMonthly = subscriptions.reduce((s, sub) => s + sub.amount, 0)

  return (
    <div>
      {/* Summary strip */}
      <div style={{
        display: 'flex',
        gap: '1.5rem',
        marginBottom: '1.25rem',
        padding: '0.85rem 1.1rem',
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: '10px',
      }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Detected
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827' }}>
            {subscriptions.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>subscriptions</div>
        </div>
        <div style={{ width: 1, background: '#d1fae5' }} />
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Est. monthly cost
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#dc2626' }}>
            {formatEuro(totalMonthly)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>per month</div>
        </div>
        <div style={{ width: 1, background: '#d1fae5' }} />
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Est. annual cost
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#dc2626' }}>
            {formatEuro(totalMonthly * 12)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>per year</div>
        </div>
      </div>

      {/* Subscription rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {subscriptions.map((sub) => {
          const isOpen = expanded === sub.label
          const pct = Math.round(sub.consistency * 100)

          return (
            <div
              key={sub.label}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                overflow: 'hidden',
                background: '#fff',
              }}
            >
              {/* Row header */}
              <button
                onClick={() => setExpanded(isOpen ? null : sub.label)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {/* Category badge */}
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  background: '#ede9fe',
                  color: '#6d28d9',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  {sub.category}
                </span>

                {/* Name */}
                <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>
                  {sub.label}
                </span>

                {/* Consistency bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                  <div style={{
                    width: 60,
                    height: 6,
                    borderRadius: 3,
                    background: '#e5e7eb',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#f87171',
                      borderRadius: 3,
                    }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', width: 32 }}>{pct}%</span>
                </div>

                {/* Amount */}
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#dc2626', flexShrink: 0, minWidth: 70, textAlign: 'right' }}>
                  {formatEuro(sub.amount)}<span style={{ fontWeight: 400, fontSize: '0.75rem', color: '#9ca3af' }}>/mo</span>
                </span>

                <span style={{ color: '#9ca3af', fontSize: '0.8rem', flexShrink: 0 }}>
                  {isOpen ? '▲' : '▼'}
                </span>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{
                  padding: '0 1rem 0.85rem',
                  borderTop: '1px solid #f3f4f6',
                }}>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    Detected in {sub.monthsActive.length} of {months.length} months &nbsp;·&nbsp;
                    Usually around day <strong>{sub.typicalDay}</strong> of the month &nbsp;·&nbsp;
                    Total paid: {formatEuro(sub.totalPaid)}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {months.map(m => {
                      const active = sub.monthsActive.includes(m)
                      return (
                        <span
                          key={m}
                          title={m}
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 500,
                            background: active ? '#dbeafe' : '#f9fafb',
                            color: active ? '#1d4ed8' : '#d1d5db',
                            border: `1px solid ${active ? '#bfdbfe' : '#e5e7eb'}`,
                          }}
                        >
                          {m.slice(0, 7)}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
