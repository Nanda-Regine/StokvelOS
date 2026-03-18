'use client'

import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Badge } from '@/components/ui/Badge'
import type { Stokvel, RiskSnapshot, RiskLevel } from '@/types'

interface RiskClientProps {
  stokvel:   Stokvel
  snapshots: RiskSnapshot[]
}

const RISK_VARIANT: Record<RiskLevel, 'success' | 'warning' | 'danger' | 'info'> = {
  low:      'success',
  medium:   'warning',
  high:     'danger',
  critical: 'danger',
}

const TREND_VARIANT = {
  improving: 'success' as const,
  stable:    'neutral' as const,
  declining: 'danger'  as const,
}

const SEVERITY_COLOR: Record<string, string> = {
  low:      '#16a34a',
  medium:   '#f59e0b',
  high:     '#dc2626',
  critical: '#7c3aed',
}

export function RiskClient({ stokvel, snapshots }: RiskClientProps) {
  const [chartDays, setChartDays] = useState<7 | 14 | 30>(30)

  const latest  = snapshots[0] ?? null
  const chartData = snapshots
    .slice(0, chartDays)
    .reverse()
    .map(s => ({
      date:           s.snapshot_date.slice(5), // MM-DD
      compliance:     Math.round(s.compliance_rate),
      loanBook:       Math.round(s.loan_book_percent),
      membersAtRisk:  s.members_at_risk,
    }))

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Risk Monitor</h1>
          <p className="page-subtitle">{stokvel.name} · nightly AI analysis</p>
        </div>
        {latest && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)' }}>
            Last snapshot: {fmt(latest.snapshot_date)}
          </div>
        )}
      </div>

      {!latest ? (
        /* Empty state */
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px', padding: '64px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px', opacity: 0.3 }}>◬</div>
          <div style={{ fontFamily: 'var(--font-display)', color: 'rgba(255,255,255,0.4)', fontSize: '1rem', marginBottom: '8px' }}>
            No risk snapshots yet
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>
            The nightly cron job will generate the first snapshot tonight.
          </div>
        </div>
      ) : (
        <>
          {/* Latest snapshot card */}
          <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', padding: '24px', marginBottom: '24px',
          }}>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                  Current Risk Assessment
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <Badge variant={RISK_VARIANT[latest.risk_level]}>
                    {latest.risk_level.toUpperCase()} RISK
                  </Badge>
                  <Badge variant={TREND_VARIANT[latest.compliance_trend]}>
                    {latest.compliance_trend === 'improving' ? '▲' : latest.compliance_trend === 'declining' ? '▼' : '→'} {latest.compliance_trend}
                  </Badge>
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, maxWidth: '640px' }}>
                  {latest.ai_summary}
                </div>
              </div>

              {/* Key metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', minWidth: '200px' }}>
                {[
                  { label: 'Compliance',     value: `${Math.round(latest.compliance_rate)}%`, color: latest.compliance_rate >= 80 ? '#16a34a' : latest.compliance_rate >= 60 ? '#f59e0b' : '#dc2626' },
                  { label: 'Projected',      value: `R ${Math.round(latest.projected_collection / 1000)}k`, color: '#ca8a04' },
                  { label: 'Loan Book',      value: `${Math.round(latest.loan_book_percent)}%`, color: latest.loan_book_percent > 40 ? '#dc2626' : '#6b7280' },
                  { label: 'At-Risk Members',value: latest.members_at_risk, color: latest.members_at_risk > 0 ? '#f59e0b' : '#16a34a' },
                ].map(m => (
                  <div key={m.label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>{m.label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: m.color, fontWeight: 600 }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts */}
            {latest.alerts && latest.alerts.length > 0 && (
              <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                  Alerts ({latest.alerts.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {latest.alerts.map((alert, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '10px',
                      background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px 14px',
                      borderLeft: `3px solid ${SEVERITY_COLOR[alert.severity] ?? '#6b7280'}`,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: SEVERITY_COLOR[alert.severity] ?? '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                          {alert.type}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-body)' }}>
                          {alert.message}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Compliance trend chart */}
          {chartData.length > 1 && (
            <div style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px', padding: '24px',
            }}>
              <div className="flex items-center justify-between mb-6">
                <div style={{ fontFamily: 'var(--font-display)', color: '#fef9c3', fontSize: '0.95rem' }}>
                  Compliance Trend
                </div>
                <div className="flex gap-2">
                  {([7, 14, 30] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setChartDays(d)}
                      style={{
                        padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem',
                        fontFamily: 'var(--font-mono)', cursor: 'pointer',
                        border: chartDays === d ? '1px solid #ca8a04' : '1px solid rgba(255,255,255,0.1)',
                        background: chartDays === d ? 'rgba(202,138,4,0.12)' : 'transparent',
                        color: chartDays === d ? '#fef9c3' : 'rgba(255,255,255,0.4)',
                      }}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>

              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{ background: '#0f2d18', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
                    labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}
                    itemStyle={{ color: '#fef9c3' }}
                    formatter={(v: number) => [`${v}%`, 'Compliance']}
                  />
                  <Line
                    type="monotone"
                    dataKey="compliance"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={{ fill: '#16a34a', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#ca8a04' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Historical snapshots mini-list */}
          {snapshots.length > 1 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                Snapshot History ({snapshots.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {snapshots.slice(1, 8).map(s => (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '10px 14px',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', width: '80px' }}>
                      {s.snapshot_date}
                    </div>
                    <Badge variant={RISK_VARIANT[s.risk_level]}>{s.risk_level}</Badge>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                      {Math.round(s.compliance_rate)}% compliance
                    </div>
                    <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)' }}>
                      {s.members_at_risk} at risk
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
