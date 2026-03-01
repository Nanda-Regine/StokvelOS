'use client'

import { useState, useMemo } from 'react'
import { formatCurrency, MONTHS_FULL } from '@/lib/utils'
import type { Contribution } from '@/types'

interface ContributionCalendarProps {
  contributions: Contribution[]
  onDayClick?:   (date: string) => void
}

export function ContributionCalendar({ contributions, onDayClick }: ContributionCalendarProps) {
  const today = new Date()
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  function prev() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function next() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const monthData = useMemo(() => {
    const filtered = contributions.filter(c => {
      const d = new Date(c.date)
      return d.getMonth() === viewMonth && d.getFullYear() === viewYear
    })

    // Group by day
    const byDay: Record<number, { confirmed: number; pending: number; count: number }> = {}
    filtered.forEach(c => {
      const day = new Date(c.date).getDate()
      if (!byDay[day]) byDay[day] = { confirmed: 0, pending: 0, count: 0 }
      byDay[day].count++
      if (c.status === 'confirmed') byDay[day].confirmed += Number(c.amount)
      else if (c.status === 'pending') byDay[day].pending += Number(c.amount)
    })

    const confirmed = filtered.filter(c => c.status === 'confirmed').reduce((s, c) => s + Number(c.amount), 0)
    const pending   = filtered.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0)

    return { byDay, confirmed, pending, count: filtered.length }
  }, [contributions, viewMonth, viewYear])

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const offset      = firstDay === 0 ? 6 : firstDay - 1 // Mon-first

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={prev}
          className="btn btn-ghost btn-sm w-8 h-8 p-0 text-lg"
          aria-label="Previous month"
        >
          ←
        </button>
        <span className="font-display text-base" style={{ color: '#0a2412' }}>
          {MONTHS_FULL[viewMonth]} {viewYear}
        </span>
        <button
          onClick={next}
          className="btn btn-ghost btn-sm w-8 h-8 p-0 text-lg"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div
            key={d}
            className="text-center font-mono text-xs py-1"
            style={{ color: '#9ca3af' }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty offset cells */}
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`e-${i}`} />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day     = i + 1
          const dayData = monthData.byDay[day]
          const isToday = (
            day === today.getDate() &&
            viewMonth === today.getMonth() &&
            viewYear  === today.getFullYear()
          )
          const hasPayment = !!dayData
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

          return (
            <button
              key={day}
              onClick={() => hasPayment && onDayClick?.(dateStr)}
              className="relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all duration-150"
              style={{
                background: isToday
                  ? '#0f3d1e'
                  : hasPayment
                  ? dayData.confirmed > 0
                    ? 'rgba(22,163,74,0.1)'
                    : 'rgba(202,138,4,0.1)'
                  : 'transparent',
                color: isToday ? '#fef9c3' : '#374151',
                cursor: hasPayment ? 'pointer' : 'default',
                border: isToday
                  ? '1px solid #0f3d1e'
                  : hasPayment
                  ? `1px solid ${dayData.confirmed > 0 ? 'rgba(22,163,74,0.3)' : 'rgba(202,138,4,0.3)'}`
                  : '1px solid transparent',
              }}
              title={hasPayment
                ? `${dayData.count} payment${dayData.count > 1 ? 's' : ''} · ${formatCurrency(dayData.confirmed + dayData.pending)}`
                : undefined}
            >
              <span className="font-mono text-xs">{day}</span>

              {/* Payment indicator dot */}
              {hasPayment && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayData.confirmed > 0 && (
                    <div
                      className="w-1 h-1 rounded-full"
                      style={{ background: '#16a34a' }}
                    />
                  )}
                  {dayData.pending > 0 && (
                    <div
                      className="w-1 h-1 rounded-full"
                      style={{ background: '#ca8a04' }}
                    />
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Month summary */}
      <div
        className="mt-4 rounded-xl p-4"
        style={{ background: 'rgba(15,61,30,0.03)', border: '1px solid rgba(15,61,30,0.08)' }}
      >
        <div className="font-mono text-xs uppercase tracking-wider mb-3" style={{ color: '#9ca3af' }}>
          {MONTHS_FULL[viewMonth]} Summary
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="font-display text-lg" style={{ color: '#0a2412' }}>
              {monthData.count}
            </div>
            <div className="text-xs" style={{ color: '#9ca3af' }}>Payments</div>
          </div>
          <div>
            <div className="font-display text-lg" style={{ color: '#16a34a' }}>
              {formatCurrency(monthData.confirmed)}
            </div>
            <div className="text-xs" style={{ color: '#9ca3af' }}>Confirmed</div>
          </div>
          <div>
            <div className="font-display text-lg" style={{ color: '#ca8a04' }}>
              {formatCurrency(monthData.pending)}
            </div>
            <div className="text-xs" style={{ color: '#9ca3af' }}>Pending</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: '#6b7280' }}>
          <div className="w-2 h-2 rounded-full" style={{ background: '#16a34a' }} />
          Confirmed
        </div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: '#6b7280' }}>
          <div className="w-2 h-2 rounded-full" style={{ background: '#ca8a04' }} />
          Pending
        </div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: '#6b7280' }}>
          <div className="w-3 h-3 rounded-md" style={{ background: '#0f3d1e' }} />
          Today
        </div>
      </div>
    </div>
  )
}
