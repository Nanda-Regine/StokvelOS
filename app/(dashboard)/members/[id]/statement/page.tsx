// app/members/[id]/statement/page.tsx
// Dedicated page that renders a print-friendly member statement
// Also exposes the MemberStatementButton for PDF download

import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MemberStatementButton } from '@/components/reports/MemberStatementButton'
import { formatCurrency, formatDate, MONTHS_SHORT } from '@/lib/utils'
import Link from 'next/link'
import type { Metadata } from 'next'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: member } = await supabase
    .from('stokvel_members').select('name').eq('id', params.id).single()
  return { title: member ? `${member.name} Statement` : 'Member Statement' }
}

export default async function MemberStatementPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: member } = await supabase
    .from('stokvel_members')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!member) notFound()

  // Verify admin owns this stokvel
  const { data: stokvel } = await supabase
    .from('stokvels')
    .select('*')
    .eq('id', member.stokvel_id)
    .eq('admin_id', user.id)
    .single()

  if (!stokvel) notFound()

  // Fetch all contributions for this member
  const { data: contributions } = await supabase
    .from('contributions')
    .select('*')
    .eq('member_id', params.id)
    .order('date', { ascending: false })

  const { data: payouts } = await supabase
    .from('payouts')
    .select('*')
    .eq('member_id', params.id)
    .order('date', { ascending: false })

  const confirmedTotal  = (contributions || []).filter(c => c.status === 'confirmed').reduce((s, c) => s + Number(c.amount), 0)
  const pendingTotal    = (contributions || []).filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0)
  const totalPaidOut    = (payouts || []).filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0)

  // Build yearly grid — current year
  const year = new Date().getFullYear()
  const yearlyGrid = MONTHS_SHORT.map((month, i) => {
    const monthStr = `${year}-${String(i + 1).padStart(2, '0')}`
    const monthContribs = (contributions || []).filter(c => c.date.startsWith(monthStr))
    const confirmed = monthContribs.filter(c => c.status === 'confirmed')
    return {
      month,
      paid:    confirmed.length > 0,
      amount:  confirmed.reduce((s, c) => s + Number(c.amount), 0),
      pending: monthContribs.some(c => c.status === 'pending'),
    }
  })

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 20px', fontFamily: 'var(--font-body, sans-serif)' }}>

      {/* Back */}
      <Link
        href="/members"
        style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#9ca3af', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '24px' }}
      >
        ← Back to Members
      </Link>

      {/* Header card */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0a2412, #0f3d1e)',
          borderRadius: '20px', padding: '28px 32px', marginBottom: '24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px',
        }}
      >
        <div>
          <p style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'rgba(254,249,195,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
            Member Contribution Statement
          </p>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '1.75rem', color: '#fef9c3', margin: '0 0 4px' }}>{member.name}</h1>
          <p style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#ca8a04', margin: 0 }}>{stokvel.name}</p>
          {member.email && <p style={{ fontSize: '0.8rem', color: 'rgba(254,249,195,0.5)', margin: '4px 0 0', fontFamily: 'monospace' }}>{member.email}</p>}
        </div>
        <MemberStatementButton
          member={member}
          stokvelId={stokvel.id}
          stokvelName={stokvel.name}
          size="md"
          label="↓ Download PDF"
        />
      </div>

      {/* Summary stat boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Confirmed',  value: formatCurrency(confirmedTotal), color: '#16a34a' },
          { label: 'Pending',          value: formatCurrency(pendingTotal),   color: '#ca8a04' },
          { label: 'Total Received',   value: formatCurrency(totalPaidOut),   color: '#ca8a04' },
          { label: 'Monthly Amount',   value: formatCurrency(member.monthly_amount || stokvel.monthly_amount), color: '#0f3d1e' },
          { label: 'Payout Position',  value: member.payout_position ? `#${member.payout_position}` : '—', color: '#6b7280' },
          { label: 'Payments Made',    value: String(contributions?.length || 0), color: '#0f3d1e' },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              background: 'white', borderRadius: '14px', padding: '16px',
              border: '1px solid rgba(15,61,30,0.1)', boxShadow: '0 1px 3px rgba(15,61,30,0.06)',
            }}
          >
            <div style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.3rem', color: s.color, fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Current year grid */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid rgba(15,61,30,0.1)', marginBottom: '24px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(15,61,30,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: '1rem', fontWeight: 600, color: '#0a2412' }}>{year} Payment Grid</span>
          <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#9ca3af' }}>
            {yearlyGrid.filter(m => m.paid).length}/12 months paid
          </span>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
            {yearlyGrid.map((m, i) => {
              const isFuture = i > new Date().getMonth()
              return (
                <div
                  key={m.month}
                  style={{
                    borderRadius: '10px', padding: '10px 8px', textAlign: 'center',
                    background: m.paid ? 'rgba(22,163,74,0.08)' : m.pending ? 'rgba(202,138,4,0.06)' : isFuture ? 'rgba(248,250,248,0.8)' : 'rgba(220,38,38,0.05)',
                    border: `1px solid ${m.paid ? 'rgba(22,163,74,0.2)' : m.pending ? 'rgba(202,138,4,0.2)' : isFuture ? 'rgba(15,61,30,0.06)' : 'rgba(220,38,38,0.12)'}`,
                  }}
                >
                  <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#9ca3af', marginBottom: '4px' }}>{m.month}</div>
                  <div style={{ fontSize: '1rem' }}>
                    {m.paid ? '✓' : m.pending ? '⏳' : isFuture ? '·' : '✕'}
                  </div>
                  {m.paid && m.amount > 0 && (
                    <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: '#16a34a', marginTop: '2px' }}>
                      R{m.amount}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontFamily: 'monospace', fontSize: '0.7rem', color: '#9ca3af' }}>
            <span>✓ Paid</span><span>⏳ Pending</span><span>✕ Missed</span><span>· Future</span>
          </div>
        </div>
      </div>

      {/* Contribution history table */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid rgba(15,61,30,0.1)', marginBottom: '24px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(15,61,30,0.06)' }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: '1rem', fontWeight: 600, color: '#0a2412' }}>Contribution History</span>
        </div>
        {(contributions || []).length === 0 ? (
          <p style={{ textAlign: 'center', padding: '32px', color: '#9ca3af', fontSize: '0.875rem' }}>No contributions recorded yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(248,250,248,0.8)' }}>
                  {['Date', 'Amount', 'Method', 'Status', 'Notes'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.65rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(contributions || []).map((c, i) => (
                  <tr key={c.id} style={{ borderTop: '1px solid rgba(15,61,30,0.05)', background: i % 2 === 0 ? 'white' : 'rgba(248,250,248,0.4)' }}>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#374151' }}>{formatDate(c.date)}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 600, color: c.status === 'confirmed' ? '#16a34a' : '#ca8a04' }}>{formatCurrency(Number(c.amount))}</td>
                    <td style={{ padding: '10px 16px', color: '#6b7280', textTransform: 'capitalize' }}>{c.method}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem', fontFamily: 'monospace',
                        background: c.status === 'confirmed' ? 'rgba(22,163,74,0.1)' : c.status === 'pending' ? 'rgba(202,138,4,0.1)' : 'rgba(220,38,38,0.1)',
                        color: c.status === 'confirmed' ? '#16a34a' : c.status === 'pending' ? '#92400e' : '#dc2626',
                      }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#9ca3af', fontSize: '0.8rem' }}>{c.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payouts received */}
      {(payouts || []).length > 0 && (
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid rgba(15,61,30,0.1)', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(15,61,30,0.06)' }}>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: '1rem', fontWeight: 600, color: '#0a2412' }}>Payouts Received</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(248,250,248,0.8)' }}>
                  {['Date', 'Amount', 'Status', 'Notes'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.65rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(payouts || []).map((p, i) => (
                  <tr key={p.id} style={{ borderTop: '1px solid rgba(15,61,30,0.05)', background: i % 2 === 0 ? 'white' : 'rgba(248,250,248,0.4)' }}>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#374151' }}>{formatDate(p.date)}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 600, color: '#ca8a04' }}>{formatCurrency(Number(p.amount))}</td>
                    <td style={{ padding: '10px 16px', color: '#6b7280', textTransform: 'capitalize' }}>{p.status}</td>
                    <td style={{ padding: '10px 16px', color: '#9ca3af', fontSize: '0.8rem' }}>{p.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#d1d5db', textAlign: 'center' }}>
        Generated by StokvelOS · {new Date().toLocaleDateString('en-ZA')} · For record-keeping purposes only
      </p>
    </div>
  )
}
