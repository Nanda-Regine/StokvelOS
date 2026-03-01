// lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, isValid } from 'date-fns'

// ── Tailwind class merger ─────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Currency formatting (ZAR) ─────────────────────────────────
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatCurrencyShort(amount: number): string {
  if (amount >= 1_000_000) return `R${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `R${(amount / 1_000).toFixed(1)}k`
  return `R${amount.toFixed(0)}`
}

// ── Date formatting ───────────────────────────────────────────
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return '—'
  return format(d, 'd MMM yyyy')
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return '—'
  return format(d, 'd MMM')
}

export function formatMonth(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return '—'
  return format(d, 'MMMM yyyy')
}

export function formatDateInput(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return ''
  return format(d, 'yyyy-MM-dd')
}

// ── Phone number formatting (South African) ──────────────────
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('27') && cleaned.length === 11) {
    return `+27 ${cleaned.slice(2, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`
  }
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`
  }
  return phone
}

export function phoneToWhatsApp(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('0')) return '27' + cleaned.slice(1)
  if (cleaned.startsWith('27')) return cleaned
  return cleaned
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const wa = phoneToWhatsApp(phone)
  return `https://wa.me/${wa}?text=${encodeURIComponent(message)}`
}

// ── Percentage ────────────────────────────────────────────────
export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

export function calcPercent(value: number, total: number): number {
  if (total === 0) return 0
  return Math.min(100, Math.round((value / total) * 100))
}

// ── Month helpers ─────────────────────────────────────────────
export const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December']

export function getCurrentMonth(): { month: number; year: number } {
  const now = new Date()
  return { month: now.getMonth(), year: now.getFullYear() }
}

export function isCurrentMonth(date: string): boolean {
  const d = parseISO(date)
  const now = new Date()
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

// ── ID generator ──────────────────────────────────────────────
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// ── Status helpers ────────────────────────────────────────────
export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export function getPaymentStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'paid':        return 'success'
    case 'pending':     return 'warning'
    case 'late':        return 'danger'
    case 'outstanding': return 'info'
    default:            return 'neutral'
  }
}

export function getContributionStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'confirmed': return 'success'
    case 'pending':   return 'warning'
    case 'rejected':  return 'danger'
    default:          return 'neutral'
  }
}

export function getMemberStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'active':    return 'success'
    case 'inactive':  return 'neutral'
    case 'suspended': return 'danger'
    default:          return 'neutral'
  }
}

// ── Stokvel type emoji ────────────────────────────────────────
export const STOKVEL_TYPE_ICONS: Record<string, string> = {
  general:    '🤝',
  grocery:    '🛒',
  burial:     '🕊️',
  investment: '📈',
  christmas:  '🎄',
  other:      '⭐',
}

export const PAYMENT_METHOD_ICONS: Record<string, string> = {
  cash:     '💵',
  eft:      '🏦',
  card:     '💳',
  snapscan: '📱',
  ozow:     '⚡',
}

// ── Compliance rate ───────────────────────────────────────────
export function getComplianceColor(rate: number): string {
  if (rate >= 80) return 'text-forest-600'
  if (rate >= 50) return 'text-earth-600'
  return 'text-red-600'
}

export function getComplianceBg(rate: number): string {
  if (rate >= 80) return 'bg-forest-500'
  if (rate >= 50) return 'bg-earth-500'
  return 'bg-red-500'
}

// ── Truncate text ─────────────────────────────────────────────
export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + '…' : str
}

// ── Initials from name ────────────────────────────────────────
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ── South African provinces ───────────────────────────────────
export const SA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
]
