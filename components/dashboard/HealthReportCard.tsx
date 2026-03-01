'use client'

import { useState, useEffect } from 'react'

interface HealthReportCardProps {
  stokvelId: string
}

export function HealthReportCard({ stokvelId }: HealthReportCardProps) {
  const [report,  setReport]  = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [cached,  setCached]  = useState(false)

  async function fetchReport(force = false) {
    setLoading(true)
    try {
      const res  = await fetch('/api/ai/health-report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ stokvelId, force }),
      })
      const json = await res.json()
      if (json.report) {
        setReport(json.report)
        setCached(json.cached)
      } else {
        setReport(null)
      }
    } catch {
      setReport(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReport() }, [stokvelId])

  return (
    <div className="ai-card">
      <div className="flex items-center justify-between mb-3">
        <div className="ai-card-label">📊 Monthly Stokvel Health Report</div>
        {cached && (
          <span
            className="font-mono text-xs"
            style={{ color: 'rgba(202,138,4,0.5)' }}
          >
            Cached this month
          </span>
        )}
      </div>

      <div className="ai-card-text">
        {loading ? (
          <div className="flex items-center gap-2">
            <span className="ai-dot" />
            <span className="ai-dot" />
            <span className="ai-dot" />
            <span className="font-mono text-xs ml-2" style={{ color: 'rgba(254,249,195,0.5)' }}>
              Generating your health report…
            </span>
          </div>
        ) : report ? (
          <p className="leading-relaxed">{report}</p>
        ) : (
          <p style={{ color: 'rgba(254,249,195,0.4)' }}>
            Add members and record contributions to generate your first health report.
          </p>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => fetchReport(true)}
          disabled={loading}
          className="btn btn-sm"
          style={{
            background: 'rgba(202,138,4,0.15)',
            color:      '#ca8a04',
            border:     '1px solid rgba(202,138,4,0.25)',
          }}
        >
          {loading ? 'Generating…' : '↻ Refresh Report'}
        </button>
      </div>
    </div>
  )
}
