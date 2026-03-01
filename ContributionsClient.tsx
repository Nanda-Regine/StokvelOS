'use client'

import { useState } from 'react'
import { ContributionCalendar } from '@/components/contributions/ContributionCalendar'
import { ContributionsTable }   from '@/components/contributions/ContributionsTable'
import { PaymentModal }         from '@/components/contributions/PaymentModal'
import { Button }               from '@/components/ui/Button'
import { formatCurrency, formatCurrencyShort, calcPercent } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Contribution, StokvelMember, Stokvel, ContributionStatus } from '@/types'

type FullContribution = Contribution & {
  stokvel_members?: { id: string; name: string; phone: string } | null
}

interface ContributionsClientProps {
  stokvel:               Stokvel
  initialContributions:  FullContribution[]
  members:               StokvelMember[]
}

export function ContributionsClient({
  stokvel,
  initialContributions,
  members,
}: ContributionsClientProps) {
  const [contributions, setContributions] = useState<FullContribution[]>(initialContributions)
  const [modalOpen,     setModalOpen]     = useState(false)
  const [preselect,     setPreselect]     = useState<string | undefined>(undefined)

  // ── Derived stats ─────────────────────────────────────────────
  const now            = new Date()
  const monthStart     = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const currentMonth   = contributions.filter(c => c.date >= monthStart)
  const confirmedTotal = contributions.filter(c => c.status === 'confirmed').reduce((s, c) => s + Number(c.amount), 0)
  const pendingTotal   = contributions.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0)
  const thisMonthConf  = currentMonth.filter(c => c.status === 'confirmed').reduce((s, c) => s + Number(c.amount), 0)
  const expectedMonth  = members.reduce((s, m) => s + (m.monthly_amount || stokvel.monthly_amount), 0)
  const compliancePct  = expectedMonth > 0 ? calcPercent(thisMonthConf, expectedMonth) : 0

  // ── Handlers ──────────────────────────────────────────────────
  function handleSaved(c: Contribution) {
    setContributions(prev => [c as FullContribution, ...prev])
  }

  function handleStatusChange(id: string, status: ContributionStatus) {
    setContributions(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  function handleDelete(id: string) {
    setContributions(prev => prev.filter(c => c.id !== id))
  }

  function handleDayClick(date: string) {
    // No-op for now — could filter table to that day
  }

  function exportCSV() {
    const headers = ['Member', 'Amount (R)', 'Date', 'Method', 'Status', 'Notes', 'Recorded']
    const rows = contributions.map(c => [
      c.stokvel_members?.name || 'Unknown',
      c.amount,
      c.date,
      c.method,
      c.status,
      c.notes || '',
      c.recorded_at ? new Date(c.recorded_at).toLocaleDateString('en-ZA') : '',
    ])
    const csv  = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `${stokvel.name.replace(/\s+/g, '_')}_contributions.csv`
    a.click()
    toast.success('Contributions exported!')
  }

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Contributions</h1>
          <p className="font-mono text-xs mt-1" style={{ color: '#9ca3af' }}>
            {contributions.length} records · last 12 months
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="md" onClick={exportCSV}>
            ↓ Export CSV
          </Button>
          <Button variant="primary" size="md" onClick={() => { setPreselect(undefined); setModalOpen(true) }}>
            + Record Payment
          </Button>
        </div>
      </div>

      <div className="page-body space-y-5">

        {/* Stat row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Pot',       value: formatCurrencyShort(confirmedTotal), sub: 'All confirmed', color: '#0f3d1e' },
            { label: 'This Month',      value: formatCurrencyShort(thisMonthConf),  sub: `of ${formatCurrency(expectedMonth)} expected`, color: '#ca8a04' },
            { label: 'Compliance',      value: `${compliancePct}%`,                sub: 'this month', color: compliancePct >= 80 ? '#16a34a' : compliancePct >= 50 ? '#ca8a04' : '#dc2626' },
            { label: 'Pending',         value: formatCurrencyShort(pendingTotal),   sub: 'to be confirmed', color: '#854d0e' },
          ].map((s, i) => (
            <div
              key={i}
              className="rounded-2xl border p-4 bg-white"
              style={{ borderColor: 'rgba(15,61,30,0.1)', boxShadow: '0 1px 3px rgba(15,61,30,0.06)' }}
            >
              <div className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: '#9ca3af' }}>{s.label}</div>
              <div className="font-display text-2xl" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Calendar + Table layout */}
        <div className="grid md:grid-cols-[320px_1fr] gap-5 items-start">

          {/* Calendar */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Monthly View</span>
            </div>
            <div className="card-body">
              <ContributionCalendar
                contributions={contributions}
                onDayClick={handleDayClick}
              />
            </div>
          </div>

          {/* Table */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">All Contributions</span>
              <button
                className="btn btn-gold btn-sm"
                onClick={() => { setPreselect(undefined); setModalOpen(true) }}
              >
                + Record
              </button>
            </div>
            <ContributionsTable
              contributions={contributions}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          </div>
        </div>

        {/* Outstanding members quick-pay */}
        {members.length > 0 && (() => {
          const now2        = new Date()
          const ms          = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, '0')}-01`
          const paidIds     = new Set(
            contributions.filter(c => c.date >= ms && c.status === 'confirmed').map(c => c.member_id)
          )
          const outstanding = members.filter(m => !paidIds.has(m.id))
          if (!outstanding.length) return null

          return (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Outstanding This Month</span>
                <span className="badge badge-warning">{outstanding.length} members</span>
              </div>
              <div className="card-body">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {outstanding.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setPreselect(m.id); setModalOpen(true) }}
                      className="rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5"
                      style={{
                        borderColor: 'rgba(202,138,4,0.25)',
                        background:  'rgba(202,138,4,0.03)',
                      }}
                    >
                      <div className="font-medium text-sm mb-1">{m.name}</div>
                      <div className="font-mono text-xs" style={{ color: '#ca8a04' }}>
                        {formatCurrency(m.monthly_amount || stokvel.monthly_amount)} due
                      </div>
                      <div className="text-xs mt-2" style={{ color: '#9ca3af' }}>Click to record →</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}

      </div>

      {/* Payment Modal */}
      <PaymentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setPreselect(undefined) }}
        onSaved={handleSaved}
        stokvelId={stokvel.id}
        members={members}
        defaultAmount={stokvel.monthly_amount}
        preselectedMemberId={preselect}
      />
    </>
  )
}
