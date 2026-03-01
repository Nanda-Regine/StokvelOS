'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/Badge'
import {
  formatCurrency, formatDate, getInitials,
  getMemberStatusVariant, getPaymentStatusVariant,
  buildWhatsAppUrl,
} from '@/lib/utils'
import type { StokvelMember } from '@/types'

interface MembersTableProps {
  members:        StokvelMember[]
  paidIds:        Set<string>
  defaultAmount:  number
  yearContribs:   Record<string, number>   // memberId → total paid this year
  onEdit:         (member: StokvelMember) => void
  onRemove:       (member: StokvelMember) => void
}

type SortKey = 'name' | 'position' | 'status' | 'paid'
type FilterStatus = 'all' | 'active' | 'inactive'
type FilterPayment = 'all' | 'paid' | 'outstanding' | 'late'

export function MembersTable({
  members,
  paidIds,
  defaultAmount,
  yearContribs,
  onEdit,
  onRemove,
}: MembersTableProps) {
  const [search,        setSearch]        = useState('')
  const [filterStatus,  setFilterStatus]  = useState<FilterStatus>('all')
  const [filterPayment, setFilterPayment] = useState<FilterPayment>('all')
  const [sortKey,       setSortKey]       = useState<SortKey>('position')
  const [sortAsc,       setSortAsc]       = useState(true)

  const today = new Date()
  const isLate = today.getDate() > 5

  function getPaymentStatus(m: StokvelMember) {
    if (paidIds.has(m.id)) return 'paid'
    return isLate ? 'late' : 'outstanding'
  }

  const filtered = useMemo(() => {
    let list = [...members]

    // Search
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.phone || '').includes(q) ||
        (m.email || '').toLowerCase().includes(q)
      )
    }

    // Status filter
    if (filterStatus !== 'all') {
      list = list.filter(m => m.status === filterStatus)
    }

    // Payment filter
    if (filterPayment !== 'all') {
      list = list.filter(m => getPaymentStatus(m) === filterPayment)
    }

    // Sort
    list.sort((a, b) => {
      let diff = 0
      if (sortKey === 'name')     diff = a.name.localeCompare(b.name)
      if (sortKey === 'position') diff = (a.payout_position || 99) - (b.payout_position || 99)
      if (sortKey === 'status')   diff = a.status.localeCompare(b.status)
      if (sortKey === 'paid')     diff = (yearContribs[a.id] || 0) - (yearContribs[b.id] || 0)
      return sortAsc ? diff : -diff
    })

    return list
  }, [members, search, filterStatus, filterPayment, sortKey, sortAsc, paidIds])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(true) }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span style={{ opacity: 0.3 }}>↕</span>
    return <span style={{ color: '#ca8a04' }}>{sortAsc ? '↑' : '↓'}</span>
  }

  return (
    <div>
      {/* Filters bar */}
      <div
        className="flex flex-wrap items-center gap-3 px-5 py-3"
        style={{ borderBottom: '1px solid rgba(15,61,30,0.08)', background: 'rgba(248,250,248,0.6)' }}
      >
        {/* Search */}
        <input
          type="text"
          className="form-input"
          placeholder="Search name, phone, email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '220px', padding: '7px 12px', fontSize: '0.8rem' }}
        />

        {/* Status filter */}
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(15,61,30,0.12)' }}>
          {(['all', 'active', 'inactive'] as FilterStatus[]).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 text-xs font-mono transition-colors"
              style={{
                background: filterStatus === s ? '#0f3d1e' : 'white',
                color:      filterStatus === s ? '#fef9c3' : '#6b7280',
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Payment filter */}
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(15,61,30,0.12)' }}>
          {(['all', 'paid', 'outstanding', 'late'] as FilterPayment[]).map(s => (
            <button
              key={s}
              onClick={() => setFilterPayment(s)}
              className="px-3 py-1.5 text-xs font-mono transition-colors"
              style={{
                background: filterPayment === s ? '#0f3d1e' : 'white',
                color:      filterPayment === s ? '#fef9c3' : '#6b7280',
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <span className="ml-auto font-mono text-xs" style={{ color: '#9ca3af' }}>
          {filtered.length} of {members.length} members
        </span>
      </div>

      {/* Table */}
      <div className="table-wrap">
        {filtered.length === 0 ? (
          <div className="empty-state py-12">
            <div className="empty-icon">👥</div>
            <div className="empty-title">
              {members.length === 0 ? 'No members yet' : 'No matches found'}
            </div>
            <div className="empty-sub">
              {members.length === 0
                ? 'Click "Add Member" to get started.'
                : 'Try adjusting your search or filters.'}
            </div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>
                  <button className="flex items-center gap-1 hover:text-forest-700" onClick={() => toggleSort('name')}>
                    Member <SortIcon k="name" />
                  </button>
                </th>
                <th>Contact</th>
                <th>Monthly (R)</th>
                <th>
                  <button className="flex items-center gap-1 hover:text-forest-700" onClick={() => toggleSort('position')}>
                    Payout <SortIcon k="position" />
                  </button>
                </th>
                <th>
                  <button className="flex items-center gap-1 hover:text-forest-700" onClick={() => toggleSort('paid')}>
                    Paid {today.getFullYear()} <SortIcon k="paid" />
                  </button>
                </th>
                <th>This Month</th>
                <th>
                  <button className="flex items-center gap-1 hover:text-forest-700" onClick={() => toggleSort('status')}>
                    Status <SortIcon k="status" />
                  </button>
                </th>
                <th style={{ width: 100 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => {
                const payStatus    = getPaymentStatus(m)
                const yearlyPaid   = yearContribs[m.id] || 0
                const monthlyAmt   = m.monthly_amount || defaultAmount
                const yearTarget   = monthlyAmt * 12
                const yearPct      = yearTarget > 0 ? Math.min(100, Math.round((yearlyPaid / yearTarget) * 100)) : 0
                const initials     = getInitials(m.name)

                return (
                  <tr key={m.id}>
                    {/* # */}
                    <td className="font-mono text-xs" style={{ color: '#9ca3af' }}>
                      {m.payout_position || i + 1}
                    </td>

                    {/* Member */}
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-medium flex-shrink-0"
                          style={{
                            background: m.status === 'active' ? 'rgba(15,61,30,0.08)' : 'rgba(107,114,128,0.1)',
                            color: m.status === 'active' ? '#0f3d1e' : '#9ca3af',
                          }}
                        >
                          {initials}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{m.name}</div>
                          <div className="font-mono text-xs" style={{ color: '#9ca3af' }}>
                            {m.role !== 'member' ? m.role : ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td>
                      <div className="space-y-0.5">
                        {m.phone && (
                          <div className="font-mono text-xs">{m.phone}</div>
                        )}
                        {m.email && (
                          <div className="text-xs truncate max-w-[140px]" style={{ color: '#9ca3af' }}>
                            {m.email}
                          </div>
                        )}
                        {!m.phone && !m.email && (
                          <span style={{ color: '#d1d5db' }}>—</span>
                        )}
                      </div>
                    </td>

                    {/* Monthly */}
                    <td className="font-mono text-sm">{formatCurrency(monthlyAmt)}</td>

                    {/* Payout position */}
                    <td className="text-center font-mono text-sm">
                      {m.payout_position ?? <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>

                    {/* Year progress */}
                    <td>
                      <div style={{ minWidth: '100px' }}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-mono">{formatCurrency(yearlyPaid)}</span>
                          <span style={{ color: '#9ca3af' }}>{yearPct}%</span>
                        </div>
                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${yearPct}%`,
                              background: yearPct >= 80 ? '#16a34a' : yearPct >= 50 ? '#ca8a04' : '#dc2626',
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* This month */}
                    <td>
                      <Badge variant={getPaymentStatusVariant(payStatus)}>
                        {payStatus}
                      </Badge>
                    </td>

                    {/* Member status */}
                    <td>
                      <Badge variant={getMemberStatusVariant(m.status)}>
                        {m.status}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td>
                      <div className="flex items-center gap-1">
                        {m.phone && (
                          <a
                            href={buildWhatsAppUrl(m.phone, `Hi ${m.name.split(' ')[0]}!`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm w-8 h-8 p-0 text-base"
                            title="WhatsApp"
                          >
                            📲
                          </a>
                        )}
                        <button
                          className="btn btn-ghost btn-sm px-2"
                          onClick={() => onEdit(m)}
                          title="Edit member"
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-ghost btn-sm w-8 h-8 p-0"
                          onClick={() => onRemove(m)}
                          title="Remove member"
                          style={{ color: '#dc2626' }}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
