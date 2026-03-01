'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/Badge'
import {
  formatCurrency, formatDate, getContributionStatusVariant,
  PAYMENT_METHOD_ICONS, MONTHS_SHORT,
} from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Contribution, ContributionStatus } from '@/types'

interface ContributionsTableProps {
  contributions:  (Contribution & { stokvel_members?: { name: string } | null })[]
  onStatusChange: (id: string, status: ContributionStatus) => void
  onDelete:       (id: string) => void
}

type FilterStatus = 'all' | 'confirmed' | 'pending' | 'rejected'

export function ContributionsTable({
  contributions,
  onStatusChange,
  onDelete,
}: ContributionsTableProps) {
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterMonth,  setFilterMonth]  = useState<number | 'all'>('all')
  const [deleting,     setDeleting]     = useState<string | null>(null)

  const currentYear = new Date().getFullYear()

  const filtered = useMemo(() => {
    let list = [...contributions]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        (c.stokvel_members?.name || '').toLowerCase().includes(q) ||
        c.method.toLowerCase().includes(q) ||
        String(c.amount).includes(q)
      )
    }
    if (filterStatus !== 'all') list = list.filter(c => c.status === filterStatus)
    if (filterMonth  !== 'all') {
      list = list.filter(c => {
        const d = new Date(c.date)
        return d.getMonth() === filterMonth && d.getFullYear() === currentYear
      })
    }
    return list
  }, [contributions, search, filterStatus, filterMonth])

  const totalFiltered  = filtered.reduce((s, c) => s + Number(c.amount), 0)
  const confirmedTotal = filtered.filter(c => c.status === 'confirmed').reduce((s, c) => s + Number(c.amount), 0)

  async function handleDelete(id: string) {
    if (!confirm('Remove this contribution record? This cannot be undone.')) return
    setDeleting(id)
    try {
      const res  = await fetch(`/api/contributions/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      onDelete(id)
      toast.success('Removed.')
    } catch {
      toast.error('Failed to remove.')
    } finally {
      setDeleting(null)
    }
  }

  async function handleStatusChange(id: string, status: ContributionStatus) {
    try {
      const res  = await fetch(`/api/contributions/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      onStatusChange(id, status)
      toast.success('Status updated.')
    } catch {
      toast.error('Failed to update status.')
    }
  }

  return (
    <div>
      {/* Filters */}
      <div
        className="flex flex-wrap items-center gap-3 px-5 py-3"
        style={{ borderBottom: '1px solid rgba(15,61,30,0.08)', background: 'rgba(248,250,248,0.6)' }}
      >
        <input
          type="text"
          className="form-input"
          placeholder="Search member or method…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '200px', padding: '7px 12px', fontSize: '0.8rem' }}
        />

        {/* Status filter */}
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(15,61,30,0.12)' }}>
          {(['all', 'confirmed', 'pending', 'rejected'] as FilterStatus[]).map(s => (
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

        {/* Month filter */}
        <select
          className="form-select"
          value={filterMonth === 'all' ? 'all' : String(filterMonth)}
          onChange={e => setFilterMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          style={{ width: 'auto', padding: '7px 12px', fontSize: '0.8rem' }}
        >
          <option value="all">All months</option>
          {MONTHS_SHORT.map((m, i) => (
            <option key={i} value={i}>{m} {currentYear}</option>
          ))}
        </select>

        {/* Totals */}
        <div className="ml-auto flex items-center gap-4">
          <span className="font-mono text-xs" style={{ color: '#9ca3af' }}>
            {filtered.length} records
          </span>
          <span className="font-mono text-xs font-medium" style={{ color: '#16a34a' }}>
            {formatCurrency(confirmedTotal)} confirmed
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        {filtered.length === 0 ? (
          <div className="empty-state py-12">
            <div className="empty-icon">💰</div>
            <div className="empty-title">
              {contributions.length === 0 ? 'No contributions yet' : 'No matching records'}
            </div>
            <div className="empty-sub">
              {contributions.length === 0
                ? 'Record the first payment to get started.'
                : 'Try adjusting your search or filters.'}
            </div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Method</th>
                <th>Status</th>
                <th>Notes</th>
                <th style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ opacity: deleting === c.id ? 0.5 : 1 }}>
                  {/* Member */}
                  <td className="font-medium">
                    {c.stokvel_members?.name || 'Unknown'}
                  </td>

                  {/* Amount */}
                  <td>
                    <span className="font-mono font-medium" style={{ color: '#0f3d1e' }}>
                      {formatCurrency(c.amount)}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="font-mono text-xs">{formatDate(c.date)}</td>

                  {/* Method */}
                  <td>
                    <span className="font-mono text-xs flex items-center gap-1">
                      {PAYMENT_METHOD_ICONS[c.method] || '💳'} {c.method}
                    </span>
                  </td>

                  {/* Status - editable */}
                  <td>
                    <select
                      className="form-select"
                      style={{ padding: '4px 8px', fontSize: '0.72rem', width: 'auto' }}
                      value={c.status}
                      onChange={e => handleStatusChange(c.id, e.target.value as ContributionStatus)}
                    >
                      <option value="confirmed">confirmed</option>
                      <option value="pending">pending</option>
                      <option value="rejected">rejected</option>
                    </select>
                  </td>

                  {/* Notes */}
                  <td className="text-xs max-w-[140px] truncate" style={{ color: '#9ca3af' }}>
                    {c.notes || '—'}
                  </td>

                  {/* Delete */}
                  <td>
                    <button
                      className="btn btn-ghost btn-sm w-8 h-8 p-0"
                      onClick={() => handleDelete(c.id)}
                      disabled={deleting === c.id}
                      style={{ color: '#dc2626' }}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
