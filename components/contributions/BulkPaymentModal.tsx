'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { formatCurrency, getInitials, PAYMENT_METHOD_ICONS } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { StokvelMember, PaymentMethod } from '@/types'

interface BulkPaymentModalProps {
  open:           boolean
  onClose:        () => void
  onSaved:        (count: number, totalAmount: number) => void
  stokvelId:      string
  members:        StokvelMember[]
  defaultAmount:  number
  outstandingIds?: Set<string>
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',     label: 'Cash'     },
  { value: 'eft',      label: 'EFT'      },
  { value: 'card',     label: 'Card'     },
  { value: 'snapscan', label: 'SnapScan' },
  { value: 'ozow',     label: 'Ozow'     },
]

export function BulkPaymentModal({
  open,
  onClose,
  onSaved,
  stokvelId,
  members,
  defaultAmount,
  outstandingIds,
}: BulkPaymentModalProps) {
  const [saving,    setSaving]    = useState(false)
  const [selected,  setSelected]  = useState<Set<string>>(new Set())
  const [date,      setDate]      = useState(new Date().toISOString().split('T')[0])
  const [method,    setMethod]    = useState<PaymentMethod>('cash')
  const [status,    setStatus]    = useState<'confirmed' | 'pending'>('confirmed')
  const [useCustom, setUseCustom] = useState(false)
  const [customAmt, setCustomAmt] = useState('')

  const active = members.filter(m => m.status === 'active')

  useEffect(() => {
    if (!open) return
    // Default: pre-select outstanding members if provided
    setSelected(outstandingIds ? new Set(outstandingIds) : new Set(active.map(m => m.id)))
    setDate(new Date().toISOString().split('T')[0])
    setMethod('cash')
    setStatus('confirmed')
    setUseCustom(false)
    setCustomAmt('')
  }, [open])

  function toggleMember(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll()        { setSelected(new Set(active.map(m => m.id))) }
  function selectOutstanding() { setSelected(new Set(outstandingIds || [])) }
  function clearAll()          { setSelected(new Set()) }

  const totalAmount = Array.from(selected).reduce((sum, id) => {
    const m = members.find(mb => mb.id === id)
    return sum + (useCustom && customAmt ? Number(customAmt) : (m?.monthly_amount || defaultAmount))
  }, 0)

  async function handleSave() {
    if (selected.size === 0) { toast.error('Select at least one member.'); return }

    setSaving(true)
    try {
      const res  = await fetch('/api/bulk-payment', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          stokvelId,
          memberIds: Array.from(selected),
          amount:    useCustom && customAmt ? Number(customAmt) : undefined,
          date,
          method,
          status,
        }),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }

      toast.success(`${json.inserted} payments recorded! 💰`)
      onSaved(json.inserted, totalAmount)
      onClose()
    } catch {
      toast.error('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bulk Record Payments"
      size="lg"
      footer={
        <>
          <Button variant="outline" size="md" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="md" onClick={handleSave} loading={saving}>
            Record {selected.size} Payment{selected.size !== 1 ? 's' : ''} · {formatCurrency(totalAmount)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">

        {/* Quick select buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs uppercase tracking-wider" style={{ color: '#9ca3af' }}>Select:</span>
          <button onClick={selectAll} className="btn btn-outline btn-sm">All ({active.length})</button>
          {outstandingIds && outstandingIds.size > 0 && (
            <button onClick={selectOutstanding} className="btn btn-gold btn-sm">
              Outstanding ({outstandingIds.size})
            </button>
          )}
          <button onClick={clearAll} className="btn btn-ghost btn-sm">Clear</button>
          <span className="ml-auto font-mono text-xs" style={{ color: '#9ca3af' }}>
            {selected.size} selected
          </span>
        </div>

        {/* Member grid */}
        <div
          className="grid grid-cols-2 gap-2 overflow-y-auto pr-1"
          style={{ maxHeight: '200px' }}
        >
          {active.map(m => {
            const isSelected  = selected.has(m.id)
            const isOutstanding = outstandingIds?.has(m.id)
            return (
              <button
                key={m.id}
                onClick={() => toggleMember(m.id)}
                className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all duration-150"
                style={{
                  borderColor: isSelected ? '#0f3d1e' : 'rgba(15,61,30,0.12)',
                  background:  isSelected ? 'rgba(15,61,30,0.06)' : 'white',
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-medium flex-shrink-0"
                  style={{
                    background: isSelected ? '#0f3d1e' : 'rgba(15,61,30,0.08)',
                    color:      isSelected ? '#fef9c3' : '#9ca3af',
                  }}
                >
                  {isSelected ? '✓' : getInitials(m.name)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: isSelected ? '#0a2412' : '#374151' }}>
                    {m.name}
                  </div>
                  <div className="font-mono text-xs" style={{ color: isOutstanding ? '#ca8a04' : '#9ca3af' }}>
                    {formatCurrency(m.monthly_amount || defaultAmount)}
                    {isOutstanding ? ' · outstanding' : ''}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Custom amount toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setUseCustom(v => !v)}
            className="flex items-center gap-2 text-xs font-mono"
            style={{ color: useCustom ? '#0f3d1e' : '#9ca3af' }}
          >
            <div
              className="w-4 h-4 rounded flex items-center justify-center border transition-colors"
              style={{
                background:  useCustom ? '#0f3d1e' : 'white',
                borderColor: useCustom ? '#0f3d1e' : 'rgba(15,61,30,0.2)',
              }}
            >
              {useCustom && <span style={{ color: '#fef9c3', fontSize: '0.6rem' }}>✓</span>}
            </div>
            Override amount for all selected members
          </button>
          {useCustom && (
            <input
              className="form-input"
              type="number"
              placeholder={`Default: R${defaultAmount}`}
              value={customAmt}
              onChange={e => setCustomAmt(e.target.value)}
              style={{ width: '140px', padding: '6px 12px', fontSize: '0.8rem' }}
            />
          )}
        </div>

        {/* Date + Method + Status */}
        <div className="grid grid-cols-3 gap-3">
          <div className="form-group mb-0">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Method</label>
            <select className="form-select" value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}>
              {METHODS.map(m => (
                <option key={m.value} value={m.value}>{PAYMENT_METHOD_ICONS[m.value]} {m.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Status</label>
            <select className="form-select" value={status} onChange={e => setStatus(e.target.value as 'confirmed' | 'pending')}>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Summary */}
        {selected.size > 0 && (
          <div
            className="rounded-xl p-4 flex items-center justify-between"
            style={{ background: 'rgba(15,61,30,0.04)', border: '1px solid rgba(15,61,30,0.08)' }}
          >
            <span className="text-sm" style={{ color: '#6b7280' }}>
              Recording <strong style={{ color: '#0a2412' }}>{selected.size} payments</strong>
            </span>
            <span className="font-display text-lg" style={{ color: '#16a34a' }}>
              {formatCurrency(totalAmount)}
            </span>
          </div>
        )}
      </div>
    </Modal>
  )
}
