'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { AnnualGrid }      from '@/components/dashboard/AnnualGrid'
import { ComplianceDonut } from '@/components/dashboard/ComplianceDonut'
import { Badge }           from '@/components/ui/Badge'
import { Button }          from '@/components/ui/Button'
import {
  formatCurrency, formatCurrencyShort, formatDate,
  calcPercent, MONTHS_SHORT, MONTHS_FULL,
} from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Contribution, StokvelMember, Stokvel } from '@/types'

// Lazy load recharts chart to avoid SSR issues
const MonthlyChart = dynamic(
  () => import('@/components/dashboard/MonthlyChart').then(m => m.MonthlyChart),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl" style={{ background: 'rgba(15,61,30,0.05)' }} /> }
)

interface ReportsClientProps {
  stokvel:       Stokvel
  contributions: Contribution[]
  members:       StokvelMember[]
  payouts:       Array<Record<string, unknown>>
}

type TabKey = 'overview' | 'annual' | 'payouts'

export function ReportsClient({ stokvel, contributions, members, payouts }: ReportsClientProps) {
  const [tab,            setTab]            = useState<TabKey>('overview')
  const [exportLoading,  setExportLoading]  = useState(false)

  const activeMembers = members.filter(m => m.status === 'active')
  const now           = new Date()
  const year          = now.getFullYear()

  // ── Current month stats ─────────────────────────────────────
  const currentMonthStats = useMemo(() => {
    const ms      = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const monthly = contributions.filter(c => c.date >= ms)
    const paidIds = new Set(monthly.filter(c => c.status === 'confirmed').map(c => c.member_id))
    const confirmed = monthly.filter(c => c.status === 'confirmed').reduce((s, c) => s + Number(c.amount), 0)
    const expected  = activeMembers.reduce((s, m) => s + (m.monthly_amount || stokvel.monthly_amount), 0)
    return { paidCount: paidIds.size, confirmed, expected }
  }, [contributions, activeMembers, stokvel.monthly_amount, now, year])

  // ── Annual stats ─────────────────────────────────────────────
  const annualStats = useMemo(() => {
    const yearContribs = contributions.filter(c => new Date(c.date).getFullYear() === year)
    const confirmed    = yearContribs.filter(c => c.status === 'confirmed').reduce((s, c) => s + Number(c.amount), 0)
    const pending      = yearContribs.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0)
    const target       = activeMembers.reduce((s, m) => s + (m.monthly_amount || stokvel.monthly_amount), 0) * 12
    const pct          = calcPercent(confirmed, target)
    return { confirmed, pending, target, pct }
  }, [contributions, activeMembers, stokvel.monthly_amount, year])

  // ── All-time stats ────────────────────────────────────────────
  const allTimeTotal = contributions
    .filter(c => c.status === 'confirmed')
    .reduce((s, c) => s + Number(c.amount), 0)

  // ── Top contributors ─────────────────────────────────────────
  const topContributors = useMemo(() => {
    const totals: Record<string, number> = {}
    contributions
      .filter(c => c.status === 'confirmed' && new Date(c.date).getFullYear() === year)
      .forEach(c => { totals[c.member_id] = (totals[c.member_id] || 0) + Number(c.amount) })
    return Object.entries(totals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id, total]) => ({
        member: members.find(m => m.id === id),
        total,
      }))
      .filter(x => x.member)
  }, [contributions, members, year])

  // ── Monthly breakdown table ───────────────────────────────────
  const monthlyBreakdown = useMemo(() => {
    return MONTHS_FULL.map((name, idx) => {
      const monthContribs = contributions.filter(c => {
        const d = new Date(c.date)
        return d.getMonth() === idx && d.getFullYear() === year
      })
      const confirmed = monthContribs.filter(c => c.status === 'confirmed').reduce((s, c) => s + Number(c.amount), 0)
      const pending   = monthContribs.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0)
      const paidIds   = new Set(monthContribs.filter(c => c.status === 'confirmed').map(c => c.member_id))
      const expected  = activeMembers.reduce((s, m) => s + (m.monthly_amount || stokvel.monthly_amount), 0)
      return {
        name, idx, confirmed, pending, expected,
        count: monthContribs.length,
        compliance: calcPercent(paidIds.size, activeMembers.length),
        isFuture: idx > now.getMonth(),
      }
    })
  }, [contributions, activeMembers, stokvel.monthly_amount, year, now])

  // ── PDF Export ────────────────────────────────────────────────
  async function exportPDF() {
    setExportLoading(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()

      // ── Cover ──────────────────────────────────────────────
      doc.setFillColor(10, 36, 18)
      doc.rect(0, 0, pageW, 60, 'F')

      doc.setTextColor(254, 249, 195)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text(stokvel.name, 15, 28)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(202, 138, 4)
      doc.text(`Annual Report ${year}  ·  Generated ${new Date().toLocaleDateString('en-ZA')}`, 15, 38)

      doc.setTextColor(254, 249, 195)
      doc.setFontSize(9)
      doc.text(`${stokvel.type.toUpperCase()} STOKVEL  ·  ${stokvel.province || 'SOUTH AFRICA'}  ·  ${activeMembers.length} ACTIVE MEMBERS`, 15, 48)

      // ── Summary ────────────────────────────────────────────
      let y = 72
      doc.setTextColor(10, 36, 18)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Financial Summary', 15, y)
      y += 8

      const summaryData = [
        ['Annual Target',      formatCurrency(annualStats.target),    `${year}`],
        ['Total Collected',    formatCurrency(annualStats.confirmed),  `${annualStats.pct}% of target`],
        ['Pending Payments',   formatCurrency(annualStats.pending),    'Awaiting confirmation'],
        ['All-Time Total',     formatCurrency(allTimeTotal),           'All confirmed payments'],
        ['Active Members',     String(activeMembers.length),           'Contributing members'],
        ['Monthly Target',     formatCurrency(annualStats.target / 12), 'Expected per month'],
      ]

      autoTable(doc, {
        startY: y,
        head: [['Item', 'Amount / Value', 'Notes']],
        body: summaryData,
        theme: 'striped',
        headStyles: { fillColor: [10, 36, 18], textColor: [254, 249, 195], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: 'bold' } },
        margin: { left: 15, right: 15 },
      })

      // ── Monthly Breakdown ──────────────────────────────────
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(10, 36, 18)
      doc.text('Monthly Breakdown', 15, y)
      y += 4

      const monthRows = monthlyBreakdown
        .filter(m => !m.isFuture || m.confirmed > 0)
        .map(m => [
          m.name,
          formatCurrency(m.confirmed),
          formatCurrency(m.pending),
          formatCurrency(m.expected),
          `${m.compliance}%`,
        ])

      autoTable(doc, {
        startY: y,
        head: [['Month', 'Confirmed', 'Pending', 'Expected', 'Compliance']],
        body: monthRows,
        theme: 'striped',
        headStyles: { fillColor: [10, 36, 18], textColor: [254, 249, 195], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 15, right: 15 },
      })

      // ── Member Report ──────────────────────────────────────
      doc.addPage()
      y = 20
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(10, 36, 18)
      doc.text('Member Contribution Report', 15, y)
      y += 4

      const memberRows = members.map(m => {
        const memberContribs = contributions
          .filter(c => c.member_id === m.id && c.status === 'confirmed' && new Date(c.date).getFullYear() === year)
        const total  = memberContribs.reduce((s, c) => s + Number(c.amount), 0)
        const target = (m.monthly_amount || stokvel.monthly_amount) * 12
        const pct    = calcPercent(total, target)
        return [m.name, formatCurrency(m.monthly_amount || stokvel.monthly_amount), formatCurrency(total), formatCurrency(target), `${pct}%`, m.status]
      })

      autoTable(doc, {
        startY: y,
        head: [['Member', 'Monthly', 'Paid (YTD)', 'Annual Target', 'Rate', 'Status']],
        body: memberRows,
        theme: 'striped',
        headStyles: { fillColor: [10, 36, 18], textColor: [254, 249, 195], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 15, right: 15 },
      })

      // ── Footer ─────────────────────────────────────────────
      const pages = doc.getNumberOfPages()
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(180, 180, 180)
        doc.text(`StokvelOS  ·  ${stokvel.name}  ·  Page ${i} of ${pages}`, 15, 290)
      }

      doc.save(`${stokvel.name.replace(/\s+/g, '_')}_Report_${year}.pdf`)
      toast.success('PDF downloaded!')
    } catch (err) {
      console.error(err)
      toast.error('PDF generation failed.')
    } finally {
      setExportLoading(false)
    }
  }

  function exportCSV() {
    const headers = ['Member', 'Month', 'Date', 'Amount (R)', 'Method', 'Status']
    const rows    = contributions.map(c => {
      const m = members.find(mb => mb.id === c.member_id)
      return [
        m?.name || 'Unknown',
        MONTHS_SHORT[new Date(c.date).getMonth()],
        c.date,
        c.amount,
        c.method,
        c.status,
      ]
    })
    const csv  = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `${stokvel.name.replace(/\s+/g, '_')}_contributions_${year}.csv`
    a.click()
    toast.success('CSV exported!')
  }

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="font-mono text-xs mt-1" style={{ color: '#9ca3af' }}>
            {stokvel.name} · {year}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="md" onClick={exportCSV}>
            ↓ CSV
          </Button>
          <Button variant="gold" size="md" onClick={exportPDF} loading={exportLoading}>
            ↓ PDF Report
          </Button>
        </div>
      </div>

      <div className="page-body space-y-5">

        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl w-fit"
          style={{ background: 'rgba(15,61,30,0.06)' }}
        >
          {([
            { key: 'overview', label: '📊 Overview'     },
            { key: 'annual',   label: '📅 Annual Grid'  },
            { key: 'payouts',  label: '💸 Payouts'      },
          ] as { key: TabKey; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-4 py-2 rounded-lg text-sm font-mono transition-all duration-200"
              style={{
                background: tab === t.key ? '#0f3d1e' : 'transparent',
                color:      tab === t.key ? '#fef9c3' : '#6b7280',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ─────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-5">

            {/* Top stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Annual Collected',  value: formatCurrencyShort(annualStats.confirmed),       sub: `${annualStats.pct}% of target`,          color: '#16a34a' },
                { label: 'Annual Target',     value: formatCurrencyShort(annualStats.target),          sub: `${activeMembers.length} members × 12`,    color: '#0f3d1e' },
                { label: 'All-Time Pot',      value: formatCurrencyShort(allTimeTotal),                sub: 'All confirmed payments',                   color: '#ca8a04' },
                { label: 'This Month',        value: formatCurrencyShort(currentMonthStats.confirmed), sub: `of ${formatCurrency(currentMonthStats.expected)} expected`, color: currentMonthStats.confirmed >= currentMonthStats.expected ? '#16a34a' : '#ca8a04' },
              ].map((s, i) => (
                <div key={i} className="rounded-2xl border p-4 bg-white"
                  style={{ borderColor: 'rgba(15,61,30,0.1)', boxShadow: '0 1px 3px rgba(15,61,30,0.06)' }}>
                  <div className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: '#9ca3af' }}>{s.label}</div>
                  <div className="font-display text-2xl leading-tight" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Chart + Donut */}
            <div className="grid md:grid-cols-[1fr_220px] gap-5">
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Monthly Collections {year}</span>
                  <span className="font-mono text-xs" style={{ color: '#9ca3af' }}>Confirmed vs Pending</span>
                </div>
                <div className="card-body">
                  <MonthlyChart
                    contributions={contributions}
                    expectedMonthly={annualStats.target / 12}
                  />
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">This Month</span>
                </div>
                <div className="card-body flex items-center justify-center py-6">
                  <ComplianceDonut
                    paidCount={currentMonthStats.paidCount}
                    totalCount={activeMembers.length}
                    paidAmount={currentMonthStats.confirmed}
                    totalExpected={currentMonthStats.expected}
                  />
                </div>
              </div>
            </div>

            {/* Monthly breakdown table */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Month-by-Month Breakdown</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th className="text-right">Confirmed</th>
                      <th className="text-right">Pending</th>
                      <th className="text-right">Expected</th>
                      <th className="text-center">Compliance</th>
                      <th className="text-center">Payments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyBreakdown.filter(m => !m.isFuture || m.confirmed > 0).map(m => (
                      <tr key={m.idx} style={{ opacity: m.isFuture ? 0.45 : 1 }}>
                        <td className="font-medium">{m.name}</td>
                        <td className="text-right font-mono text-sm" style={{ color: '#16a34a' }}>
                          {m.confirmed > 0 ? formatCurrency(m.confirmed) : <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>
                        <td className="text-right font-mono text-sm" style={{ color: '#ca8a04' }}>
                          {m.pending > 0 ? formatCurrency(m.pending) : <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>
                        <td className="text-right font-mono text-xs" style={{ color: '#9ca3af' }}>
                          {formatCurrency(m.expected)}
                        </td>
                        <td className="text-center">
                          {!m.isFuture ? (
                            <Badge variant={m.compliance >= 80 ? 'success' : m.compliance >= 50 ? 'warning' : 'danger'}>
                              {m.compliance}%
                            </Badge>
                          ) : (
                            <span className="font-mono text-xs" style={{ color: '#d1d5db' }}>—</span>
                          )}
                        </td>
                        <td className="text-center font-mono text-sm" style={{ color: '#9ca3af' }}>
                          {m.count || <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid rgba(15,61,30,0.1)' }}>
                      <td className="font-mono text-xs font-medium py-3" style={{ color: '#0f3d1e' }}>YTD TOTAL</td>
                      <td className="text-right font-mono text-sm font-medium py-3" style={{ color: '#16a34a' }}>
                        {formatCurrency(annualStats.confirmed)}
                      </td>
                      <td className="text-right font-mono text-sm py-3" style={{ color: '#ca8a04' }}>
                        {formatCurrency(annualStats.pending)}
                      </td>
                      <td className="text-right font-mono text-xs py-3" style={{ color: '#9ca3af' }}>
                        {formatCurrency(annualStats.target)}
                      </td>
                      <td className="text-center py-3">
                        <Badge variant={annualStats.pct >= 80 ? 'success' : annualStats.pct >= 50 ? 'warning' : 'danger'}>
                          {annualStats.pct}%
                        </Badge>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Top contributors */}
            {topContributors.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Top Contributors {year}</span>
                </div>
                <div className="card-body space-y-3">
                  {topContributors.map(({ member, total }, i) => {
                    const max = topContributors[0].total
                    const pct = calcPercent(total, max)
                    return (
                      <div key={member!.id} className="flex items-center gap-3">
                        <span
                          className="font-mono text-xs w-5 text-center flex-shrink-0"
                          style={{ color: i === 0 ? '#ca8a04' : '#9ca3af' }}
                        >
                          {i === 0 ? '🏆' : `${i + 1}`}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">{member!.name}</span>
                            <span className="font-mono text-sm ml-2 flex-shrink-0" style={{ color: '#16a34a' }}>
                              {formatCurrency(total)}
                            </span>
                          </div>
                          <div className="progress-track">
                            <div
                              className="progress-fill"
                              style={{
                                width: `${pct}%`,
                                background: i === 0 ? '#ca8a04' : '#16a34a',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ANNUAL GRID TAB ──────────────────────────────── */}
        {tab === 'annual' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Annual Contribution Grid — {year}</span>
              <span className="font-mono text-xs" style={{ color: '#9ca3af' }}>
                ✓ = paid  ·  — = missed  ·  · = future
              </span>
            </div>
            <AnnualGrid
              members={members.filter(m => m.status === 'active')}
              contributions={contributions}
              defaultAmount={stokvel.monthly_amount}
            />
          </div>
        )}

        {/* ── PAYOUTS TAB ──────────────────────────────────── */}
        {tab === 'payouts' && (
          <div className="space-y-5">
            {/* Payout queue */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Payout Queue</span>
                <Badge variant="info">{stokvel.payout_frequency}</Badge>
              </div>
              <div className="table-wrap">
                {members.filter(m => m.status === 'active' && m.payout_position).length > 0 ? (
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>Pos</th>
                        <th>Member</th>
                        <th className="text-right">Expected Payout</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members
                        .filter(m => m.status === 'active')
                        .sort((a, b) => (a.payout_position || 99) - (b.payout_position || 99))
                        .map((m, i) => {
                          const received = (payouts as Array<{ member_id: string }>).some(p => p.member_id === m.id)
                          return (
                            <tr key={m.id}>
                              <td className="font-mono text-sm text-center" style={{ color: i === 0 ? '#ca8a04' : '#9ca3af' }}>
                                {i === 0 ? '→' : m.payout_position || i + 1}
                              </td>
                              <td>
                                <span className="font-medium" style={{ color: i === 0 ? '#0a2412' : undefined }}>
                                  {m.name}
                                </span>
                                {i === 0 && (
                                  <span
                                    className="ml-2 px-2 py-0.5 rounded-full text-xs font-mono"
                                    style={{ background: 'rgba(202,138,4,0.1)', color: '#ca8a04' }}
                                  >
                                    Next up
                                  </span>
                                )}
                              </td>
                              <td className="text-right font-mono font-medium" style={{ color: '#0f3d1e' }}>
                                {formatCurrency(
                                  members.reduce((s, mb) => s + (mb.monthly_amount || stokvel.monthly_amount), 0)
                                )}
                              </td>
                              <td>
                                <Badge variant={received ? 'success' : 'neutral'}>
                                  {received ? 'Paid out' : 'Pending'}
                                </Badge>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-state py-10">
                    <div className="empty-icon">💸</div>
                    <div className="empty-title">No payout positions set</div>
                    <div className="empty-sub">Assign payout positions to members in the Members page.</div>
                  </div>
                )}
              </div>
            </div>

            {/* Payout history */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Payout History</span>
              </div>
              <div className="table-wrap">
                {(payouts as Array<Record<string, unknown>>).length > 0 ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th className="text-right">Amount</th>
                        <th>Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(payouts as Array<Record<string, unknown>>).map((p) => (
                        <tr key={p.id as string}>
                          <td className="font-medium">
                            {(p.stokvel_members as { name: string } | null)?.name || 'Unknown'}
                          </td>
                          <td className="text-right font-mono font-medium" style={{ color: '#0f3d1e' }}>
                            {formatCurrency(p.amount as number)}
                          </td>
                          <td className="font-mono text-xs">{formatDate(p.date as string)}</td>
                          <td>
                            <Badge variant={p.status === 'paid' ? 'success' : 'warning'}>
                              {p.status as string}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-state py-10">
                    <div className="empty-sub">No payouts recorded yet.</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
