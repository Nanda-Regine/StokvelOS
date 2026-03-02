'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatDate, buildWhatsAppUrl } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Stokvel, Announcement } from '@/types'

interface AnnouncementsClientProps {
  stokvel:                Stokvel
  initialAnnouncements:   Announcement[]
}

const TYPE_CONFIG = {
  info:    { emoji: 'ℹ️',  label: 'Info',    bg: 'rgba(59,130,246,0.05)',  border: 'rgba(59,130,246,0.15)',  badge: 'info'    },
  success: { emoji: '✅',  label: 'Good news', bg: 'rgba(22,163,74,0.05)', border: 'rgba(22,163,74,0.15)',  badge: 'success' },
  warning: { emoji: '⚠️', label: 'Important', bg: 'rgba(202,138,4,0.05)', border: 'rgba(202,138,4,0.15)', badge: 'warning' },
} as const

export function AnnouncementsClient({ stokvel, initialAnnouncements }: AnnouncementsClientProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements)
  const [modalOpen,     setModalOpen]     = useState(false)

  // Form state
  const [title,      setTitle]      = useState('')
  const [body,       setBody]       = useState('')
  const [type,       setType]       = useState<'info' | 'success' | 'warning'>('info')
  const [pinned,     setPinned]     = useState(false)
  const [saving,     setSaving]     = useState(false)

  function openNew() {
    setTitle(''); setBody(''); setType('info'); setPinned(false)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!title.trim()) { toast.error('Title is required.'); return }
    if (!body.trim() || body.trim().length < 10) { toast.error('Body must be at least 10 characters.'); return }
    setSaving(true)
    try {
      const res  = await fetch('/api/announcements', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ stokvelId: stokvel.id, title, body, type, pinned }),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      setAnnouncements(prev => [json.announcement, ...prev].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }))
      toast.success('Announcement posted! 📢')
      setModalOpen(false)
    } catch {
      toast.error('Failed to post.')
    } finally {
      setSaving(false)
    }
  }

  async function togglePin(ann: Announcement) {
    try {
      const res  = await fetch(`/api/announcements/${ann.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pinned: !ann.pinned }),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      setAnnouncements(prev => prev.map(a => a.id === ann.id ? { ...a, pinned: !a.pinned } : a)
        .sort((a, b) => {
          if (a.pinned && !b.pinned) return -1
          if (!a.pinned && b.pinned) return 1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        }))
    } catch { toast.error('Failed to update.') }
  }

  async function handleDelete(ann: Announcement) {
    if (!confirm(`Delete "${ann.title}"?`)) return
    try {
      const res  = await fetch(`/api/announcements/${ann.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      setAnnouncements(prev => prev.filter(a => a.id !== ann.id))
      toast.success('Announcement deleted.')
    } catch { toast.error('Failed to delete.') }
  }

  function shareWhatsApp(ann: Announcement) {
    const msg = `*${ann.title}*\n\n${ann.body}\n\n— ${stokvel.name}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Announcements</h1>
          <p className="font-mono text-xs mt-1" style={{ color: '#9ca3af' }}>
            {announcements.length} posted · {announcements.filter(a => a.pinned).length} pinned
          </p>
        </div>
        <Button variant="primary" size="md" onClick={openNew}>+ New Announcement</Button>
      </div>

      <div className="page-body space-y-4">
        {announcements.length === 0 ? (
          <div className="card">
            <div className="empty-state py-16">
              <div className="empty-icon">📢</div>
              <div className="empty-title">No announcements yet</div>
              <div className="empty-sub">Post important updates, reminders, or good news to your stokvel.</div>
              <button className="btn btn-primary btn-md mt-4" onClick={openNew}>+ Post First Announcement</button>
            </div>
          </div>
        ) : (
          announcements.map(ann => {
            const cfg = TYPE_CONFIG[ann.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.info
            return (
              <div
                key={ann.id}
                className="rounded-2xl border p-5 bg-white transition-all hover:-translate-y-0.5"
                style={{
                  borderColor:  ann.pinned ? 'rgba(202,138,4,0.25)' : cfg.border,
                  background:   ann.pinned ? 'rgba(202,138,4,0.02)' : cfg.bg,
                  boxShadow:    '0 1px 3px rgba(15,61,30,0.06)',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-2xl flex-shrink-0 mt-0.5">{cfg.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-display text-base" style={{ color: '#0a2412' }}>{ann.title}</h3>
                        {ann.pinned && (
                          <span className="font-mono text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(202,138,4,0.12)', color: '#92400e' }}>
                            📌 Pinned
                          </span>
                        )}
                        <Badge variant={cfg.badge as 'info' | 'success' | 'warning'}>{cfg.label}</Badge>
                      </div>
                      <p className="text-sm leading-relaxed mb-2" style={{ color: '#374151' }}>{ann.body}</p>
                      <p className="font-mono text-xs" style={{ color: '#9ca3af' }}>{formatDate(ann.created_at)}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => shareWhatsApp(ann)} title="Share via WhatsApp">
                      📲
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => togglePin(ann)} title={ann.pinned ? 'Unpin' : 'Pin'}>
                      {ann.pinned ? '📌' : '📍'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(ann)} style={{ color: '#dc2626' }} title="Delete">
                      ✕
                    </Button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* New announcement modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Announcement"
        size="md"
        footer={
          <>
            <Button variant="outline" size="md" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" size="md" onClick={handleSave} loading={saving}>Post Announcement</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="form-group mb-0">
            <label className="form-label">Title *</label>
            <input className="form-input" placeholder="e.g. Meeting this Saturday at 10am" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>

          <div className="form-group mb-0">
            <label className="form-label">Message *</label>
            <textarea
              className="form-textarea"
              placeholder="Write your announcement here…"
              rows={4}
              style={{ minHeight: '100px' }}
              value={body}
              onChange={e => setBody(e.target.value)}
            />
          </div>

          <div className="form-group mb-0">
            <label className="form-label">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(TYPE_CONFIG) as [string, typeof TYPE_CONFIG['info']][]).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key as 'info' | 'success' | 'warning')}
                  className="rounded-xl border py-2.5 text-center transition-all"
                  style={{
                    borderColor: type === key ? '#ca8a04' : 'rgba(15,61,30,0.12)',
                    background:  type === key ? 'rgba(202,138,4,0.06)' : 'white',
                  }}
                >
                  <div className="text-lg mb-0.5">{cfg.emoji}</div>
                  <div className="font-mono text-xs" style={{ color: type === key ? '#0a2412' : '#9ca3af' }}>{cfg.label}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPinned(v => !v)}
            className="flex items-center gap-2 text-sm"
            style={{ color: pinned ? '#0f3d1e' : '#9ca3af' }}
          >
            <div className="w-4 h-4 rounded border flex items-center justify-center transition-colors"
              style={{ background: pinned ? '#0f3d1e' : 'white', borderColor: pinned ? '#0f3d1e' : 'rgba(15,61,30,0.2)' }}>
              {pinned && <span style={{ color: '#fef9c3', fontSize: '0.6rem' }}>✓</span>}
            </div>
            Pin to top of announcements board
          </button>
        </div>
      </Modal>
    </>
  )
}
