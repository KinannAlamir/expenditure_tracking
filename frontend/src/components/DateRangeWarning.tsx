import type { FileRange, DateGap } from '../types'
import { formatDateFR } from '../utils/dataProcessing'

interface Props {
  fileRanges: FileRange[]
  gaps: DateGap[]
  overlapMin: string | null  // ISO
  overlapMax: string | null  // ISO
  onCrop: (min: string, max: string) => void
  onKeep: () => void
}

export default function DateRangeWarning({ fileRanges, gaps, overlapMin, overlapMax, onCrop, onKeep }: Props) {
  const sorted = [...fileRanges].sort((a, b) => a.date_min_iso.localeCompare(b.date_min_iso))

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: '#1e293b',
        borderRadius: '1rem',
        padding: '2.5rem',
        maxWidth: '640px',
        width: '100%',
        border: '1px solid #f59e0b55',
        boxShadow: '0 0 40px #f59e0b22',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '2rem' }}>⚠️</span>
          <div>
            <h2 style={{ margin: 0, color: '#f59e0b', fontSize: '1.25rem', fontWeight: 700 }}>
              Date gaps detected between files
            </h2>
            <p style={{ margin: '0.25rem 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>
              {gaps.length} gap{gaps.length > 1 ? 's' : ''} found — some months may be missing from your data.
            </p>
          </div>
        </div>

        {/* File range table */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 0.75rem', color: '#cbd5e1', fontSize: '0.875rem', fontWeight: 600 }}>
            File date ranges:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sorted.map((fr, i) => {
              const isGapAfter = gaps.some(g => g.file_a === fr.filename)
              return (
                <div key={fr.filename}>
                  <div style={{
                    background: '#0f172a',
                    borderRadius: '0.5rem',
                    padding: '0.65rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid #334155',
                  }}>
                    <span style={{ color: '#e2e8f0', fontSize: '0.875rem', fontWeight: 500 }}>
                      📄 {fr.filename}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                      {formatDateFR(fr.date_min_iso)} → {formatDateFR(fr.date_max_iso)}
                      &nbsp;
                      <span style={{ color: '#64748b' }}>({fr.row_count} rows)</span>
                    </span>
                  </div>
                  {/* Gap indicator between files */}
                  {isGapAfter && i < sorted.length - 1 && (() => {
                    const gap = gaps.find(g => g.file_a === fr.filename)!
                    return (
                      <div style={{
                        margin: '0.25rem 0',
                        padding: '0.4rem 1rem',
                        background: '#7c341533',
                        border: '1px dashed #f59e0b66',
                        borderRadius: '0.4rem',
                        color: '#fbbf24',
                        fontSize: '0.8rem',
                        textAlign: 'center',
                      }}>
                        ⚡ {gap.gap_days}-day gap — {formatDateFR(gap.end_iso)} → {formatDateFR(gap.start_iso)}
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {overlapMin && overlapMax ? (
            <button
              onClick={() => onCrop(overlapMin, overlapMax)}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✂️ Crop to common window &nbsp;
              <span style={{ fontWeight: 400, fontSize: '0.85rem' }}>
                ({formatDateFR(overlapMin)} → {formatDateFR(overlapMax)})
              </span>
            </button>
          ) : (
            <div style={{ color: '#f87171', fontSize: '0.875rem', padding: '0.5rem 0' }}>
              ⚠️ No overlapping period found between files — all data will be kept.
            </div>
          )}
          <button
            onClick={onKeep}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: '0.5rem',
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            Keep all data and continue →
          </button>
        </div>
      </div>
    </div>
  )
}
