import { useState, useMemo, useCallback } from 'react'
import type { Transaction } from '../types'
import { formatEuro, formatDateFR } from '../utils/dataProcessing'

// ── Category colour map ──────────────────────────────────────────────────
const CAT_COLOR: Record<string, { bg: string; text: string }> = {
  'Housing & Utilities': { bg: '#dbeafe', text: '#1d4ed8' },
  'Food & Dining':       { bg: '#dcfce7', text: '#15803d' },
  'Transport':           { bg: '#fef9c3', text: '#92400e' },
  'Shopping':            { bg: '#fce7f3', text: '#9d174d' },
  'Leisure & Culture':   { bg: '#ede9fe', text: '#6d28d9' },
  'Health':              { bg: '#d1fae5', text: '#065f46' },
  'Education':           { bg: '#e0e7ff', text: '#3730a3' },
  'Finance & Transfers': { bg: '#f1f5f9', text: '#475569' },
  'Income':              { bg: '#dcfce7', text: '#166534' },
  'Other':               { bg: '#f3f4f6', text: '#6b7280' },
}

function catStyle(cat: string) {
  return CAT_COLOR[cat] ?? { bg: '#f3f4f6', text: '#6b7280' }
}

// ── Category icon map ────────────────────────────────────────────────────
const CAT_ICON: Record<string, string> = {
  'Housing & Utilities': '🏠',
  'Food & Dining':       '🍽️',
  'Transport':           '🚌',
  'Shopping':            '🛍️',
  'Leisure & Culture':   '🎭',
  'Health':              '💊',
  'Education':           '📚',
  'Finance & Transfers': '💸',
  'Income':              '💰',
  'Other':               '📦',
}

// ── French govt company API ──────────────────────────────────────────────
interface CompanyInfo {
  nom: string
  activite: string
  section: string
  siren: string
  adresse?: string
}

const apiCache: Record<string, CompanyInfo | null> = {}

