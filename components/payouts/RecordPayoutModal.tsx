'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { StokvelMember, Payout } from '@/types'

interface RecordPayoutModalProps {
  open:      boolean
  onClose:   () => void
  onSaved:   (payout: Payout) => void
  stokvelId: string
  members:   StokvelMember[]
  potTotal:  number
  editing?:  Payout | null
}

export function RecordPayoutModal({
  open,
  onClose,
  onSaved,
  stokvelId,
  members,
  potTotal,
  editing,
}: RecordPayoutModalProps) {
  const [saving,   setSaving]   = useState(false)
  const [memberId, setMemberId] = useState('')
  const [amount,   setAmount]   = useState('')
  const [date,     setDate]     = useState(new Date().toISOString().split('T')[0])
  const [status,   setStatus]   = useState<'paid' | 'scheduled' | 'skipped'>('paid')
  const [notes,    setNotes]    = useState('')

  const active = members.filter(m => m.status === 'active').sort((a, b) => (a.payout_position || 99) - (b.payout_position || 99))

  useEffect(() => {
    if (!open) return
    if (editing) {
      setMemberId(editing.member_id)
      setAmount(String(editing.amount))
      setDate(editing.date)
      setStatus(editing.status as 'paid' | 'scheduled' | 'skipped')
      setNotes(editing.notes || '')
    } else {
      setMemberId(active[0]?.id || '')
      setAmount(String(Math.round(potTotal)))
      setDate(new Date().toISOString().split('T')[0])
      setStatus('paid')
      setNotes('')
    }
  }, [open, editing, active, potTotal])

  async function handleSave() {
    if (!memberId) { toast.error('Please select a member.'); return }
    if (!amount || Number(amount) <= 0) { toast.error('Enter a valid amount.'); return }

    setSaving(true)
    try {
      const url    = editing ? `/api/payouts/${editing.id}` : '/api/payouts'
      const method = editing ? 'PATCH' : 'POST'
      const payload: Record<string, unknown> = { memberId, amount: Number(amount), date, status, notes }
      if (!editing) { payload.stokvelId = stokvelId; payload.member_id = memberId }

      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(editing ? { status, amount: Number(amount), date, notes } : { stokvelId, member_id: memberId, amount: Number(amount), date, status, notes }),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }

      const selectedMember = members.find(m => m.id === memberId)
      toast.success(`Payout ${status === 'paid' ? 'recorded' : 'scheduled'} for ${selectedMember?.name}! 💸`)
      onSaved(json.payout)
      onClose()
    } catch {
      toast.error('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const selectedMember = members.find(m => m.id === memberId)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Payout' : 'Record Payout'}
      size="md"
      footer={
        <>
          <Button variant="outline" size="md" onClick={onClose}>Cancel</Button>
          <Button variant="gold" size="md" onClick={handleSave} loading={saving}>
            {editing ? 'Save Changes' : status === 'paid' ? 'Record Payout' : 'Schedule Payout'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Member */}
        <div className="form-group mb-0">
          <label className="form-label">Recipient *</label>
          <select className="form-select" value={memberId} onChange={e => setMemberId(e.target.value)} disabled={!!editing}>
            <option value="">Select member…</option>
            {active.map(m => (
              <option key={m.id} value={m.id}>
                {m.payout_position ? `#${m.payout_position} — ` : ''}{m.name}
              </option>
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
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            <p className="text-xs mt-1 font-mono" style={{ color: '#9ca3af' }}>
              Pot total: {formatCurrency(potTotal)}
            </p>
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Date *</label>
            <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        {/* Status */}
        <div className="form-group mb-0">
          <label className="form-label">Status</label>
          <div className="grid grid-cols-3 gap-2">
            {(['paid', 'scheduled', 'skipped'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className="rounded-xl border py-2.5 text-center transition-all duration-150"
                style={{
                  borderColor: status === s ? '#ca8a04' : 'rgba(15,61,30,0.12)',
                  background:  status === s ? 'rgba(202,138,4,0.06)' : 'white',
                  color:       status === s ? '#0a2412' : '#9ca3af',
                }}
              >
                <div className="text-base mb-0.5">
                  {s === 'paid' ? '✅' : s === 'scheduled' ? '📅' : '⏭️'}
                </div>
                <div className="font-mono text-xs">
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="form-group mb-0">
          <label className="form-label">Notes (optional)</label>
          <input className="form-input" placeholder="e.g. EFT transfer, reference POP123" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {/* Preview */}
        {selectedMember && amount && (
          <div
            className="rounded-xl p-4"
            style={{ background: 'rgba(202,138,4,0.04)', border: '1px solid rgba(202,138,4,0.15)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{selectedMember.name}</div>
                <div className="font-mono text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                  Position #{selectedMember.payout_position || '?'}
                </div>
              </div>
              <div className="font-display text-2xl" style={{ color: '#ca8a04' }}>
                {formatCurrency(Number(amount))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
