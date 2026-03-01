'use client'

import { Badge } from '@/components/ui/Badge'
import { formatCurrency, MONTHS_SHORT, calcPercent } from '@/lib/utils'
import type { StokvelMember, Contribution } from '@/types'

interface AnnualGridProps {
  members:       StokvelMember[]
  contributions: Contribution[]
  defaultAmount: number
}

export function AnnualGrid({ members, contributions, defaultAmount }: AnnualGridProps) {
  const year = new Date().getFullYear()

  const rows = members.map(m => {
    const monthTotals = MONTHS_SHORT.map((_, idx) => {
      const paid = contributions.filter(c =>
        c.member_id === m.id &&
        c.status    === 'confirmed' &&
        new Date(c.date).getFullYear() === year &&
        new Date(c.date).getMonth()    === idx
      ).reduce((s, c) => s + Number(c.amount), 0)
      return paid
    })
    const totalPaid  = monthTotals.reduce((s, v) => s + v, 0)
    const monthlyAmt = m.monthly_amount || defaultAmount
    const target     = monthlyAmt * 12
    const pct        = calcPercent(totalPaid, target)
    return { member: m, monthTotals, totalPaid, target, pct, monthlyAmt }
  })

  if (!rows.length) {
    return (
      <div className="empty-state py-10">
        <div className="empty-sub">No members to report on.</div>
      </div>
    )
  }

  return (
    <div className="table-wrap">
      <table style={{ minWidth: '860px' }}>
        <thead>
          <tr>
            <th style={{ minWidth: '150px' }}>Member</th>
            {MONTHS_SHORT.map(m => (
              <th key={m} className="text-center" style={{ minWidth: '50px', padding: '8px 4px' }}>
                {m}
              </th>
            ))}
            <th className="text-right">Total Paid</th>
            <th className="text-right">Target</th>
            <th className="text-center">Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ member, monthTotals, totalPaid, target, pct }) => (
            <tr key={member.id}>
              <td>
                <div>
                  <div className="font-medium text-sm">{member.name}</div>
                  <div className="font-mono text-xs" style={{ color: '#9ca3af' }}>
                    {formatCurrency(member.monthly_amount || defaultAmount)}/mo
                  </div>
                </div>
              </td>
              {monthTotals.map((v, idx) => {
                const isPast   = idx < new Date().getMonth() || new Date().getFullYear() > year
                const isCurrent = idx === new Date().getMonth() && new Date().getFullYear() === year
                return (
                  <td
                    key={idx}
                    className="text-center"
                    style={{ padding: '6px 4px' }}
                  >
                    {v > 0 ? (
                      <div
                        className="mx-auto rounded-lg flex items-center justify-center font-mono text-xs font-medium"
                        style={{
                          width:      '40px',
                          height:     '28px',
                          background: 'rgba(22,163,74,0.12)',
                          color:      '#16a34a',
                          border:     '1px solid rgba(22,163,74,0.2)',
                        }}
                      >
                        ✓
                      </div>
                    ) : isPast || isCurrent ? (
                      <div
                        className="mx-auto rounded-lg flex items-center justify-center font-mono text-xs"
                        style={{
                          width:      '40px',
                          height:     '28px',
                          background: isCurrent ? 'rgba(202,138,4,0.08)' : 'rgba(220,38,38,0.06)',
                          color:      isCurrent ? '#ca8a04' : '#dc2626',
                          border:     `1px solid ${isCurrent ? 'rgba(202,138,4,0.2)' : 'rgba(220,38,38,0.15)'}`,
                        }}
                      >
                        —
                      </div>
                    ) : (
                      <div style={{ color: '#e5e7eb', textAlign: 'center', fontSize: '0.75rem' }}>·</div>
                    )}
                  </td>
                )
              })}
              <td className="text-right font-mono text-sm font-medium" style={{ color: '#0f3d1e' }}>
                {formatCurrency(totalPaid)}
              </td>
              <td className="text-right font-mono text-xs" style={{ color: '#9ca3af' }}>
                {formatCurrency(target)}
              </td>
              <td className="text-center">
                <Badge variant={pct >= 100 ? 'success' : pct >= 50 ? 'warning' : 'danger'}>
                  {pct}%
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
        {/* Totals row */}
        <tfoot>
          <tr style={{ borderTop: '2px solid rgba(15,61,30,0.1)' }}>
            <td className="font-mono text-xs font-medium py-3" style={{ color: '#0f3d1e' }}>
              TOTALS
            </td>
            {MONTHS_SHORT.map((_, idx) => {
              const monthTotal = rows.reduce((s, r) => s + r.monthTotals[idx], 0)
              return (
                <td key={idx} className="text-center py-3">
                  {monthTotal > 0 ? (
                    <span className="font-mono text-xs" style={{ color: '#16a34a' }}>
                      {formatCurrency(monthTotal)}
                    </span>
                  ) : (
                    <span style={{ color: '#e5e7eb' }}>·</span>
                  )}
                </td>
              )
            })}
            <td className="text-right font-mono text-sm font-medium py-3" style={{ color: '#16a34a' }}>
              {formatCurrency(rows.reduce((s, r) => s + r.totalPaid, 0))}
            </td>
            <td className="text-right font-mono text-xs py-3" style={{ color: '#9ca3af' }}>
              {formatCurrency(rows.reduce((s, r) => s + r.target, 0))}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
