'use client'
// app/dashboard/DashboardClient.tsx  (REPLACE Batch 2 — adds announcements widget)

import { useState } from 'react'
import { StatCards }       from '@/components/dashboard/StatCards'
import { HealthReportCard } from '@/components/dashboard/HealthReportCard'
import { RemindersModal }   from '@/components/shared/RemindersModal'
import { BulkPaymentModal } from '@/components/contributions/BulkPaymentModal'
import { Button }           from '@/components/ui/Button'
import { Badge }            from '@/components/ui/Badge'
import {
  formatCurrency, formatDate, getInitials, buildWhatsAppUrl,
} from '@/lib/utils'
import Link from 'next/link'
import type { Stokvel, StokvelMember, Contribution, Announcement } from '@/types'

interface DashboardClientProps {
  stokvel:        Stokvel
  stats:          {
    potTotal:         number
    memberCount:      number
    paidThisMonth:    number
    totalThisMonth:   number
    complianceRate:   number
    outstandingCount: number
    yearlyTarget:     number
    yearlyCollected:  number
    nextPayout:       StokvelMember | null
  }
  recentContribs:   Contribution[]
  activeMembers:    StokvelMember[]
  announcements:    Announcement[]
  healthReport?:    string
}

export function DashboardClient({
  stokvel,
  stats,
  recentContribs,
  activeMembers,
  announcements,
  healthReport,
}: DashboardClientProps) {
  const [remindersOpen,  setRemindersOpen]  = useState(false)
  const [bulkModalOpen,  setBulkModalOpen]  = useState(false)

  const outstandingMembers = activeMembers.filter(m => {
    const now      = new Date()
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    return !recentContribs.some(c => c.member_id === m.id && c.status === 'confirmed' && c.date >= monthStr)
  })

  const outstandingIds = new Set(outstandingMembers.map(m => m.id))

  const pinnedAnnouncements  = announcements.filter(a => a.pinned)
  const recentAnnouncements  = announcements.filter(a => !a.pinned).slice(0, 3)
  const displayAnnouncements = [...pinnedAnnouncements, ...recentAnnouncements].slice(0, 4)

  const TYPE_EMOJI: Record<string, string> = { info: 'ℹ️', success: '✅', warning: '⚠️' }

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="font-mono text-xs mt-1" style={{ color: '#9ca3af' }}>
            {stokvel.name}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {outstandingMembers.length > 0 && (
            <Button variant="outline" size="md" onClick={() => setRemindersOpen(true)}>
              📲 Send Reminders ({outstandingMembers.length})
            </Button>
          )}
          <Button variant="gold" size="md" onClick={() => setBulkModalOpen(true)}>
            ⚡ Bulk Record
          </Button>
          <Link href="/contributions">
            <Button variant="primary" size="md">+ Record Payment</Button>
          </Link>
        </div>
      </div>

      <div className="page-body space-y-5">

        {/* Stat cards */}
        <StatCards stats={stats} stokvel={stokvel} />

        {/* AI Health Report */}
        <HealthReportCard
          stokvelId={stokvel.id}
        />

        {/* Announcements widget */}
        {displayAnnouncements.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">📢 Announcements</span>
              <Link href="/announcements">
                <button className="font-mono text-xs hover:underline" style={{ color: '#ca8a04' }}>
                  View all →
                </button>
              </Link>
            </div>
            <div className="card-body space-y-3">
              {displayAnnouncements.map(ann => (
                <div
                  key={ann.id}
                  className="flex items-start gap-3 rounded-xl p-3"
                  style={{
                    background:   ann.pinned ? 'rgba(202,138,4,0.04)' : 'rgba(248,250,248,0.6)',
                    border:       `1px solid ${ann.pinned ? 'rgba(202,138,4,0.15)' : 'rgba(15,61,30,0.07)'}`,
                  }}
                >
                  <span className="text-lg flex-shrink-0">{TYPE_EMOJI[ann.type] || 'ℹ️'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-sm font-medium truncate" style={{ color: '#0a2412' }}>{ann.title}</span>
                      {ann.pinned && (
                        <span className="font-mono text-xs" style={{ color: '#ca8a04' }}>📌</span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed line-clamp-2" style={{ color: '#6b7280' }}>{ann.body}</p>
                  </div>
                  <span className="font-mono text-xs flex-shrink-0" style={{ color: '#d1d5db' }}>
                    {formatDate(ann.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Two-column: outstanding + recent */}
        <div className="grid md:grid-cols-2 gap-5">

          {/* Outstanding members */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Outstanding This Month</span>
              <Badge variant={outstandingMembers.length === 0 ? 'success' : 'danger'}>
                {outstandingMembers.length === 0 ? 'All paid ✓' : `${outstandingMembers.length} unpaid`}
              </Badge>
            </div>
            <div className="card-body">
              {outstandingMembers.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">🎉</div>
                  <p className="text-sm font-display" style={{ color: '#16a34a' }}>Everyone has paid this month!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {outstandingMembers.slice(0, 6).map(m => (
                    <div key={m.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono flex-shrink-0"
                          style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>
                          {getInitials(m.name)}
                        </div>
                        <span className="text-sm truncate">{m.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="font-mono text-xs" style={{ color: '#9ca3af' }}>
                          {formatCurrency(m.monthly_amount || stokvel.monthly_amount)}
                        </span>
                        {m.phone && (
                          <a
                            href={buildWhatsAppUrl(m.phone, `Hi ${m.name.split(' ')[0]}, just a reminder your ${stokvel.name} contribution of ${formatCurrency(m.monthly_amount || stokvel.monthly_amount)} is due. 🙏`)}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs" style={{ color: '#25d366' }} title="WhatsApp"
                          >
                            📲
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  {outstandingMembers.length > 6 && (
                    <p className="font-mono text-xs text-center pt-1" style={{ color: '#9ca3af' }}>
                      +{outstandingMembers.length - 6} more
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Recent contributions */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Payments</span>
              <Link href="/contributions">
                <button className="font-mono text-xs hover:underline" style={{ color: '#ca8a04' }}>View all →</button>
              </Link>
            </div>
            <div className="card-body">
              {recentContribs.length === 0 ? (
                <div className="empty-state py-6">
                  <div className="empty-sub">No payments recorded yet.</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentContribs.slice(0, 8).map(c => {
                    const member = activeMembers.find(m => m.id === c.member_id)
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono flex-shrink-0"
                            style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                            {getInitials(member?.name || '?')}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate">{member?.name || 'Unknown'}</div>
                            <div className="font-mono text-xs" style={{ color: '#9ca3af' }}>{formatDate(c.date)}</div>
                          </div>
                        </div>
                        <span className="font-mono text-sm font-medium flex-shrink-0" style={{ color: '#16a34a' }}>
                          {formatCurrency(c.amount)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Next payout callout */}
        {stats.nextPayout && (
          <div
            className="rounded-2xl p-5 flex items-center justify-between gap-4"
            style={{
              background: 'linear-gradient(135deg, rgba(202,138,4,0.08), rgba(202,138,4,0.04))',
              border:     '1px solid rgba(202,138,4,0.2)',
            }}
          >
            <div>
              <p className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: '#9ca3af' }}>Next Payout</p>
              <p className="font-display text-xl" style={{ color: '#0a2412' }}>{stats.nextPayout.name}</p>
              <p className="font-mono text-sm mt-0.5" style={{ color: '#ca8a04' }}>
                Position #{stats.nextPayout.payout_position} · {formatCurrency(stats.potTotal)} pot
              </p>
            </div>
            <Link href="/payouts">
              <Button variant="gold" size="md">Record Payout →</Button>
            </Link>
          </div>
        )}
      </div>

      <RemindersModal
        open={remindersOpen}
        onClose={() => setRemindersOpen(false)}
        stokvelId={stokvel.id}
        outstandingMembers={outstandingMembers.map(m => ({
          id:     m.id,
          name:   m.name,
          phone:  m.phone || '',
          amount: m.monthly_amount || stokvel.monthly_amount,
        }))}
      />

      <BulkPaymentModal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        onSaved={() => window.location.reload()}
        stokvelId={stokvel.id}
        members={activeMembers}
        defaultAmount={stokvel.monthly_amount}
        outstandingIds={outstandingIds}
      />
    </>
  )
}
