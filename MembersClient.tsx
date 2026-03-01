'use client'

import { useState } from 'react'
import { MembersTable } from '@/components/members/MembersTable'
import { MemberModal } from '@/components/members/MemberModal'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatCurrencyShort, calcPercent } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { StokvelMember, Stokvel } from '@/types'

interface MembersClientProps {
  stokvel:        Stokvel
  initialMembers: StokvelMember[]
  initialPaidIds: string[]
  yearContribs:   Record<string, number>
}

export function MembersClient({
  stokvel,
  initialMembers,
  initialPaidIds,
  yearContribs: initialYearContribs,
}: MembersClientProps) {
  const [members,      setMembers]      = useState<StokvelMember[]>(initialMembers)
  const [yearContribs, setYearContribs] = useState(initialYearContribs)
  const [paidIds]                       = useState(new Set(initialPaidIds))
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editing,      setEditing]      = useState<StokvelMember | null>(null)
  const [removing,     setRemoving]     = useState<string | null>(null)

  const activeMembers = members.filter(m => m.status === 'active')
  const paidCount     = activeMembers.filter(m => paidIds.has(m.id)).length
  const totalMonthly  = activeMembers.reduce((s, m) => s + (m.monthly_amount || stokvel.monthly_amount), 0)
  const compliancePct = calcPercent(paidCount, activeMembers.length)

  function handleAdd() {
    setEditing(null)
    setModalOpen(true)
  }

  function handleEdit(m: StokvelMember) {
    setEditing(m)
    setModalOpen(true)
  }

  function handleSaved(saved: StokvelMember) {
    setMembers(prev => {
      const idx = prev.findIndex(m => m.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [...prev, saved]
    })
  }

  async function handleRemove(m: StokvelMember) {
    if (!confirm(`Remove ${m.name} from the stokvel?\n\nTheir contribution history will be kept.`)) return
    setRemoving(m.id)
    try {
      const res  = await fetch(`/api/members/${m.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      // Soft-delete — update status to inactive in local state
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, status: 'inactive' } : x))
      toast.success(`${m.name} removed.`)
    } catch {
      toast.error('Failed to remove member.')
    } finally {
      setRemoving(null)
    }
  }

  function exportCSV() {
    const headers = ['Name', 'Email', 'Phone', 'Monthly (R)', 'Payout Position', 'Status', 'Role', 'Joined']
    const rows = members.map(m => [
      m.name,
      m.email || '',
      m.phone || '',
      m.monthly_amount || stokvel.monthly_amount,
      m.payout_position || '',
      m.status,
      m.role,
      m.joined_at ? new Date(m.joined_at).toLocaleDateString('en-ZA') : '',
    ])

    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `${stokvel.name.replace(/\s+/g, '_')}_members.csv`
    a.click()
    toast.success('Members exported!')
  }

  const nextPosition = Math.max(0, ...members.map(m => m.payout_position || 0)) + 1

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Members</h1>
          <p className="font-mono text-xs mt-1" style={{ color: '#9ca3af' }}>
            {activeMembers.length} active · {members.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="md" onClick={exportCSV}>
            ↓ Export CSV
          </Button>
          <Button variant="primary" size="md" onClick={handleAdd}>
            + Add Member
          </Button>
        </div>
      </div>

      <div className="page-body space-y-5">

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: 'Active Members',
              value: String(activeMembers.length),
              sub:   `${members.length} total`,
              color: '#0f3d1e',
            },
            {
              label: 'Monthly Pot',
              value: formatCurrencyShort(totalMonthly),
              sub:   'if all pay',
              color: '#ca8a04',
            },
            {
              label: 'Paid This Month',
              value: `${paidCount} / ${activeMembers.length}`,
              sub:   `${compliancePct}% compliance`,
              color: compliancePct >= 80 ? '#16a34a' : compliancePct >= 50 ? '#ca8a04' : '#dc2626',
            },
            {
              label: 'Annual Target',
              value: formatCurrencyShort(totalMonthly * 12),
              sub:   'total expected',
              color: '#0f3d1e',
            },
          ].map((s, i) => (
            <div
              key={i}
              className="rounded-2xl border p-4 bg-white"
              style={{
                borderColor: 'rgba(15,61,30,0.1)',
                boxShadow: '0 1px 3px rgba(15,61,30,0.06)',
                animationDelay: `${i * 0.06}s`,
              }}
            >
              <div className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: '#9ca3af' }}>
                {s.label}
              </div>
              <div className="font-display text-2xl" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Compliance bar */}
        {activeMembers.length > 0 && (
          <div
            className="rounded-2xl border bg-white px-5 py-4"
            style={{ borderColor: 'rgba(15,61,30,0.1)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs uppercase tracking-wider" style={{ color: '#9ca3af' }}>
                Monthly Compliance
              </span>
              <span
                className="font-mono text-sm font-medium"
                style={{ color: compliancePct >= 80 ? '#16a34a' : compliancePct >= 50 ? '#ca8a04' : '#dc2626' }}
              >
                {compliancePct}%
              </span>
            </div>
            <div className="progress-track" style={{ height: '8px' }}>
              <div
                className="progress-fill"
                style={{
                  width: `${compliancePct}%`,
                  background: compliancePct >= 80
                    ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                    : compliancePct >= 50
                    ? 'linear-gradient(90deg, #ca8a04, #eab308)'
                    : 'linear-gradient(90deg, #dc2626, #ef4444)',
                }}
              />
            </div>
            <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>
              {paidCount} of {activeMembers.length} members have paid this month
              {compliancePct < 80 && ` · ${activeMembers.length - paidCount} still outstanding`}
            </p>
          </div>
        )}

        {/* Members table */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">All Members</span>
          </div>
          <MembersTable
            members={members}
            paidIds={paidIds}
            defaultAmount={stokvel.monthly_amount}
            yearContribs={yearContribs}
            onEdit={handleEdit}
            onRemove={handleRemove}
          />
        </div>

      </div>

      {/* Add/Edit Modal */}
      <MemberModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSaved={handleSaved}
        stokvelId={stokvel.id}
        defaultAmount={stokvel.monthly_amount}
        nextPosition={nextPosition}
        editing={editing}
      />
    </>
  )
}
