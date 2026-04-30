import { useState } from 'react'
import type { AnalysisResult, ProcessedData, DateGap, FileRange } from './types'
import { processData, detectDateGaps, cropToDateRange } from './utils/dataProcessing'
import FileUpload from './components/FileUpload'
import Dashboard from './components/Dashboard'
import DateRangeWarning from './components/DateRangeWarning'
import './App.css'

type AppState = 'idle' | 'loading' | 'warning' | 'done' | 'error'

export default function App() {
  const [appState, setAppState] = useState<AppState>('idle')
  const [data, setData] = useState<ProcessedData | null>(null)
  const [pendingData, setPendingData] = useState<ProcessedData | null>(null)
  const [warningGaps, setWarningGaps] = useState<DateGap[]>([])
  const [warningFileRanges, setWarningFileRanges] = useState<FileRange[]>([])
  const [errorMsg, setErrorMsg] = useState<string>('')

  // Compute the overlapping date window across all file ranges
  function computeOverlap(fileRanges: FileRange[]): { min: string | null; max: string | null } {
    if (fileRanges.length === 0) return { min: null, max: null }
    const sorted = [...fileRanges].sort((a, b) => a.date_min_iso.localeCompare(b.date_min_iso))
    const overlapMin = sorted[sorted.length - 1].date_min_iso   // latest start
    const overlapMax = sorted[0].date_max_iso                   // earliest end
    if (overlapMin > overlapMax) return { min: null, max: null }
    return { min: overlapMin, max: overlapMax }
  }

  async function handleUpload(files: File[], useLlm: boolean) {
    setAppState('loading')
    setErrorMsg('')

    const formData = new FormData()
    for (const file of files) {
      formData.append('files', file)
    }
    formData.append('use_llm', String(useLlm))

    try {
      const resp = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      })

      if (!resp.ok) {
        const detail = await resp.text()
        throw new Error(`Server error ${resp.status}: ${detail}`)
      }

      const result: AnalysisResult = await resp.json()
      const processed = processData(result)
      const fileRanges = result.stats.file_ranges ?? []
      const gaps = detectDateGaps(fileRanges)

      if (gaps.length > 0) {
        setPendingData(processed)
        setWarningGaps(gaps)
        setWarningFileRanges(fileRanges)
        setAppState('warning')
      } else {
        setData(processed)
        setAppState('done')
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setAppState('error')
    }
  }

  function handleCrop(minISO: string, maxISO: string) {
    if (!pendingData) return
    setData(cropToDateRange(pendingData, minISO, maxISO))
    setPendingData(null)
    setAppState('done')
  }

  function handleKeepAll() {
    if (!pendingData) return
    setData(pendingData)
    setPendingData(null)
    setAppState('done')
  }

  function reset() {
    setData(null)
    setPendingData(null)
    setAppState('idle')
    setErrorMsg('')
  }

  const overlap = computeOverlap(warningFileRanges)

  return (
    <>
      <nav className="app-nav">
        <span className="app-nav-brand">💳 Expenditure Tracker</span>

        {appState === 'idle' && (
          <ul className="app-nav-links">
            <li><a href="#about">About</a></li>
            <li><a href="#explained">Explained</a></li>
            <li><a href="#how-it-looks">How it looks</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
        )}

        {(appState === 'done' || appState === 'warning') && (
          <button className="app-nav-back" onClick={reset}>← New Analysis</button>
        )}
      </nav>

      <main className="app-body">
        {appState === 'idle' && <FileUpload onUpload={handleUpload} />}

        {appState === 'loading' && (
          <div className="loading-wrapper">
            <div className="spinner" />
            <p>Analysing your transactions…</p>
            <small>
              LLM classification may take a few seconds for uncached transactions.
            </small>
          </div>
        )}

        {appState === 'warning' && (
          <DateRangeWarning
            fileRanges={warningFileRanges}
            gaps={warningGaps}
            overlapMin={overlap.min}
            overlapMax={overlap.max}
            onCrop={handleCrop}
            onKeep={handleKeepAll}
          />
        )}

        {appState === 'error' && (
          <div className="error-banner">
            <strong>Something went wrong</strong>
            {errorMsg}
            <br />
            <button onClick={reset}>Try again</button>
          </div>
        )}

        {appState === 'done' && data && <Dashboard data={data} />}
      </main>
    </>
  )
}
