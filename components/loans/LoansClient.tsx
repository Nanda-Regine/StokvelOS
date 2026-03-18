'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import type { Stokvel, LoanStatus } from '@/types'
import toast from 'react-hot-toast'

interface Member { id: string; name: string; phone: string | null }

interface Loan {
  id: string
  member_id: string
  amount: number
  interest_rate: number
  total_repayable: number
  balance_outstanding: number
  status: LoanStatus
  start_date: string
  end_date: string
  notes: string | null
  created_at: string
  stokvel_members?: Member
}

interface LoansClientProps {
  stokvel:       Stokvel
  initialLoans:  Loan[]
  activeMembers: Member[]
}

const STATUS_VARIANT: Record<LoanStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  active:    'info',
  pending:   'warning',
  paid:      'success',
  overdue:   'danger',
  defaulted: 'danger',
}

const ALL_STATUSES: LoanStatus[] = ['active', 'pending', 'overdue', 'paid', 'defaulted']

const today = () => new Date().toISOString().slice(0, 10)

export function LoansClient({ stokvel, initialLoans, activeMembers }: LoansClientProps) {
  const [loans,        setLoans]        = useState<Loan[]>(initialLoans)
  const [filter,       setFilter]       = useState<LoanStatus | 'all'>('all')
  const [newOpen,      setNewOpen]      = useState(false)
  const [repayOpen,    setRepayOpen]    = useState<string | null>(null) // loanId
  const [saving,       setSaving]       = useState(false)

  // New loan form state
  const [nMember,      setNMember]      = useState('')
  const [nAmount,      setNAmount]      = useState('')
  const [nRate,        setNRate]        = useState('')
  const [nStart,       setNStart]       = useState(today())
  const [nEnd,         setNEnd]         = useState('')
  const [nNotes,       setNNotes]       = useState('')

  // Repayment form state
  const [rAmount,      setRAmount]      = useState('')
  const [rDate,        setRDate]        = useState(today())
  const [rMethod,      setRMethod]      = useState('cash')
  const [rReceipt,     setRReceipt]     = useState('')

  // Stats
  const activeLoans  = loans.filter(l => l.status === 'active')
  const overdueLoans = loans.filter(l => l.status === 'overdue')
  const totalOutstanding = loans
    .filter(l => l.status === 'active' || l.status === 'overdue')
    .reduce((s, l) => s + Number(l.balance_outstanding), 0)
  const totalIssued = loans.reduce((s, l) => s + Number(l.amount), 0)

  const filtered = useMemo(
    () => filter === 'all' ? loans : loans.filter(l => l.status === filter),
    [loans, filter]
  )

  function resetNewForm() {
    setNMember(''); setNAmount(''); setNRate(''); setNStart(today()); setNEnd(''); setNNotes('')
  }

  async function handleNewLoan(e: React.FormEvent) {
    e.preventDefault()
    if (!nMember || !nAmount || !nStart || !nEnd) return
    setSaving(true)
    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stokvelId:     stokvel.id,
          member_id:     nMember,
          amount:        Number(nAmount),
          interest_rate: nRate ? Number(nRate) : undefined,
          start_date:    nStart,
          end_date:      nEnd,
          notes:         nNotes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.reason || data.error || 'Failed'); return }
      setLoans(prev => [{ ...data.loan, stokvel_members: activeMembers.find(m => m.id === nMember) }, ...prev])
      toast.success('Loan created')
      setNewOpen(false)
      resetNewForm()
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function handleRepayment(e: React.FormEvent) {
    e.preventDefault()
    if (!repayOpen || !rAmount || !rDate) return
    setSaving(true)
    try {
      const res = await fetch(`/api/loans/${repayOpen}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repayment: {
            amount:         Number(rAmount),
            date:           rDate,
            method:         rMethod,
            receipt_number: rReceipt || undefined,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      setLoans(prev => prev.map(l => l.id === repayOpen ? { ...l, ...data.loan } : l))
      toast.success('Repayment recorded')
      setRepayOpen(null)
      setRAmount(''); setRDate(today()); setRMethod('cash'); setRReceipt('')
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const repayLoan = repayOpen ? loans.find(l => l.id === repayOpen) : null

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Loans</h1>
          <p className="page-subtitle">{stokvel.name} · member loan book</p>
        </div>
        <Button variant="gold" size="sm" onClick={() => setNewOpen(true)}>
          + New Loan
        </Button>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        {[
          { label: 'Active Loans',    value: activeLoans.length,      color: '#3b82f6' },
          { label: 'Outstanding',     value: formatCurrency(totalOutstanding), color: '#ca8a04' },
          { label: 'Overdue',         value: overdueLoans.length,     color: overdueLoans.length > 0 ? '#dc2626' : '#16a34a' },
          { label: 'Total Issued',    value: formatCurrency(totalIssued),    color: '#6b7280' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ animationDelay: '0.05s' }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color, fontSize: '1.4rem' }}>{s.value}</div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl" style={{ background: s.color }} />
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap mb-4">
        {(['all', ...ALL_STATUSES] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding:       '4px 14px',
              borderRadius:  '20px',
              fontSize:      '0.75rem',
              fontFamily:    'var(--font-mono)',
              cursor:        'pointer',
              border:        filter === s ? '1px solid #ca8a04' : '1px solid rgba(255,255,255,0.1)',
              background:    filter === s ? 'rgba(202,138,4,0.12)' : 'transparent',
              color:         filter === s ? '#fef9c3' : 'rgba(255,255,255,0.4)',
              transition:    'all 0.15s',
            }}
          >
            {s === 'all' ? `All (${loans.length})` : s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
            No loans found
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Member', 'Amount', 'Balance', 'Rate', 'Status', 'Period', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((loan, i) => {
                const member = loan.stokvel_members
                const pct    = loan.total_repayable > 0
                  ? Math.round(((loan.total_repayable - loan.balance_outstanding) / loan.total_repayable) * 100)
                  : 0
                return (
                  <tr
                    key={loan.id}
                    style={{
                      borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      transition: 'background 0.1s',
                    }}
                    className="hover:bg-white/[0.02]"
                  >
                    <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#fef9c3', fontFamily: 'var(--font-body)' }}>
                      {member?.name ?? '—'}
                      {member?.phone && <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>{member.phone}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(loan.amount)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: '0.85rem', color: loan.balance_outstanding > 0 ? '#fbbf24' : '#16a34a', fontFamily: 'var(--font-mono)' }}>
                        {formatCurrency(loan.balance_outstanding)}
                      </div>
                      <div style={{ marginTop: '4px' }}>
                        <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', width: '80px' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: '#16a34a', borderRadius: '2px', transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)' }}>
                      {loan.interest_rate}%
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={STATUS_VARIANT[loan.status]}>{loan.status}</Badge>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>
                      {loan.start_date}<br />{loan.end_date}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {(loan.status === 'active' || loan.status === 'overdue') && (
                        <button
                          onClick={() => setRepayOpen(loan.id)}
                          style={{ fontSize: '0.75rem', color: '#ca8a04', fontFamily: 'var(--font-mono)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                        >
                          + Repay
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* New Loan Modal */}
      {newOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#0f2d18', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '440px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', color: '#fef9c3', fontSize: '1.1rem', marginBottom: '20px' }}>New Loan</h2>
            <form onSubmit={handleNewLoan} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Member</label>
                <select value={nMember} onChange={e => setNMember(e.target.value)} required style={inputStyle}>
                  <option value="">Select member…</option>
                  {activeMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Amount (R)</label>
                  <input type="number" min="1" step="0.01" value={nAmount} onChange={e => setNAmount(e.target.value)} required placeholder="500" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Interest Rate %</label>
                  <input type="number" min="0" max="100" step="0.1" value={nRate} onChange={e => setNRate(e.target.value)} placeholder="Constitution default" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Start Date</label>
                  <input type="date" value={nStart} onChange={e => setNStart(e.target.value)} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>End Date</label>
                  <input type="date" value={nEnd} onChange={e => setNEnd(e.target.value)} required style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Notes (optional)</label>
                <textarea value={nNotes} onChange={e => setNNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'none' }} />
              </div>
              <div className="flex gap-3 justify-end" style={{ marginTop: '4px' }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setNewOpen(false); resetNewForm() }}>Cancel</Button>
                <Button type="submit" variant="gold" size="sm" loading={saving}>Create Loan</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repayment Modal */}
      {repayOpen && repayLoan && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#0f2d18', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '400px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', color: '#fef9c3', fontSize: '1.1rem', marginBottom: '4px' }}>Record Repayment</h2>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '20px' }}>
              {repayLoan.stokvel_members?.name} · Balance: {formatCurrency(repayLoan.balance_outstanding)}
            </p>
            <form onSubmit={handleRepayment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Amount (R)</label>
                  <input type="number" min="0.01" step="0.01" max={repayLoan.balance_outstanding} value={rAmount} onChange={e => setRAmount(e.target.value)} required placeholder="0.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={rDate} onChange={e => setRDate(e.target.value)} required style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Method</label>
                  <select value={rMethod} onChange={e => setRMethod(e.target.value)} style={inputStyle}>
                    {['cash', 'eft', 'card', 'snapscan', 'ozow', 'payfast'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Receipt # (optional)</label>
                  <input type="text" value={rReceipt} onChange={e => setRReceipt(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div className="flex gap-3 justify-end" style={{ marginTop: '4px' }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => setRepayOpen(null)}>Cancel</Button>
                <Button type="submit" variant="gold" size="sm" loading={saving}>Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display:     'block',
  fontFamily:  'var(--font-mono)',
  fontSize:    '0.68rem',
  color:       'rgba(255,255,255,0.35)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: '5px',
}

const inputStyle: React.CSSProperties = {
  width:        '100%',
  background:   'rgba(255,255,255,0.05)',
  border:       '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  padding:      '8px 10px',
  color:        '#fef9c3',
  fontFamily:   'var(--font-body)',
  fontSize:     '0.85rem',
  outline:      'none',
  boxSizing:    'border-box',
}