async function fetchCompanyInfo(query: string): Promise<CompanyInfo | null> {
  const key = query.trim().toLowerCase()
  if (key in apiCache) return apiCache[key]

  try {
    const params = new URLSearchParams({
      q: query,
      per_page: '1',
      minimal: 'true',
      include: 'siege',
    })
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?${params}`,
      { headers: { Accept: 'application/json' } },
    )
    if (!res.ok) { apiCache[key] = null; return null }
    const data = await res.json()
    const r = data.results?.[0]
    if (!r) { apiCache[key] = null; return null }
    const info: CompanyInfo = {
      nom: r.nom_complet ?? r.nom_raison_sociale ?? query,
      activite: r.activite_principale ?? '',
      section: r.section_activite_principale ?? '',
      siren: r.siren ?? '',
      adresse: r.siege?.adresse ?? '',
    }
    apiCache[key] = info
    return info
  } catch {
    apiCache[key] = null
    return null
  }
}

// ── Single row component ──────────────────────────────────────────────────
function TxRow({ tx }: { tx: Transaction }) {
  const [open, setOpen] = useState(false)
  const [company, setCompany] = useState<CompanyInfo | null | 'loading' | 'none'>('none')

  const toggle = useCallback(async () => {
    if (!open && company === 'none') {
      setCompany('loading')
      // Try simplified label first, then raw operation label
      const queries = [
        tx['Libelle simplifie'].trim(),
        tx['Libelle operation'].trim(),
      ].filter(Boolean)
      let found: CompanyInfo | null = null
      for (const q of queries) {
        // Strip leading CB / PRLV / VIR prefixes like the Python backend does
        const cleaned = q.replace(/^(CB|PRLV|VIR|SEPA|INST|DAB|RETRAIT)\s+/i, '').trim()
        found = await fetchCompanyInfo(cleaned)
        if (found) break
      }
      setCompany(found ?? null)
    }
    setOpen(o => !o)
  }, [open, company, tx])

  const cs = catStyle(tx.category)
  const icon = CAT_ICON[tx.category] ?? '📦'
  const isExpense = tx.debit > 0

  return (
    <div
      style={{
        borderBottom: '1px solid #f3f4f6',
        transition: 'background .12s',
      }}
    >
      {/* Main row */}
      <button
        onClick={toggle}
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '36px 1fr auto auto',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Icon circle */}
        <div style={{
          width: 36, height: 36,
          borderRadius: '50%',
          background: cs.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1rem',
          flexShrink: 0,
        }}>
          {icon}
        </div>

        {/* Name + date */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontWeight: 600,
            fontSize: '0.875rem',
            color: '#111827',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {tx['Libelle simplifie'] || tx['Libelle operation']}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 1 }}>
            {formatDateFR(tx.dateISO)} &nbsp;·&nbsp;
            <span style={{
              background: cs.bg,
              color: cs.text,
              borderRadius: 4,
              padding: '0 5px',
              fontSize: '0.68rem',
              fontWeight: 600,
            }}>
              {tx.category}
            </span>
          </div>
        </div>

        {/* Amount */}
        <span style={{
          fontWeight: 700,
          fontSize: '0.95rem',
          color: isExpense ? '#dc2626' : '#16a34a',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {isExpense ? '−' : '+'}{formatEuro(isExpense ? tx.debit : tx.credit)}
        </span>

        {/* Chevron */}
        <span style={{ color: '#d1d5db', fontSize: '0.75rem', flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded detail panel */}
      {open && (
        <div style={{
          padding: '0 1rem 1rem 3.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
        }}>
          {/* Raw bank label */}
          <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
            <span style={{ fontWeight: 600, color: '#374151' }}>Libellé bancaire : </span>
            {tx['Libelle operation']}
          </div>

          {/* Reference */}
          {tx.Reference && (
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
              <span style={{ fontWeight: 600, color: '#374151' }}>Référence : </span>
              {tx.Reference}
            </div>
          )}

          {/* Info complémentaires */}
          {tx['Informations complementaires'] && (
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
              <span style={{ fontWeight: 600, color: '#374151' }}>Info : </span>
              {tx['Informations complementaires']}
            </div>
          )}

          {/* Source */}
          <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
            Catégorisé par : <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>{tx.category_source}</code>
          </div>

          {/* API company info */}
          <div style={{
            marginTop: '0.25rem',
            padding: '0.7rem 0.9rem',
            background: '#f8fafc',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
          }}>
            {company === 'loading' && (
              <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                🔍 Recherche de l'entreprise…
              </span>
            )}
            {company === null && (
              <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                Aucune entreprise trouvée dans le registre français.
              </span>
            )}
            {company !== null && company !== 'loading' && company !== 'none' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>
                  🏢 {company.nom}
                </div>
                {company.activite && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    Activité NAF : <strong>{company.activite}</strong>
                  </div>
                )}
                {company.adresse && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    📍 {company.adresse}
                  </div>
                )}
                {company.siren && (
                  <a
                    href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${company.siren}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.72rem', color: '#6366f1', textDecoration: 'none' }}
                    onClick={e => e.stopPropagation()}
                  >
                    Voir sur annuaire-entreprises.data.gouv.fr →
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
interface Props { transactions: Transaction[] }

const PAGE = 40

export default function TransactionList({ transactions }: Props) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return transactions
    return transactions.filter(t =>
      t['Libelle simplifie'].toLowerCase().includes(q) ||
      t['Libelle operation'].toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q),
    )
  }, [transactions, search])

  const visible = useMemo(() => filtered.slice(0, page * PAGE), [filtered, page])
  const hasMore = visible.length < filtered.length

  // Reset page when search changes
  const handleSearch = (v: string) => { setSearch(v); setPage(1) }

  return (
    <div>
      {/* Search bar */}
      <div style={{ marginBottom: '0.85rem', position: 'relative' }}>
        <span style={{
          position: 'absolute', left: '0.75rem', top: '50%',
          transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none',
        }}>🔍</span>
        <input
          type="text"
          placeholder="Rechercher par libellé, nom simplifié ou catégorie…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '0.55rem 0.9rem 0.55rem 2.1rem',
            borderRadius: 10,
            border: '1px solid #e5e7eb',
            fontSize: '0.875rem',
            background: '#f9fafb',
            outline: 'none',
            color: '#111827',
          }}
        />
        {search && (
          <button
            onClick={() => handleSearch('')}
            style={{
              position: 'absolute', right: '0.65rem', top: '50%',
              transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9ca3af', fontSize: '0.85rem',
            }}
          >✕</button>
        )}
      </div>

      {/* Count */}
      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
        {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
        {search && ` matching "${search}"`}
      </div>

      {/* List */}
      <div style={{
        maxHeight: 520,
        overflowY: 'auto',
        border: '1px solid #f3f4f6',
        borderRadius: 12,
        background: '#fff',
      }}>
        {visible.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            Aucune transaction trouvée.
          </div>
        ) : (
          visible.map((tx, i) => (
            <TxRow key={`${tx.dateISO}-${i}`} tx={tx} />
          ))
        )}

        {/* Load more */}
        {hasMore && (
          <button
            onClick={() => setPage(p => p + 1)}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'transparent',
              border: 'none',
              borderTop: '1px solid #f3f4f6',
              cursor: 'pointer',
              fontSize: '0.8rem',
              color: '#6366f1',
              fontWeight: 600,
            }}
          >
            Afficher {Math.min(PAGE, filtered.length - visible.length)} de plus
            ({filtered.length - visible.length} restantes)
          </button>
        )}
      </div>
    </div>
  )
}
