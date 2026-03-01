'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { formatCurrency, MONTHS_SHORT } from '@/lib/utils'
import type { Contribution } from '@/types'

interface MonthlyChartProps {
  contributions: Contribution[]
  expectedMonthly: number
}

interface TooltipPayload {
  name: string
  value: number
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-xl p-3 text-sm shadow-lg"
      style={{ background: '#0f3d1e', border: '1px solid rgba(202,138,4,0.3)', color: '#fef9c3' }}
    >
      <p className="font-mono text-xs mb-2" style={{ color: 'rgba(254,249,195,0.6)' }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-xs">{p.name}:</span>
          <span className="font-mono text-xs font-medium" style={{ color: '#ca8a04' }}>
            {formatCurrency(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function MonthlyChart({ contributions, expectedMonthly }: MonthlyChartProps) {
  const year = new Date().getFullYear()

  const data = MONTHS_SHORT.map((month, idx) => {
    const monthContribs = contributions.filter(c => {
      const d = new Date(c.date)
      return d.getMonth() === idx && d.getFullYear() === year
    })
    const confirmed = monthContribs.filter(c => c.status === 'confirmed').reduce((s, c) => s + Number(c.amount), 0)
    const pending   = monthContribs.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0)
    return { month, confirmed, pending, target: expectedMonthly }
  })

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barSize={14}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,61,30,0.08)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fontFamily: 'var(--font-mono)', fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => v >= 1000 ? `R${(v / 1000).toFixed(0)}k` : `R${v}`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(15,61,30,0.04)' }} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-mono)', paddingTop: '12px' }}
        />
        <Bar dataKey="confirmed" name="Confirmed" fill="#16a34a" radius={[3, 3, 0, 0]} />
        <Bar dataKey="pending"   name="Pending"   fill="#ca8a04" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
