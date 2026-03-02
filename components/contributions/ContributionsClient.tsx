'use client'
// app/contributions/ContributionsClient.tsx  (REPLACE Batch 3 — adds Bulk Payment button)

import { useState, useMemo } from 'react'
import { ContributionCalendar } from '@/components/dashboard/ContributionCalendar'
import { ContributionsTable }   from '@/components/contributions/ContributionsTable'
import { PaymentModal }         from '@/components/contributions/PaymentModal'
import { BulkPaymentModal }     from '@/components/contributions/BulkPaymentModal'
import { Button }               from '@/components/ui/Button'
import { Badge }                from '@/components/ui/Badge'
import { MemberStatementButton } from '@/components/reports/MemberStatementButton'
import { formatCurrency, formatCurrencyShort, calcPercent } from '@/lib/utils'
import type { Contribution, StokvelMember, Stokvel } from '@/types'

interface ContributionsClientProps {
  stokvel:           Stokvel
  contributions:     Contribution[]
  activeMembers:     StokvelMember[]
  currentMonthPaidIds: string[]
}

export function ContributionsClient({
  stokvel,
  contributions: initialContribs,
  activeMembers,
  currentMonthPaidIds: initialPaidIds,
}: ContributionsClientProps) {
  const [contribs,      setContribs]      = useState<Contribution[]>(initialContribs)
  const [payModalOpen,  setPayModalOpen]  = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<string | undefined>()
  const [calendarMonth,  setCalendarMonth]  = useState<string | null>(null)

  // Derived stats
  const now       = new Date()
  const monthStr  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const thisMonth = contribs.filter(c => c.date >= monthStr)
  const paidIds   = new Set(thisMonth.filter(c => c.status === 'confirmed').map(c => c.member_id))

  const confirmedTotal  = thisMonth.filter(c => c.status === 'confirmed').reduce((s, c) => s + Number(c.amount), 0)
  const pendingTotal    = contribs.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0)
  const expectedMonthly = activeMembers.reduce((s, m) => s + (m.monthly_amount || stokvel.monthly_amount), 0)
  const compliancePct   = calcPercent(paidIds.size, activeMembers.length)

  const outstandingIds = useMemo(
    () => new Set(activeMembers.filter(m => !paidIds.has(m.id)).map(m => m.id)),
    [activeMembers, paidIds]
  )
  const outstandingMembers = activeMembers.filter(m => outstandingIds.has(m.id))

  function handleSaved(c: Contribution) {
    setContribs(prev => {
      const idx = prev.findIndex(x => x.id === c.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = c; return n }
      return [c, ...prev]
    })
  }

  function handleStatusChange(id: string, status: string) {
    setContribs(prev => prev.map(c => c.id === id ? { ...c, status: status as Contribution['status'] } : c))
  }

  function handleDelete(id: string) {
    setContribs(prev => prev.filter(c => c.id !== id))
  }

  function handleBulkSaved(count: number) {
    // Refetch would be ideal but reload works for now
    window.location.reload()
  }

  function openPayFor(memberId: string) {
    setSelectedMember(memberId)
    setPayModalOpen(true)
  }

  function exportCSV() {
    const headers = ['Member', 'Date', 'Amount', 'Method', 'Status', 'Notes', 'Recorded']
    const rows    = contribs.map(c => {
      const m = activeMembers.find(mb => mb.id === c.member_id)
      return [m?.name || c.member_id, c.date, c.amount, c.method, c.status, c.notes || '', c.recorded_at?.split('T')[0] || '']
    })
    const csv  = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a    = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `${stokvel.name.replace(/\s+/g, '_')}_contributions.csv`; a.click()
  }

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Contributions</h1>
          <p className="font-mono text-xs mt-1" style={{ color: '#9ca3af' }}>{contribs.length} total records</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"  size="md" onClick={exportCSV}>↓ CSV</Button>
          <Button variant="outline"  size="md" onClick={() => setBulkModalOpen(true)}>⚡ Bulk Record</Button>
          <Button variant="primary"  size="md" onClick={() => { setSelectedMember(undefined); setPayModalOpen(true) }}>+ Record Payment</Button>
        </div>
      </div>

      <div className="page-body space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Confirmed This Month', value: formatCurrencyShort(confirmedTotal),    sub: `of ${formatCurrency(expectedMonthly)} expected`, color: '#16a34a' },
            { label: 'Pending',              value: formatCurrencyShort(pendingTotal),       sub: 'awaiting confirmation',                          color: '#ca8a04' },
            { label: 'Compliance',           value: `${compliancePct}%`,                    sub: `${paidIds.size} of ${activeMembers.length} paid`, color: compliancePct >= 80 ? '#16a34a' : compliancePct >= 50 ? '#ca8a04' : '#dc2626' },
            { label: 'Outstanding',          value: String(outstandingMembers.length),      sub: 'members yet to pay',                             color: outstandingMembers.length === 0 ? '#16a34a' : '#dc2626' },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl border p-4 bg-white" style={{ borderColor: 'rgba(15,61,30,0.1)', boxShadow: '0 1px 3px rgba(15,61,30,0.06)' }}>
              <div className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: '#9ca3af' }}>{s.label}</div>
              <div className="font-display text-2xl leading-tight" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Calendar + Table */}
        <div className="grid md:grid-cols-[320px_1fr] gap-5 items-start">
          <ContributionCalendar
            contributions={contribs}
            onDayClick={(date) => setCalendarMonth(date)}
          />
          <ContributionsTable
            contributions={contribs}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
          />
        </div>

        {/* Outstanding members quick-pay */}
        {outstandingMembers.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Outstanding This Month</span>
              <div className="flex gap-2">
                <Badge variant="danger">{outstandingMembers.length} unpaid</Badge>
                <Button variant="gold" size="sm" onClick={() => setBulkModalOpen(true)}>
                  ⚡ Bulk Record All
                </Button>
              </div>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {outstandingMembers.map(m => (
                  <button
                    key={m.id}
                    onClick={() => openPayFor(m.id)}
                    className="rounded-xl border p-3 text-left transition-all hover:border-gold-400 hover:-translate-y-0.5"
                    style={{ borderColor: 'rgba(220,38,38,0.15)', background: 'rgba(220,38,38,0.02)' }}
                  >
                    <div className="text-xs font-medium truncate" style={{ color: '#0a2412' }}>{m.name}</div>
                    <div className="font-mono text-xs mt-0.5" style={{ color: '#ca8a04' }}>
                      {formatCurrency(m.monthly_amount || stokvel.monthly_amount)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <PaymentModal
        open={payModalOpen}
        onClose={() => { setPayModalOpen(false); setSelectedMember(undefined) }}
        onSaved={handleSaved}
        stokvelId={stokvel.id}
        members={activeMembers}
        defaultAmount={stokvel.monthly_amount}
        preselectedMemberId={selectedMember}
      />

      <BulkPaymentModal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        onSaved={handleBulkSaved}
        stokvelId={stokvel.id}
        members={activeMembers}
        defaultAmount={stokvel.monthly_amount}
        outstandingIds={outstandingIds}
      />
    </>
  )
}
