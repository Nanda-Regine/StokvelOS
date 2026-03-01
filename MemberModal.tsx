'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'
import type { StokvelMember, MemberFormData } from '@/types'

interface MemberModalProps {
  open:        boolean
  onClose:     () => void
  onSaved:     (member: StokvelMember) => void
  stokvelId:   string
  defaultAmount: number
  nextPosition:  number
  editing?:    StokvelMember | null
}

const ROLES    = ['member', 'admin', 'treasurer', 'secretary'] as const
const STATUSES = ['active', 'inactive', 'suspended'] as const

export function MemberModal({
  open,
  onClose,
  onSaved,
  stokvelId,
  defaultAmount,
  nextPosition,
  editing,
}: MemberModalProps) {
  const [saving, setSaving] = useState(false)

  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [phone,    setPhone]    = useState('')
  const [amount,   setAmount]   = useState('')
  const [position, setPosition] = useState('')
  const [status,   setStatus]   = useState<string>('active')
  const [role,     setRole]     = useState<string>('member')

  // Populate form when editing
  useEffect(() => {
    if (editing) {
      setName(editing.name)
      setEmail(editing.email || '')
      setPhone(editing.phone || '')
      setAmount(editing.monthly_amount ? String(editing.monthly_amount) : '')
      setPosition(editing.payout_position ? String(editing.payout_position) : '')
      setStatus(editing.status)
      setRole(editing.role)
    } else {
      setName(''); setEmail(''); setPhone('')
      setAmount(''); setPosition(String(nextPosition))
      setStatus('active'); setRole('member')
    }
  }, [editing, nextPosition, open])

  async function handleSave() {
    if (!name.trim()) { toast.error('Name is required.'); return }

    setSaving(true)
    try {
      const url    = editing ? `/api/members/${editing.id}` : '/api/members'
      const method = editing ? 'PATCH' : 'POST'

      const payload: Record<string, unknown> = {
        name, email, phone,
        monthly_amount:  amount   ? Number(amount)   : null,
        payout_position: position ? Number(position) : null,
        status, role,
      }
      if (!editing) payload.stokvelId = stokvelId

      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (json.error) { toast.error(json.error); return }

      toast.success(editing ? 'Member updated!' : 'Member added!')
      onSaved(json.member)
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
      title={editing ? `Edit — ${editing.name}` : 'Add Member'}
      size="md"
      footer={
        <>
          <Button variant="outline" size="md" onClick={onClose}>Cancel</Button>
          <Button variant="gold"    size="md" onClick={handleSave} loading={saving}>
            {editing ? 'Save Changes' : 'Add Member'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Name + Phone */}
        <div className="form-row">
          <div className="form-group mb-0">
            <label className="form-label">Full name *</label>
            <input
              className="form-input"
              placeholder="e.g. Zanele Dlamini"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus={!editing}
            />
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Phone number</label>
            <input
              className="form-input"
              placeholder="0821234567"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>
        </div>

        {/* Email */}
        <div className="form-group mb-0">
          <label className="form-label">Email address</label>
          <input
            className="form-input"
            placeholder="member@example.com"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        {/* Amount + Position */}
        <div className="form-row">
          <div className="form-group mb-0">
            <label className="form-label">
              Monthly contribution (R)
              <span
                className="ml-1 normal-case font-body"
                style={{ color: '#9ca3af', fontFamily: 'var(--font-body)', textTransform: 'none', letterSpacing: 0 }}
              >
                — leave blank to use default (R{defaultAmount})
              </span>
            </label>
            <input
              className="form-input"
              type="number"
              placeholder={`Default: R${defaultAmount}`}
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Payout position</label>
            <input
              className="form-input"
              type="number"
              placeholder={String(nextPosition)}
              min="1"
              value={position}
              onChange={e => setPosition(e.target.value)}
            />
          </div>
        </div>

        {/* Status + Role */}
        <div className="form-row">
          <div className="form-group mb-0">
            <label className="form-label">Status</label>
            <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
              {STATUSES.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Role</label>
            <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
              {ROLES.map(r => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </Modal>
  )
}
