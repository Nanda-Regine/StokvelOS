'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { getInitials } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Meeting, StokvelMember } from '@/types'

interface LogMeetingModalProps {
  open:      boolean
  onClose:   () => void
  onSaved:   (meeting: Meeting) => void
  stokvelId: string
  members:   StokvelMember[]
  editing?:  Meeting | null
}

export function LogMeetingModal({
  open,
  onClose,
  onSaved,
  stokvelId,
  members,
  editing,
}: LogMeetingModalProps) {
  const [saving,     setSaving]     = useState(false)
  const [title,      setTitle]      = useState('')
  const [date,       setDate]       = useState(new Date().toISOString().split('T')[0])
  const [location,   setLocation]   = useState('')
  const [attendees,  setAttendees]  = useState<string[]>([])
  const [rawNotes,   setRawNotes]   = useState('')

  useEffect(() => {
    if (!open) return
    if (editing) {
      setTitle(editing.title)
      setDate(editing.date)
      setLocation(editing.location || '')
      setAttendees(editing.attendees || [])
      setRawNotes(editing.raw_notes || '')
    } else {
      setTitle('')
      setDate(new Date().toISOString().split('T')[0])
      setLocation('')
      // Default: select all active members
      setAttendees(members.filter(m => m.status === 'active').map(m => m.id))
      setRawNotes('')
    }
  }, [open, editing, members])

  function toggleAttendee(id: string) {
    setAttendees(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function selectAll() {
    setAttendees(members.filter(m => m.status === 'active').map(m => m.id))
  }

  function clearAll() {
    setAttendees([])
  }

  async function handleSave() {
    if (!title.trim()) { toast.error('Please enter a meeting title.'); return }
    if (!date)          { toast.error('Please select a date.'); return }

    setSaving(true)
    try {
      const url    = editing ? `/api/meetings/${editing.id}` : '/api/meetings'
      const method = editing ? 'PATCH' : 'POST'
      const payload: Record<string, unknown> = { title, date, location, attendees, raw_notes: rawNotes }
      if (!editing) payload.stokvelId = stokvelId

      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }

      toast.success(editing ? 'Meeting updated!' : 'Meeting logged!')
      onSaved(json.meeting)
      onClose()
    } catch {
      toast.error('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const activeMembers = members.filter(m => m.status === 'active')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Meeting' : 'Log Meeting'}
      size="lg"
      footer={
        <>
          <Button variant="outline" size="md" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="md" onClick={handleSave} loading={saving}>
            {editing ? 'Save Changes' : 'Log Meeting'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Title */}
        <div className="form-group mb-0">
          <label className="form-label">Meeting title *</label>
          <input
            className="form-input"
            placeholder="e.g. Monthly Stokvel Meeting — March 2026"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus={!editing}
          />
        </div>

        {/* Date + Location */}
        <div className="form-row">
          <div className="form-group mb-0">
            <label className="form-label">Date *</label>
            <input
              className="form-input"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Location</label>
            <input
              className="form-input"
              placeholder="e.g. Zanele's home, Zoom link…"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>
        </div>

        {/* Attendees */}
        <div className="form-group mb-0">
          <div className="flex items-center justify-between mb-2">
            <label className="form-label mb-0">Attendees</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs font-mono hover:underline"
                style={{ color: '#ca8a04' }}
              >
                All
              </button>
              <span style={{ color: '#d1d5db' }}>·</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-mono hover:underline"
                style={{ color: '#9ca3af' }}
              >
                None
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
            {activeMembers.map(m => {
              const checked = attendees.includes(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleAttendee(m.id)}
                  className="flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all duration-150"
                  style={{
                    borderColor: checked ? '#ca8a04' : 'rgba(15,61,30,0.12)',
                    background:  checked ? 'rgba(202,138,4,0.06)' : 'white',
                  }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono flex-shrink-0"
                    style={{
                      background: checked ? '#ca8a04' : 'rgba(15,61,30,0.08)',
                      color:      checked ? '#0a2412' : '#9ca3af',
                    }}
                  >
                    {checked ? '✓' : getInitials(m.name)}
                  </div>
                  <span className="text-xs truncate" style={{ color: checked ? '#0a2412' : '#374151' }}>
                    {m.name.split(' ')[0]}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-xs mt-1.5 font-mono" style={{ color: '#9ca3af' }}>
            {attendees.length} of {activeMembers.length} selected
          </p>
        </div>

        {/* Raw notes */}
        <div className="form-group mb-0">
          <label className="form-label">Meeting notes</label>
          <textarea
            className="form-textarea"
            placeholder={`Type your rough notes here — AI will format them into professional minutes.\n\nExample:\n- Opened by Zanele\n- All 8 members present\n- Pot stands at R12,400\n- Thabo to receive payout next month R8,000\n- Nokwanda 2 months behind, agreed to catch up by April\n- Next meeting at Sipho's house`}
            rows={7}
            value={rawNotes}
            onChange={e => setRawNotes(e.target.value)}
            style={{ minHeight: '160px' }}
          />
          <p className="text-xs mt-1 font-mono" style={{ color: '#9ca3af' }}>
            💡 Type in any format — bullet points, sentences, shorthand. AI will clean it up.
          </p>
        </div>
      </div>
    </Modal>
  )
}
