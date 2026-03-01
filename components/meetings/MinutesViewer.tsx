'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Meeting, StokvelMember } from '@/types'

interface MinutesViewerProps {
  open:        boolean
  onClose:     () => void
  meeting:     Meeting
  members:     StokvelMember[]
  stokvelName: string
  onMinutesSaved: (meeting: Meeting) => void
}

export function MinutesViewer({
  open,
  onClose,
  meeting,
  members,
  stokvelName,
  onMinutesSaved,
}: MinutesViewerProps) {
  const [generating, setGenerating] = useState(false)
  const [minutes,    setMinutes]    = useState(meeting.formatted_minutes || '')
  const [tab,        setTab]        = useState<'minutes' | 'raw'>('minutes')

  const attendeeNames = (meeting.attendees || [])
    .map(id => members.find(m => m.id === id)?.name)
    .filter(Boolean)

  async function generateMinutes() {
    if (!meeting.raw_notes?.trim()) {
      toast.error('Please add meeting notes first.')
      return
    }
    setGenerating(true)
    try {
      const res  = await fetch('/api/ai/meeting-minutes', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          meetingId:      meeting.id,
          stokvelName,
          meetingTitle:   meeting.title,
          date:           formatDate(meeting.date),
          location:       meeting.location,
          attendeeNames,
          rawNotes:       meeting.raw_notes,
        }),
      })
      const json = await res.json()
      if (json.error) { toast.error('AI unavailable. Please try again.'); return }

      setMinutes(json.minutes)
      setTab('minutes')
      onMinutesSaved({ ...meeting, formatted_minutes: json.minutes, ai_summary: json.summary })
      toast.success('Minutes generated! 📋')
    } catch {
      toast.error('Failed to generate minutes.')
    } finally {
      setGenerating(false)
    }
  }

  function copyMinutes() {
    navigator.clipboard.writeText(minutes)
    toast.success('Copied to clipboard!')
  }

  function shareWhatsApp() {
    const text = `*${meeting.title}*\n${formatDate(meeting.date)}\n\n${minutes}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  function downloadTxt() {
    const blob = new Blob([minutes], { type: 'text/plain' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `${meeting.title.replace(/\s+/g, '_')}_minutes.txt`
    a.click()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={meeting.title}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center gap-2 w-full">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          <div className="flex gap-2 ml-auto">
            {minutes && (
              <>
                <Button variant="ghost" size="sm" onClick={copyMinutes}>
                  📋 Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={downloadTxt}>
                  ↓ .txt
                </Button>
                <Button variant="gold" size="sm" onClick={shareWhatsApp}>
                  📲 WhatsApp
                </Button>
              </>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={generateMinutes}
              loading={generating}
            >
              {minutes ? '↻ Regenerate' : '✨ Generate Minutes'}
            </Button>
          </div>
        </div>
      }
    >
      {/* Meeting meta */}
      <div
        className="flex flex-wrap gap-4 mb-4 pb-4 text-xs font-mono"
        style={{ borderBottom: '1px solid rgba(15,61,30,0.08)', color: '#9ca3af' }}
      >
        <span>📅 {formatDate(meeting.date)}</span>
        {meeting.location && <span>📍 {meeting.location}</span>}
        <span>👥 {attendeeNames.length || 0} attendees</span>
        {meeting.ai_summary && (
          <span
            className="w-full text-xs leading-relaxed italic"
            style={{ color: '#6b7280', fontFamily: 'var(--font-body)', letterSpacing: 0 }}
          >
            {meeting.ai_summary}
          </span>
        )}
      </div>

      {/* Tabs */}
      {meeting.raw_notes && (
        <div className="flex gap-1 mb-4">
          {(['minutes', 'raw'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-lg text-xs font-mono transition-colors"
              style={{
                background: tab === t ? '#0f3d1e' : 'rgba(15,61,30,0.05)',
                color:      tab === t ? '#fef9c3' : '#6b7280',
              }}
            >
              {t === 'minutes' ? '📋 Formatted Minutes' : '📝 Raw Notes'}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div
        className="rounded-xl p-4 text-sm leading-relaxed overflow-y-auto"
        style={{
          background:    'rgba(248,250,248,0.8)',
          border:        '1px solid rgba(15,61,30,0.08)',
          minHeight:     '280px',
          maxHeight:     '420px',
          fontFamily:    tab === 'raw' ? 'var(--font-mono)' : 'var(--font-body)',
          fontSize:      tab === 'raw' ? '0.78rem' : '0.875rem',
          whiteSpace:    'pre-wrap',
          color:         '#374151',
        }}
      >
        {tab === 'minutes' ? (
          minutes ? (
            minutes
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <div className="text-3xl mb-3">📋</div>
              <p className="font-display text-base mb-1" style={{ color: '#0a2412' }}>
                No minutes yet
              </p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                {meeting.raw_notes
                  ? 'Click "Generate Minutes" to use AI to format your notes.'
                  : 'Add meeting notes first, then generate minutes.'}
              </p>
              {meeting.raw_notes && (
                <button
                  onClick={generateMinutes}
                  className="btn btn-gold btn-sm mt-4"
                  disabled={generating}
                >
                  {generating ? (
                    <span className="flex items-center gap-1.5">
                      <span className="ai-dot" style={{ background: '#0a2412' }} />
                      <span className="ai-dot" style={{ background: '#0a2412' }} />
                      <span className="ai-dot" style={{ background: '#0a2412' }} />
                      Generating…
                    </span>
                  ) : '✨ Generate Minutes'}
                </button>
              )}
            </div>
          )
        ) : (
          meeting.raw_notes || <span style={{ color: '#9ca3af' }}>No notes recorded.</span>
        )}
      </div>

      {/* Attendees list */}
      {attendeeNames.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-xs uppercase tracking-wider mb-2" style={{ color: '#9ca3af' }}>
            In Attendance
          </p>
          <div className="flex flex-wrap gap-2">
            {attendeeNames.map((name, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-full text-xs font-mono"
                style={{ background: 'rgba(15,61,30,0.06)', color: '#0f3d1e' }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
