'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { PAYMENT_METHOD_ICONS } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { StokvelMember, Contribution, PaymentMethod, ContributionStatus } from '@/types'

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',     label: 'Cash'     },
  { value: 'eft',      label: 'EFT'      },
  { value: 'card',     label: 'Card'     },
  { value: 'snapscan', label: 'SnapScan' },
  { value: 'ozow',     label: 'Ozow'     },
]

interface PaymentModalProps {
  open:        boolean
  onClose:     () => void
  onSaved:     (contribution: Contribution) => void
  stokvelId:   string
  members:     StokvelMember[]
  defaultAmount: number
  preselectedMemberId?: string
}

export function PaymentModal({
  open,
  onClose,
  onSaved,
  stokvelId,
  members,
  defaultAmount,
  preselectedMemberId,
}: PaymentModalProps) {
  const [saving,   setSaving]   = useState(false)
  const [memberId, setMemberId] = useState('')
  const [amount,   setAmount]   = useState('')
  const [date,     setDate]     = useState(new Date().toISOString().split('T')[0])
  const [method,   setMethod]   = useState<PaymentMethod>('cash')
  const [status,   setStatus]   = useState<ContributionStatus>('confirmed')
  const [notes,    setNotes]    = useState('')

  const activeMembers = members.filter(m => m.status === 'active')

  // Set defaults when opening
  useEffect(() => {
    if (!open) return
    setMemberId(preselectedMemberId || activeMembers[0]?.id || '')
    setDate(new Date().toISOString().split('T')[0])
    setMethod('cash')
    setStatus('confirmed')
    setNotes('')
    // Auto-fill amount based on selected member
  }, [open, preselectedMemberId, activeMembers])

  // Auto-fill amount when member changes
  useEffect(() => {
    if (!memberId) return
    const m = members.find(x => x.id === memberId)
    setAmount(String(m?.monthly_amount || defaultAmount))
  }, [memberId, members, defaultAmount])

  async function handleSave() {
    if (!memberId) { toast.error('Please select a member.'); return }
    if (!amount || Number(amount) <= 0) { toast.error('Please enter a valid amount.'); return }
    if (!date) { toast.error('Please select a date.'); return }

    setSaving(true)
    try {
      const res  = await fetch('/api/contributions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ stokvelId, member_id: memberId, amount: Number(amount), date, method, status, notes }),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }

      toast.success('Payment recorded! 💰')
      onSaved(json.contribution)
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
      title="Record Payment"
      size="md"
      footer={
        <>
          <Button variant="outline" size="md" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="md" onClick={handleSave} loading={saving}>
            Record Payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Member select */}
        <div className="form-group mb-0">
          <label className="form-label">Member *</label>
          <select
            className="form-select"
            value={memberId}
            onChange={e => setMemberId(e.target.value)}
          >
            <option value="">Select member…</option>
            {activeMembers.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Amount + Date */}
        <div className="form-row">
          <div className="form-group mb-0">
            <label className="form-label">Amount (R) *</label>
            <input
              className="form-input"
              type="number"
              min="1"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Date *</label>
            <input
              className="form-input"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
        </div>

        {/* Payment method */}
        <div className="form-group mb-0">
          <label className="form-label">Payment method</label>
          <div className="grid grid-cols-5 gap-2">
            {METHODS.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                className="rounded-xl border py-2.5 text-center transition-all duration-200 flex flex-col items-center gap-1"
                style={{
                  borderColor: method === m.value ? '#ca8a04' : 'rgba(15,61,30,0.15)',
                  background:  method === m.value ? 'rgba(202,138,4,0.06)' : 'white',
                }}
              >
                <span className="text-lg">{PAYMENT_METHOD_ICONS[m.value]}</span>
                <span
                  className="font-mono text-xs"
                  style={{ color: method === m.value ? '#0a2412' : '#9ca3af' }}
                >
                  {m.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="form-group mb-0">
          <label className="form-label">Status</label>
          <div className="flex gap-2">
            {(['confirmed', 'pending'] as ContributionStatus[]).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className="flex-1 rounded-xl border py-2.5 text-sm font-mono transition-all duration-200"
                style={{
                  borderColor: status === s ? '#ca8a04' : 'rgba(15,61,30,0.15)',
                  background:  status === s ? 'rgba(202,138,4,0.06)' : 'white',
                  color:       status === s ? '#0a2412' : '#9ca3af',
                }}
              >
                {s === 'confirmed' ? '✓ Confirmed' : '⏳ Pending'}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="form-group mb-0">
          <label className="form-label">Notes (optional)</label>
          <input
            className="form-input"
            placeholder="Any additional notes…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  )
}
