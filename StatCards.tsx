'use client'

import { formatCurrency, formatCurrencyShort, calcPercent, getComplianceColor } from '@/lib/utils'
import type { DashboardStats, Stokvel } from '@/types'
import Link from 'next/link'

interface StatCardsProps {
  stats:   DashboardStats
  stokvel: Stokvel
}

export function StatCards({ stats, stokvel }: StatCardsProps) {
  const compliancePct = calcPercent(stats.paidThisMonth, stats.memberCount)

  return (
    <div className="stat-grid">
      {/* Current Pot */}
      <div className="stat-card" style={{ animationDelay: '0.05s' }}>
        <div className="stat-label">Current Pot</div>
        <div className="stat-value">{formatCurrencyShort(stats.potTotal)}</div>
        <div className="stat-sub">Total confirmed contributions</div>
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl"
          style={{ background: 'linear-gradient(90deg, #16a34a, #ca8a04)' }}
        />
      </div>

      {/* Next Payout */}
      <div className="stat-card" style={{ animationDelay: '0.1s' }}>
        <div className="stat-label">Next Payout</div>
        {stats.nextPayout ? (
          <>
            <div className="stat-value" style={{ fontSize: '1.3rem', paddingTop: '4px' }}>
              {stats.nextPayout.name.split(' ')[0]}
            </div>
            <div className="stat-sub">
              {stokvel.payout_frequency} · Position {stats.nextPayout.payout_position || 1}
            </div>
          </>
        ) : (
          <>
            <div className="stat-value" style={{ fontSize: '1.5rem' }}>—</div>
            <div className="stat-sub">No queue set</div>
          </>
        )}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl"
          style={{ background: '#ca8a04' }}
        />
      </div>

      {/* Paid This Month */}
      <div className="stat-card" style={{ animationDelay: '0.15s' }}>
        <div className="stat-label">Paid This Month</div>
        <div className="stat-value">{stats.paidThisMonth} / {stats.memberCount}</div>
        <div className="stat-sub flex items-center gap-2">
          <span className={getComplianceColor(compliancePct)}>{compliancePct}% compliance</span>
        </div>
        {/* Mini progress bar */}
        <div className="progress-track mt-3">
          <div
            className="progress-fill"
            style={{
              width: `${compliancePct}%`,
              background: compliancePct >= 80 ? '#16a34a' : compliancePct >= 50 ? '#ca8a04' : '#dc2626',
            }}
          />
        </div>
      </div>

      {/* Active Members */}
      <div className="stat-card" style={{ animationDelay: '0.2s' }}>
        <div className="stat-label">Active Members</div>
        <div className="stat-value">{stats.memberCount}</div>
        <div className="stat-sub">
          {stats.outstandingCount > 0 ? (
            <span style={{ color: '#dc2626' }}>
              {stats.outstandingCount} outstanding
            </span>
          ) : (
            <span style={{ color: '#16a34a' }}>All paid ✓</span>
          )}
        </div>
        <Link
          href="/members"
          className="absolute bottom-4 right-4 text-xs font-mono hover:underline"
          style={{ color: '#ca8a04' }}
        >
          View all →
        </Link>
      </div>
    </div>
  )
}
