'use client'

import { useState } from 'react'
import Link from 'next/link'
import { StatCards } from '@/components/dashboard/StatCards'
import { HealthReportCard } from '@/components/dashboard/HealthReportCard'
import { RemindersModal } from '@/components/dashboard/RemindersModal'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDateShort, formatDate, getPaymentStatusVariant, getInitials } from '@/lib/utils'
import type { Contribution, StokvelMember, Stokvel, DashboardStats } from '@/types'

interface DashboardClientProps {
  stokvel:            Stokvel
  members:            StokvelMember[]
  contributions:      Contribution[]
  stats:              DashboardStats
  outstandingMembers: { id: string; name: string; amount: number; phone?: string | null; status: string }[]
  paidIds:            string[]
}

export function DashboardClient({
  stokvel,
  members,
  contributions,
  stats,
  outstandingMembers,
  paidIds,
}: DashboardClientProps) {
  const [remindersOpen, setRemindersOpen] = useState(false)

  const recentContribs = contributions.slice(0, 6)
  const paidSet = new Set(paidIds)

  function getMemberStatus(memberId: string) {
    if (paidSet.has(memberId)) return 'paid'
    const day = new Date().getDate()
    return day > 5 ? 'late' : 'outstanding'
  }

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{stokvel.name}</h1>
          <p className="font-mono text-xs mt-1" style={{ color: '#9ca3af' }}>
            {formatDate(new Date())} · {stokvel.type} stokvel
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/contributions" className="btn btn-primary btn-md">
            + Record Payment
          </Link>
          <button
            className="btn btn-gold btn-md"
            onClick={() => setRemindersOpen(true)}
          >
            📲 Send Reminders
            {outstandingMembers.length > 0 && (
              <span
                className="ml-1 w-5 h-5 rounded-full text-xs flex items-center justify-center font-mono"
                style={{ background: 'rgba(10,36,18,0.25)' }}
              >
                {outstandingMembers.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="page-body space-y-6">

        {/* Stat Cards */}
        <StatCards stats={stats} stokvel={stokvel} />

        {/* Quick Actions */}
        <div className="quick-actions">
          <Link href="/contributions" className="btn btn-outline btn-md">
            💰 View Contributions
          </Link>
          <Link href="/members" className="btn btn-outline btn-md">
            👥 Manage Members
          </Link>
          <Link href="/meetings" className="btn btn-outline btn-md">
            📋 Log Meeting
          </Link>
          <Link href="/reports" className="btn btn-outline btn-md">
            📊 View Reports
          </Link>
        </div>

        {/* Two column layout */}
        <div className="grid md:grid-cols-2 gap-5">

          {/* Recent Contributions */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Contributions</span>
              <Link
                href="/contributions"
                className="font-mono text-xs hover:underline"
                style={{ color: '#ca8a04' }}
              >
                View all →
              </Link>
            </div>
            <div className="table-wrap">
              {recentContribs.length ? (
                <table>
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentContribs.map((c: Contribution & { stokvel_members?: { name: string } }) => (
                      <tr key={c.id}>
                        <td className="font-medium">
                          {c.stokvel_members?.name || 'Unknown'}
                        </td>
                        <td className="font-mono font-medium">
                          {formatCurrency(c.amount)}
                        </td>
                        <td className="font-mono text-xs">
                          {formatDateShort(c.date)}
                        </td>
                        <td>
                          <Badge variant={c.status === 'confirmed' ? 'success' : c.status === 'pending' ? 'warning' : 'danger'}>
                            {c.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">💰</div>
                  <div className="empty-title">No contributions yet</div>
                  <div className="empty-sub">
                    <Link href="/contributions" style={{ color: '#ca8a04' }}>
                      Record the first payment →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Member Status */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">This Month&apos;s Status</span>
              <Link
                href="/members"
                className="font-mono text-xs hover:underline"
                style={{ color: '#ca8a04' }}
              >
                Manage →
              </Link>
            </div>
            <div className="card-body p-0">
              {members.length ? (
                <div>
                  {members.slice(0, 7).map((m: StokvelMember) => {
                    const status  = getMemberStatus(m.id)
                    const initials = getInitials(m.name)
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between px-5 py-3"
                        style={{ borderBottom: '1px solid rgba(15,61,30,0.06)' }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-medium flex-shrink-0"
                            style={{
                              background: status === 'paid'
                                ? 'rgba(22,163,74,0.1)'
                                : status === 'late'
                                ? 'rgba(220,38,38,0.1)'
                                : 'rgba(202,138,4,0.1)',
                              color: status === 'paid' ? '#16a34a' : status === 'late' ? '#dc2626' : '#ca8a04',
                            }}
                          >
                            {initials}
                          </div>
                          <span className="text-sm font-medium">{m.name}</span>
                        </div>
                        <Badge variant={getPaymentStatusVariant(status)}>
                          {status}
                        </Badge>
                      </div>
                    )
                  })}
                  {members.length > 7 && (
                    <div className="px-5 py-3">
                      <Link href="/members" className="font-mono text-xs" style={{ color: '#ca8a04' }}>
                        +{members.length - 7} more members →
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">👥</div>
                  <div className="empty-title">No members yet</div>
                  <div className="empty-sub">
                    <Link href="/members" style={{ color: '#ca8a04' }}>
                      Add your first member →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Health Report */}
        <HealthReportCard stokvelId={stokvel.id} />

        {/* Yearly Progress */}
        {stats.memberCount > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Yearly Progress</span>
              <span className="font-mono text-xs" style={{ color: '#9ca3af' }}>
                {new Date().getFullYear()}
              </span>
            </div>
            <div className="card-body">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: '#6b7280' }}>
                  Annual target: {formatCurrency(stats.yearlyTarget)}
                </span>
                <span className="font-mono text-sm font-medium" style={{ color: '#0f3d1e' }}>
                  {formatCurrency(stats.potTotal)}
                </span>
              </div>
              <div className="progress-track" style={{ height: '10px' }}>
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(100, stats.yearlyTarget > 0 ? (stats.potTotal / stats.yearlyTarget) * 100 : 0)}%`,
                    background: 'linear-gradient(90deg, #16a34a, #ca8a04)',
                  }}
                />
              </div>
              <p className="text-xs mt-2 font-mono" style={{ color: '#9ca3af' }}>
                {stats.yearlyTarget > 0
                  ? `${Math.round((stats.potTotal / stats.yearlyTarget) * 100)}% of annual target reached`
                  : 'Set monthly amounts on members to track annual target'}
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Reminders Modal */}
      <RemindersModal
        open={remindersOpen}
        onClose={() => setRemindersOpen(false)}
        stokvelId={stokvel.id}
        outstandingMembers={outstandingMembers.map(m => ({
          id:     m.id,
          name:   m.name,
          amount: m.amount,
          phone:  m.phone || undefined,
        }))}
      />
    </>
  )
}
