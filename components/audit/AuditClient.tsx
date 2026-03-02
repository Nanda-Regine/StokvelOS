'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface AuditEntry {
  id:          string
  actor_name:  string
  action:      string
  target_type: string | null
  details:     Record<string, unknown>
  created_at:  string
}

const ACTION_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  'member.create':          { emoji: '👤', label: 'Member added',       color: '#16a34a' },
  'member.update':          { emoji: '✏️', label: 'Member edited',      color: '#0f3d1e' },
  'member.remove':          { emoji: '🚫', label: 'Member removed',     color: '#dc2626' },
  'contribution.create':    { emoji: '💰', label: 'Payment recorded',   color: '#16a34a' },
  'contribution.update':    { emoji: '✏️', label: 'Payment updated',    color: '#ca8a04' },
  'contribution.delete':    { emoji: '🗑️', label: 'Payment deleted',    color: '#dc2626' },
  'contribution.bulk':      { emoji: '💳', label: 'Bulk payments',      color: '#16a34a' },
  'payout.create':          { emoji: '💸', label: 'Payout recorded',    color: '#ca8a04' },
  'payout.update':          { emoji: '✏️', label: 'Payout updated',     color: '#ca8a04' },
  'meeting.create':         { emoji: '📋', label: 'Meeting logged',     color: '#0f3d1e' },
  'meeting.delete':         { emoji: '🗑️', label: 'Meeting deleted',    color: '#dc2626' },
  'meeting.minutes_generated': { emoji: '✨', label: 'AI Minutes',      color: '#7c3aed' },
  'ai.health_report':       { emoji: '🤖', label: 'AI Health Report',   color: '#7c3aed' },
  'ai.reminders_generated': { emoji: '📲', label: 'AI Reminders',       color: '#7c3aed' },
  'ai.constitution_generated': { emoji: '📜', label: 'AI Constitution', color: '#7c3aed' },
  'stokvel.update':         { emoji: '⚙️', label: 'Settings updated',  color: '#6b7280' },
  'announcement.create':    { emoji: '📢', label: 'Announcement posted',color: '#0f3d1e' },
  'announcement.delete':    { emoji: '🗑️', label: 'Announcement deleted',color: '#dc2626' },
  'subscription.activate':  { emoji: '⭐', label: 'Plan upgraded',      color: '#ca8a04' },
}

function getActionConfig(action: string) {
  return ACTION_CONFIG[action] || { emoji: '◎', label: action, color: '#9ca3af' }
}

interface AuditClientProps {
  stokvelId:      string
  initialEntries: AuditEntry[]
  total:          number
}

export function AuditClient({ stokvelId, initialEntries, total }: AuditClientProps) {
  const [entries,   setEntries]   = useState<AuditEntry[]>(initialEntries)
  const [page,      setPage]      = useState(1)
  const [loading,   setLoading]   = useState(false)
  const [filter,    setFilter]    = useState('')
  const pageSize = 50

  async function loadMore() {
    setLoading(true)
    try {
      const next = page + 1
      const res  = await fetch(`/api/audit-log?stokvelId=${stokvelId}&page=${next}&pageSize=${pageSize}`)
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      setEntries(prev => [...prev, ...(json.entries || [])])
      setPage(next)
    } catch {
      toast.error('Failed to load more.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = filter
    ? entries.filter(e =>
        e.action.includes(filter) ||
        e.actor_name.toLowerCase().includes(filter.toLowerCase()) ||
        JSON.stringify(e.details).toLowerCase().includes(filter.toLowerCase())
      )
    : entries

  const hasMore = entries.length < total

  // Group by date
  const grouped = filtered.reduce<Record<string, AuditEntry[]>>((acc, entry) => {
    const day = new Date(entry.created_at).toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    if (!acc[day]) acc[day] = []
    acc[day].push(entry)
    return acc
  }, {})

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="font-mono text-xs mt-1" style={{ color: '#9ca3af' }}>
            {total} total activities recorded
          </p>
        </div>
      </div>

      <div className="page-body space-y-5">
        {/* Search */}
        <input
          type="text"
          className="form-input"
          placeholder="Filter by action, person, or details…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ maxWidth: '360px' }}
        />

        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state py-16">
              <div className="empty-icon">🔍</div>
              <div className="empty-title">No activity yet</div>
              <div className="empty-sub">All admin actions will appear here once you start using StokvelOS.</div>
            </div>
          </div>
        ) : (
          Object.entries(grouped).map(([day, dayEntries]) => (
            <div key={day}>
              <div className="font-mono text-xs uppercase tracking-wider mb-3 px-1" style={{ color: '#9ca3af' }}>
                {day}
              </div>
              <div className="space-y-2">
                {dayEntries.map(entry => {
                  const cfg = getActionConfig(entry.action)
                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 rounded-xl border bg-white p-3.5"
                      style={{ borderColor: 'rgba(15,61,30,0.08)' }}
                    >
                      {/* Icon */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
                        style={{ background: `${cfg.color}14` }}
                      >
                        {cfg.emoji}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium" style={{ color: '#0a2412' }}>
                            {cfg.label}
                          </span>
                          {entry.details && Object.keys(entry.details).length > 0 && (
                            <span className="text-xs" style={{ color: '#6b7280' }}>
                              {entry.details.memberName ? `· ${entry.details.memberName}` : ''}
                              {entry.details.amount ? ` · R${Number(entry.details.amount).toFixed(2)}` : ''}
                              {entry.details.count ? ` · ${entry.details.count} records` : ''}
                              {entry.details.name ? ` · ${entry.details.name}` : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="font-mono text-xs" style={{ color: '#9ca3af' }}>
                            by {entry.actor_name}
                          </span>
                          <span className="font-mono text-xs" style={{ color: '#d1d5db' }}>·</span>
                          <span className="font-mono text-xs" style={{ color: '#9ca3af' }}>
                            {new Date(entry.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* Action tag */}
                      <span
                        className="font-mono text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: `${cfg.color}12`, color: cfg.color }}
                      >
                        {entry.action.split('.')[0]}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}

        {hasMore && (
          <div className="flex justify-center">
            <Button variant="outline" size="md" onClick={loadMore} loading={loading}>
              Load more ({total - entries.length} remaining)
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
