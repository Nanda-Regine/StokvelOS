'use client'

import { useState } from 'react'
import { LogMeetingModal } from '@/components/meetings/LogMeetingModal'
import { MinutesViewer }   from '@/components/meetings/MinutesViewer'
import { Button }          from '@/components/ui/Button'
import { Badge }           from '@/components/ui/Badge'
import { formatDate, getInitials, truncate } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Meeting, StokvelMember, Stokvel } from '@/types'

interface MeetingsClientProps {
  stokvel:         Stokvel
  initialMeetings: Meeting[]
  members:         StokvelMember[]
}

export function MeetingsClient({ stokvel, initialMeetings, members }: MeetingsClientProps) {
  const [meetings,       setMeetings]       = useState<Meeting[]>(initialMeetings)
  const [logModalOpen,   setLogModalOpen]   = useState(false)
  const [viewerOpen,     setViewerOpen]     = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
  const [editingMeeting,  setEditingMeeting]  = useState<Meeting | null>(null)
  const [deleting,        setDeleting]        = useState<string | null>(null)

  function handleSaved(meeting: Meeting) {
    setMeetings(prev => {
      const idx = prev.findIndex(m => m.id === meeting.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = meeting
        return next
      }
      return [meeting, ...prev]
    })
  }

  function handleMinutesSaved(updated: Meeting) {
    setMeetings(prev => prev.map(m => m.id === updated.id ? updated : m))
    setSelectedMeeting(updated)
  }

  function openViewer(m: Meeting) {
    setSelectedMeeting(m)
    setViewerOpen(true)
  }

  function openEdit(m: Meeting) {
    setEditingMeeting(m)
    setLogModalOpen(true)
  }

  async function handleDelete(meeting: Meeting) {
    if (!confirm(`Delete "${meeting.title}"? This cannot be undone.`)) return
    setDeleting(meeting.id)
    try {
      const res  = await fetch(`/api/meetings/${meeting.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      setMeetings(prev => prev.filter(m => m.id !== meeting.id))
      toast.success('Meeting deleted.')
    } catch {
      toast.error('Failed to delete.')
    } finally {
      setDeleting(null)
    }
  }

  const totalAttendances = meetings.reduce((s, m) => s + (m.attendees?.length || 0), 0)
  const avgAttendance    = meetings.length ? Math.round(totalAttendances / meetings.length) : 0
  const withMinutes      = meetings.filter(m => m.formatted_minutes).length

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Meetings</h1>
          <p className="font-mono text-xs mt-1" style={{ color: '#9ca3af' }}>
            {meetings.length} meetings recorded
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => { setEditingMeeting(null); setLogModalOpen(true) }}
        >
          + Log Meeting
        </Button>
      </div>

      <div className="page-body space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Meetings',    value: meetings.length,   sub: 'on record',              color: '#0f3d1e' },
            { label: 'Avg Attendance',    value: avgAttendance,     sub: 'members per meeting',    color: '#ca8a04' },
            { label: 'With AI Minutes',   value: withMinutes,       sub: `of ${meetings.length} meetings`, color: '#16a34a' },
            { label: 'Active Members',    value: members.length,    sub: 'eligible to attend',     color: '#0f3d1e' },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl border p-4 bg-white"
              style={{ borderColor: 'rgba(15,61,30,0.1)', boxShadow: '0 1px 3px rgba(15,61,30,0.06)' }}>
              <div className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: '#9ca3af' }}>{s.label}</div>
              <div className="font-display text-3xl" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* AI info banner */}
        <div
          className="rounded-2xl p-5 flex items-start gap-4"
          style={{
            background:  'linear-gradient(135deg, rgba(15,61,30,0.96), rgba(10,36,18,0.98))',
            border:      '1px solid rgba(202,138,4,0.2)',
          }}
        >
          <div className="text-2xl flex-shrink-0">✨</div>
          <div>
            <p className="font-display text-base mb-1" style={{ color: '#fef9c3' }}>
              AI Meeting Minutes
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(254,249,195,0.65)' }}>
              Log a meeting with rough notes — bullet points, shorthand, any format. Click{' '}
              <strong style={{ color: '#ca8a04' }}>Generate Minutes</strong> and AI instantly formats them into
              professional minutes you can copy, download as .txt, or send via WhatsApp.
            </p>
          </div>
        </div>

        {/* Meetings list */}
        {meetings.length === 0 ? (
          <div className="card">
            <div className="empty-state py-16">
              <div className="empty-icon">📋</div>
              <div className="empty-title">No meetings recorded yet</div>
              <div className="empty-sub">
                Log your first meeting to start building your stokvel&apos;s record.
              </div>
              <button
                className="btn btn-primary btn-md mt-4"
                onClick={() => setLogModalOpen(true)}
              >
                + Log First Meeting
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {meetings.map((m, idx) => {
              const attendeeNames = (m.attendees || [])
                .slice(0, 5)
                .map(id => members.find(mb => mb.id === id))
                .filter(Boolean)
              const extraAttendees = (m.attendees?.length || 0) - 5
              const hasMinutes     = !!m.formatted_minutes
              const isRecent       = idx === 0

              return (
                <div
                  key={m.id}
                  className="card transition-all hover:-translate-y-0.5"
                  style={{
                    opacity:     deleting === m.id ? 0.5 : 1,
                    borderColor: isRecent ? 'rgba(202,138,4,0.2)' : 'rgba(15,61,30,0.1)',
                  }}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3
                            className="font-display text-base leading-tight cursor-pointer hover:underline"
                            style={{ color: '#0a2412' }}
                            onClick={() => openViewer(m)}
                          >
                            {m.title}
                          </h3>
                          {isRecent && (
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-mono"
                              style={{ background: 'rgba(202,138,4,0.1)', color: '#ca8a04' }}
                            >
                              Latest
                            </span>
                          )}
                          <Badge variant={hasMinutes ? 'success' : 'neutral'}>
                            {hasMinutes ? '✓ Minutes' : 'No minutes'}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 text-xs font-mono mb-2" style={{ color: '#9ca3af' }}>
                          <span>📅 {formatDate(m.date)}</span>
                          {m.location && <span>📍 {m.location}</span>}
                          <span>👥 {m.attendees?.length || 0} attended</span>
                        </div>

                        {m.ai_summary && (
                          <p className="text-sm leading-relaxed mb-3" style={{ color: '#6b7280' }}>
                            {truncate(m.ai_summary, 160)}
                          </p>
                        )}

                        {/* Attendee avatars */}
                        {attendeeNames.length > 0 && (
                          <div className="flex items-center gap-1">
                            {attendeeNames.map((mb, i) => mb && (
                              <div
                                key={i}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-medium -ml-1 first:ml-0 border-2 border-white"
                                style={{ background: 'rgba(15,61,30,0.1)', color: '#0f3d1e' }}
                                title={mb.name}
                              >
                                {getInitials(mb.name)}
                              </div>
                            ))}
                            {extraAttendees > 0 && (
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono -ml-1 border-2 border-white"
                                style={{ background: 'rgba(15,61,30,0.08)', color: '#9ca3af' }}
                              >
                                +{extraAttendees}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: actions */}
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => openViewer(m)}
                        >
                          {hasMinutes ? '📋 View Minutes' : '✨ Generate Minutes'}
                        </Button>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(m)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(m)}
                            disabled={deleting === m.id}
                            style={{ color: '#dc2626' }}
                          >
                            ✕
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <LogMeetingModal
        open={logModalOpen}
        onClose={() => { setLogModalOpen(false); setEditingMeeting(null) }}
        onSaved={handleSaved}
        stokvelId={stokvel.id}
        members={members}
        editing={editingMeeting}
      />

      {selectedMeeting && (
        <MinutesViewer
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
          meeting={selectedMeeting}
          members={members}
          stokvelName={stokvel.name}
          onMinutesSaved={handleMinutesSaved}
        />
      )}
    </>
  )
}
