'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Stokvel } from '@/types'

interface NavItem {
  href: string
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',     label: 'Dashboard',      icon: '◈' },
  { href: '/members',       label: 'Members',         icon: '◉' },
  { href: '/contributions', label: 'Contributions',   icon: '◎' },
  { href: '/meetings',      label: 'Meetings',        icon: '◍' },
  { href: '/reports',       label: 'Reports',         icon: '◐' },
  { href: '/settings',      label: 'Settings',        icon: '◑' },
]

interface SidebarProps {
  stokvel?: Stokvel | null
  userName?: string
}

export function Sidebar({ stokvel, userName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Signed out successfully')
    router.push('/auth/login')
  }

  return (
    <aside className="sidebar flex flex-col">
      {/* Brand */}
      <div className="px-4 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-display text-lg font-bold flex-shrink-0"
            style={{ background: '#ca8a04', color: '#0a2412' }}
          >
            S
          </div>
          <div className="min-w-0">
            <div
              className="font-display text-base leading-tight truncate"
              style={{ color: '#fef9c3' }}
            >
              {stokvel?.name || 'StokvelOS'}
            </div>
            <div
              className="font-mono text-xs uppercase tracking-wider truncate mt-0.5"
              style={{ color: 'rgba(254,249,195,0.35)' }}
            >
              {stokvel?.type || 'Management'}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn('nav-link', active && 'active')}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {/* User */}
        {userName && (
          <div className="mb-3 px-2">
            <div className="font-mono text-xs truncate" style={{ color: 'rgba(254,249,195,0.5)' }}>
              {userName}
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="nav-link w-full text-left"
          style={{ color: 'rgba(254,249,195,0.35)' }}
        >
          <span className="nav-icon">↩</span>
          {loggingOut ? 'Signing out…' : 'Sign out'}
        </button>

        <div
          className="mt-4 px-2 font-mono text-xs"
          style={{ color: 'rgba(254,249,195,0.2)' }}
        >
          Built by{' '}
          <a
            href="https://creativelynanda.co.za"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gold transition-colors"
            style={{ color: 'rgba(202,138,4,0.5)' }}
          >
            Nanda Regine
          </a>
        </div>
      </div>
    </aside>
  )
}

// Mobile hamburger button
export function MobileMenuButton({
  open,
  onToggle,
}: {
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl flex items-center justify-center"
      style={{ background: '#0f3d1e', color: '#fef9c3' }}
      aria-label="Toggle menu"
    >
      {open ? '✕' : '☰'}
    </button>
  )
}
