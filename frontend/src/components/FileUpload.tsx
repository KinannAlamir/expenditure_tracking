import { useState, useCallback, type DragEvent, type ChangeEvent } from 'react'
import './FileUpload.css'

interface Props {
  onUpload: (files: File[], useLlm: boolean) => void
}

export default function FileUpload({ onUpload }: Props) {
  const [files, setFiles] = useState<File[]>([])
  const [useLlm, setUseLlm] = useState(true)
  const [isDragging, setIsDragging] = useState(false)

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return
    const csvFiles = Array.from(incoming).filter((f) =>
      f.name.toLowerCase().endsWith('.csv'),
    )
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name))
      return [...prev, ...csvFiles.filter((f) => !names.has(f.name))]
    })
  }, [])

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      addFiles(e.dataTransfer.files)
    },
    [addFiles],
  )

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = () => setIsDragging(false)

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => addFiles(e.target.files)

  const removeFile = (name: string) =>
    setFiles((prev) => prev.filter((f) => f.name !== name))

  const handleSubmit = () => {
    if (files.length === 0) return
    onUpload(files, useLlm)
  }

  return (
    <div className="upload-page">
      <div className="upload-card">
        <div className="upload-header">
          <span className="upload-icon">📂</span>
          <h2>Import your bank CSV</h2>
          <p>
            Export your transactions from your bank (semicolon-delimited, French
            format) and drop the file(s) below.
          </p>
        </div>

        {/* Drop zone */}
        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''} ${files.length > 0 ? 'has-files' : ''}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
        >
          <input
            id="file-input"
            type="file"
            accept=".csv"
            multiple
            onChange={onFileChange}
            className="file-input-hidden"
          />
          <label htmlFor="file-input" className="drop-label">
            <span className="drop-icon">☁️</span>
            <span>
              <strong>Click to browse</strong> or drag &amp; drop CSV files here
            </span>
            <small>Multiple files are merged and deduplicated automatically</small>
          </label>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <ul className="file-list">
            {files.map((f) => (
              <li key={f.name}>
                <span className="file-icon">📄</span>
                <span className="file-name">{f.name}</span>
                <span className="file-size">
                  {(f.size / 1024).toFixed(1)} KB
                </span>
                <button
                  className="remove-btn"
                  onClick={() => removeFile(f.name)}
                  aria-label="Remove file"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Options */}
        <div className="upload-options">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={useLlm}
              onChange={(e) => setUseLlm(e.target.checked)}
            />
            <span className="toggle-track" />
            <span>
              Use LLM classification
              <small>
                Sends unresolved French labels to GPT-4o-mini via OpenRouter.
                Requires <code>OPENROUTER_API_KEY</code> in <code>.env</code>.
              </small>
            </span>
          </label>
        </div>

        <button
          className="analyze-btn"
          onClick={handleSubmit}
          disabled={files.length === 0}
        >
          Analyse {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : ''}
        </button>
      </div>
    </div>
  )
}
