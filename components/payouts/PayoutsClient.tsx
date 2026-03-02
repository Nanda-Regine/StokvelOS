'use client'

import { useState } from 'react'
import { RecordPayoutModal } from '@/components/payouts/RecordPayoutModal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatCurrencyShort, formatDate, getInitials } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { StokvelMember, Stokvel, Payout } from '@/types'

type FullPayout = Payout & { stokvel_members?: { name: string; payout_position: number | null } | null }

interface PayoutsClientProps {
  stokvel:        Stokvel
  initialPayouts: FullPayout[]
  members:        StokvelMember[]
  potTotal:       number
  totalPaidOut:   number
}

export function PayoutsClient({ stokvel, initialPayouts, members, potTotal, totalPaidOut }: PayoutsClientProps) {
  const [payouts,     setPayouts]     = useState<FullPayout[]>(initialPayouts)
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editingPayout, setEditingPayout] = useState<Payout | null>(null)
  const [deleting,    setDeleting]    = useState<string | null>(null)

  const paidOutIds   = new Set(payouts.filter(p => p.status === 'paid').map(p => p.member_id))
  const nextInLine   = members.find(m => !paidOutIds.has(m.id))
  const balance      = potTotal - totalPaidOut

  function handleSaved(payout: Payout) {
    setPayouts(prev => {
      const idx = prev.findIndex(p => p.id === payout.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = payout as FullPayout; return next }
      return [payout as FullPayout, ...prev]
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this payout record?')) return
    setDeleting(id)
    try {
      const res  = await fetch(`/api/payouts/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      setPayouts(prev => prev.filter(p => p.id !== id))
      toast.success('Payout deleted.')
    } catch {
      toast.error('Failed to delete.')
    } finally {
      setDeleting(null) }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Payouts</h1>
          <p className="font-mono text-xs mt-1" style={{ color: '#9ca3af' }}>
            {payouts.filter(p => p.status === 'paid').length} paid · {members.length - paidOutIds.size} remaining
          </p>
        </div>
        <Button variant="gold" size="md" onClick={() => { setEditingPayout(null); setModalOpen(true) }}>
          + Record Payout
        </Button>
      </div>

      <div className="page-body space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Pot',     value: formatCurrencyShort(potTotal),     sub: 'All confirmed contributions', color: '#0f3d1e' },
            { label: 'Paid Out',      value: formatCurrencyShort(totalPaidOut), sub: `${paidOutIds.size} members`,  color: '#ca8a04' },
            { label: 'Balance',       value: formatCurrencyShort(balance),      sub: 'Remaining in pot',           color: balance >= 0 ? '#16a34a' : '#dc2626' },
            { label: 'Next Payout',   value: nextInLine?.name.split(' ')[0] || '—', sub: nextInLine ? `Position #${nextInLine.payout_position || '?'}` : 'All done!', color: '#0f3d1e' },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl border p-4 bg-white" style={{ borderColor: 'rgba(15,61,30,0.1)', boxShadow: '0 1px 3px rgba(15,61,30,0.06)' }}>
              <div className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: '#9ca3af' }}>{s.label}</div>
              <div className="font-display text-2xl leading-tight" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Payout queue */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Payout Queue</span>
            <Badge variant="info">{stokvel.payout_frequency} · {stokvel.payout_order}</Badge>
          </div>
          <div className="p-5">
            <div className="space-y-2">
              {members.map((m, i) => {
                const hasPayout = paidOutIds.has(m.id)
                const payout    = payouts.find(p => p.member_id === m.id && p.status === 'paid')
                const isNext    = !hasPayout && m.id === nextInLine?.id

                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-xl p-3 transition-all"
                    style={{
                      background:  isNext ? 'rgba(202,138,4,0.06)' : hasPayout ? 'rgba(22,163,74,0.04)' : 'rgba(248,250,248,0.5)',
                      border:      `1px solid ${isNext ? 'rgba(202,138,4,0.2)' : hasPayout ? 'rgba(22,163,74,0.15)' : 'rgba(15,61,30,0.06)'}`,
                    }}
                  >
                    {/* Position */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold flex-shrink-0"
                      style={{
                        background: isNext ? '#ca8a04' : hasPayout ? '#16a34a' : 'rgba(15,61,30,0.08)',
                        color:      isNext ? '#0a2412' : hasPayout ? 'white' : '#9ca3af',
                      }}
                    >
                      {hasPayout ? '✓' : isNext ? '→' : m.payout_position || i + 1}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium" style={{ color: hasPayout ? '#6b7280' : '#0a2412' }}>
                        {m.name}
                      </span>
                      {payout && (
                        <span className="font-mono text-xs ml-2" style={{ color: '#9ca3af' }}>
                          {formatCurrency(payout.amount)} · {formatDate(payout.date)}
                        </span>
                      )}
                    </div>

                    {/* Status / action */}
                    {hasPayout ? (
                      <Badge variant="success">Paid out</Badge>
                    ) : isNext ? (
                      <Button
                        variant="gold"
                        size="sm"
                        onClick={() => { setEditingPayout(null); setModalOpen(true) }}
                      >
                        Record →
                      </Button>
                    ) : (
                      <Badge variant="neutral">Waiting</Badge>
                    )}
                  </div>
                )
              })}

              {members.length === 0 && (
                <div className="empty-state py-8">
                  <div className="empty-icon">💸</div>
                  <div className="empty-title">No members yet</div>
                  <div className="empty-sub">Add members and assign payout positions to build the queue.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payout history */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Payout History</span>
          </div>
          <div className="table-wrap">
            {payouts.length === 0 ? (
              <div className="empty-state py-10">
                <div className="empty-sub">No payouts recorded yet.</div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th className="text-right">Amount</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {payouts.map(p => (
                    <tr key={p.id} style={{ opacity: deleting === p.id ? 0.4 : 1 }}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-medium flex-shrink-0"
                            style={{ background: 'rgba(202,138,4,0.1)', color: '#ca8a04' }}>
                            {getInitials(p.stokvel_members?.name || '?')}
                          </div>
                          <span className="font-medium text-sm">{p.stokvel_members?.name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="text-right font-mono font-medium" style={{ color: '#ca8a04' }}>
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="font-mono text-xs">{formatDate(p.date)}</td>
                      <td>
                        <Badge variant={p.status === 'paid' ? 'success' : p.status === 'scheduled' ? 'warning' : 'neutral'}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="text-xs truncate max-w-xs" style={{ color: '#9ca3af' }}>{p.notes || '—'}</td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn btn-ghost btn-sm px-2" onClick={() => { setEditingPayout(p); setModalOpen(true) }}>Edit</button>
                          <button className="btn btn-ghost btn-sm w-8 h-8 p-0" onClick={() => handleDelete(p.id)} style={{ color: '#dc2626' }}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <RecordPayoutModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingPayout(null) }}
        onSaved={handleSaved}
        stokvelId={stokvel.id}
        members={members}
        potTotal={potTotal}
        editing={editingPayout}
      />
    </>
  )
}
