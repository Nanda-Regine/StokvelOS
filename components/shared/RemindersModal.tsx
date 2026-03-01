'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/utils'

interface Member {
  id:      string
  name:    string
  amount:  number
  phone?:  string
}

interface Reminder {
  memberId:    string
  memberName:  string
  amount:      number
  message:     string
  whatsappUrl: string | null
}

interface RemindersModalProps {
  open:             boolean
  onClose:          () => void
  stokvelId:        string
  outstandingMembers: Member[]
}

export function RemindersModal({
  open,
  onClose,
  stokvelId,
  outstandingMembers,
}: RemindersModalProps) {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading,   setLoading]   = useState(false)
  const [generated, setGenerated] = useState(false)

  async function generateReminders() {
    if (!outstandingMembers.length) return
    setLoading(true)
    try {
      const res = await fetch('/api/ai/reminders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          stokvelId,
          memberIds: outstandingMembers.map(m => m.id),
        }),
      })
      const json = await res.json()
      setReminders(json.reminders || [])
      setGenerated(true)
    } catch {
      setGenerated(false)
    } finally {
      setLoading(false)
    }
  }

  // Auto-generate when modal opens
  function handleOpen() {
    if (!generated && outstandingMembers.length) {
      generateReminders()
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { onClose(); setGenerated(false); setReminders([]) }}
      title="📲 WhatsApp Payment Reminders"
      size="lg"
    >
      <div onMouseEnter={handleOpen}>
        {!outstandingMembers.length ? (
          <div className="empty-state py-8">
            <div className="empty-icon">✅</div>
            <div className="empty-title">All caught up!</div>
            <div className="empty-sub">No outstanding payments this month.</div>
          </div>
        ) : loading ? (
          <div className="space-y-4">
            {outstandingMembers.map(m => (
              <div key={m.id} className="rounded-xl border p-4" style={{ borderColor: 'rgba(15,61,30,0.1)' }}>
                <div className="flex items-center justify-between mb-3">
                  <strong className="font-display">{m.name}</strong>
                  <span className="badge badge-warning">{formatCurrency(m.amount)} due</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="ai-dot" />
                  <span className="ai-dot" />
                  <span className="ai-dot" />
                  <span className="font-mono text-xs ml-1" style={{ color: '#9ca3af' }}>
                    Writing personalised message…
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {(generated ? reminders : outstandingMembers.map(m => ({
              memberId: m.id, memberName: m.name, amount: m.amount, message: '', whatsappUrl: null,
            }))).map(r => (
              <div key={r.memberId} className="rounded-xl border p-4" style={{ borderColor: 'rgba(15,61,30,0.1)' }}>
                <div className="flex items-center justify-between mb-3">
                  <strong className="font-display text-sm">{r.memberName}</strong>
                  <span className="badge badge-warning">{formatCurrency(r.amount)} due</span>
                </div>
                {r.message && (
                  <>
                    <p
                      className="text-sm leading-relaxed mb-3 italic"
                      style={{ color: '#374151' }}
                    >
                      &ldquo;{r.message}&rdquo;
                    </p>
                    <div className="flex gap-2">
                      {r.whatsappUrl ? (
                        <a
                          href={r.whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-gold btn-sm"
                        >
                          📲 Send via WhatsApp
                        </a>
                      ) : (
                        <span
                          className="text-xs font-mono"
                          style={{ color: '#9ca3af' }}
                        >
                          No phone number saved
                        </span>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          navigator.clipboard.writeText(r.message)
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            <button
              onClick={() => { setGenerated(false); generateReminders() }}
              className="btn btn-outline btn-sm w-full"
            >
              ↻ Regenerate all messages
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
