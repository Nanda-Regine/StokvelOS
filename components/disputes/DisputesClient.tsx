'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/Badge'
import type { Stokvel, DisputeState } from '@/types'

interface Member { id: string; name: string; phone: string | null }

interface Dispute {
  id: string
  complainant_id: string
  subject: string
  state: DisputeState
  resolution: string | null
  notes: string | null
  created_at: string
  updated_at: string
  stokvel_members?: Member
}

interface DisputesClientProps {
  stokvel:          Stokvel
  initialDisputes:  Dispute[]
}

const STATE_VARIANT: Record<DisputeState, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  open:                          'danger',
  investigating:                 'warning',
  awaiting_complainant_proof:    'warning',
  awaiting_respondent_proof:     'warning',
  reviewing:                     'info',
  resolved:                      'success',
  escalated:                     'danger',
}

const STATE_LABEL: Record<DisputeState, string> = {
  open:                          'Open',
  investigating:                 'Investigating',
  awaiting_complainant_proof:    'Awaiting Proof',
  awaiting_respondent_proof:     'Awaiting Proof',
  reviewing:                     'Reviewing',
  resolved:                      'Resolved',
  escalated:                     'Escalated',
}

const ALL_STATES: DisputeState[] = ['open', 'investigating', 'reviewing', 'resolved', 'escalated']

export function DisputesClient({ stokvel, initialDisputes }: DisputesClientProps) {
  const [filter,    setFilter]    = useState<DisputeState | 'all'>('all')
  const [expanded,  setExpanded]  = useState<string | null>(null)

  const disputes = initialDisputes

  const open        = disputes.filter(d => d.state === 'open').length
  const active      = disputes.filter(d => ['investigating', 'awaiting_complainant_proof', 'awaiting_respondent_proof', 'reviewing'].includes(d.state)).length
  const resolved    = disputes.filter(d => d.state === 'resolved').length
  const escalated   = disputes.filter(d => d.state === 'escalated').length

  const filtered = useMemo(
    () => filter === 'all' ? disputes : disputes.filter(d => d.state === filter),
    [disputes, filter]
  )

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Disputes</h1>
          <p className="page-subtitle">{stokvel.name} · mediated via WhatsApp AI agent</p>
        </div>
        <div style={{
          padding: '6px 14px',
          borderRadius: '8px',
          background: 'rgba(202,138,4,0.08)',
          border: '1px solid rgba(202,138,4,0.2)',
          fontSize: '0.72rem',
          fontFamily: 'var(--font-mono)',
          color: 'rgba(254,249,195,0.5)',
        }}>
          Members file disputes via WhatsApp
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        {[
          { label: 'Open',       value: open,     color: '#dc2626' },
          { label: 'In Progress',value: active,   color: '#f59e0b' },
          { label: 'Resolved',   value: resolved,  color: '#16a34a' },
          { label: 'Escalated',  value: escalated, color: '#7c3aed' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color, fontSize: '1.8rem' }}>{s.value}</div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl" style={{ background: s.color }} />
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap mb-4">
        {(['all', ...ALL_STATES] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding:    '4px 14px',
              borderRadius: '20px',
              fontSize:   '0.75rem',
              fontFamily: 'var(--font-mono)',
              cursor:     'pointer',
              border:     filter === s ? '1px solid #ca8a04' : '1px solid rgba(255,255,255,0.1)',
              background: filter === s ? 'rgba(202,138,4,0.12)' : 'transparent',
              color:      filter === s ? '#fef9c3' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.15s',
            }}
          >
            {s === 'all' ? `All (${disputes.length})` : s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
            {disputes.length === 0 ? 'No disputes — all members are getting along!' : 'No disputes match this filter'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Subject', 'Complainant', 'State', 'Opened', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((dispute, i) => {
                const isExpanded = expanded === dispute.id
                return (
                  <>
                    <tr
                      key={dispute.id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      className="hover:bg-white/[0.02]"
                      onClick={() => setExpanded(isExpanded ? null : dispute.id)}
                    >
                      <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#fef9c3', fontFamily: 'var(--font-body)', maxWidth: '240px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {dispute.subject}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-body)' }}>
                        {dispute.stokvel_members?.name ?? '—'}
                        {dispute.stokvel_members?.phone && (
                          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>
                            {dispute.stokvel_members.phone}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge variant={STATE_VARIANT[dispute.state]}>
                          {STATE_LABEL[dispute.state]}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>
                        {fmt(dispute.created_at)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)' }}>
                        {isExpanded ? '▲' : '▼'}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${dispute.id}-detail`} style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <td colSpan={5} style={{ padding: '0 16px 16px 16px' }}>
                          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '14px', marginTop: '4px' }}>
                            {dispute.notes && (
                              <div style={{ marginBottom: '10px' }}>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Notes</div>
                                <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>{dispute.notes}</div>
                              </div>
                            )}
                            {dispute.resolution && (
                              <div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Resolution</div>
                                <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>{dispute.resolution}</div>
                              </div>
                            )}
                            {!dispute.notes && !dispute.resolution && (
                              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)' }}>
                                Dispute is being mediated via WhatsApp. Conversation history is stored in the database.
                              </div>
                            )}
                            <div style={{ marginTop: '10px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)' }}>
                              Last updated: {fmt(dispute.updated_at)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
