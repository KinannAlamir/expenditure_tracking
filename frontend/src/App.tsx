import { useState } from 'react'
import type { AnalysisResult, ProcessedData } from './types'
import { processData } from './utils/dataProcessing'
import FileUpload from './components/FileUpload'
import Dashboard from './components/Dashboard'
import './App.css'

type AppState = 'idle' | 'loading' | 'done' | 'error'

export default function App() {
  const [appState, setAppState] = useState<AppState>('idle')
  const [data, setData] = useState<ProcessedData | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')

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
      setData(processData(result))
      setAppState('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setAppState('error')
    }
  }

  function reset() {
    setData(null)
    setAppState('idle')
    setErrorMsg('')
  }

  return (
    <>
      <nav className="app-nav">
        <h1>💳 Expenditure Tracker</h1>
        {appState === 'done' && (
          <button onClick={reset}>← New Analysis</button>
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
