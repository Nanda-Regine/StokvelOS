'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface ComplianceDonutProps {
  paidCount:    number
  totalCount:   number
  paidAmount:   number
  totalExpected: number
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { fill: string } }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs shadow-lg font-mono"
      style={{ background: '#0f3d1e', color: '#fef9c3', border: '1px solid rgba(202,138,4,0.3)' }}
    >
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full" style={{ background: p.payload.fill }} />
        {p.name}: {p.value}
      </div>
    </div>
  )
}

export function ComplianceDonut({ paidCount, totalCount, paidAmount, totalExpected }: ComplianceDonutProps) {
  const unpaid = Math.max(0, totalCount - paidCount)
  const pct    = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0

  const data = [
    { name: 'Paid',    value: paidCount, fill: '#16a34a' },
    { name: 'Unpaid',  value: unpaid,    fill: 'rgba(15,61,30,0.1)' },
  ]

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 160, height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={72}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Centre label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl leading-none" style={{ color: '#0a2412' }}>
            {pct}%
          </span>
          <span className="font-mono text-xs mt-0.5" style={{ color: '#9ca3af' }}>paid</span>
        </div>
      </div>

      <div className="text-center mt-3 space-y-1">
        <p className="font-mono text-xs" style={{ color: '#16a34a' }}>
          {paidCount} of {totalCount} members paid
        </p>
        <p className="font-mono text-xs" style={{ color: '#9ca3af' }}>
          {formatCurrency(paidAmount)} collected
        </p>
        {totalExpected > 0 && (
          <p className="font-mono text-xs" style={{ color: '#9ca3af' }}>
            of {formatCurrency(totalExpected)} expected
          </p>
        )}
      </div>
    </div>
  )
}
