'use client'
// components/shared/Sidebar.tsx  (REPLACE Batch 1 version)

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Stokvel } from '@/types'

interface NavItem {
  href:    string
  label:   string
  icon:    string
  section?: 'main' | 'manage' | 'admin'
}

const NAV_ITEMS: NavItem[] = [
  // Main
  { href: '/dashboard',     label: 'Dashboard',      icon: '◈', section: 'main'   },
  { href: '/members',       label: 'Members',         icon: '◉', section: 'main'   },
  { href: '/contributions', label: 'Contributions',   icon: '◎', section: 'main'   },
  { href: '/payouts',       label: 'Payouts',         icon: '◆', section: 'main'   },
  // Manage
  { href: '/meetings',      label: 'Meetings',        icon: '◍', section: 'manage' },
  { href: '/announcements', label: 'Announcements',   icon: '◌', section: 'manage' },
  { href: '/reports',       label: 'Reports',         icon: '◐', section: 'manage' },
  // Admin
  { href: '/settings',      label: 'Settings',        icon: '◑', section: 'admin'  },
  { href: '/audit',         label: 'Audit Log',       icon: '◒', section: 'admin'  },
]

const SECTION_LABELS: Record<string, string> = {
  main:   'Overview',
  manage: 'Manage',
  admin:  'Admin',
}

interface SidebarProps {
  stokvel?:   Stokvel | null
  userName?:  string | null
}

export function Sidebar({ stokvel, userName }: SidebarProps) {
  const pathname    = usePathname()
  const router      = useRouter()
  const [open,      setOpen]      = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/auth/login')
  }

  const sections = ['main', 'manage', 'admin'] as const

  const sidebar = (
    <aside
      className="sidebar flex flex-col"
      style={{
        position:   'fixed',
        top: 0, left: 0, bottom: 0,
        width:      '248px',
        background: 'linear-gradient(180deg, #0a2412 0%, #071a0d 100%)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        zIndex:     40,
        overflowY:  'auto',
        overflowX:  'hidden',
      }}
    >
      {/* Brand */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <div className="flex items-center gap-3">
            <div
              style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: '#ca8a04', color: '#0a2412',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700,
                flexShrink: 0,
              }}
            >
              S
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: '#fef9c3', lineHeight: 1.2, fontWeight: 600 }}>
                StokvelOS
              </div>
              {stokvel && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'rgba(254,249,195,0.45)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                  {stokvel.name}
                </div>
              )}
            </div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px' }}>
        {sections.map(section => {
          const items = NAV_ITEMS.filter(n => n.section === section)
          return (
            <div key={section} style={{ marginBottom: '20px' }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.62rem',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  color: 'rgba(255,255,255,0.2)', padding: '0 8px 6px',
                }}
              >
                {SECTION_LABELS[section]}
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {items.map(item => {
                  const active = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        style={{
                          display:       'flex',
                          alignItems:    'center',
                          gap:           '10px',
                          padding:       '8px 10px',
                          borderRadius:  '10px',
                          textDecoration: 'none',
                          background:    active ? 'rgba(202,138,4,0.12)' : 'transparent',
                          borderLeft:    active ? '2px solid #ca8a04' : '2px solid transparent',
                          transition:    'all 0.15s ease',
                          color:         active ? '#fef9c3' : 'rgba(255,255,255,0.5)',
                          fontFamily:    'var(--font-body)',
                          fontSize:      '0.82rem',
                          fontWeight:    active ? 500 : 400,
                        }}
                        className={cn(!active && 'hover:bg-white/5 hover:text-white/80')}
                      >
                        <span style={{ fontSize: '0.85rem', opacity: active ? 1 : 0.7, flexShrink: 0 }}>
                          {item.icon}
                        </span>
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* Bottom: user + signout */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 8px' }}>
        {userName && (
          <div style={{ padding: '6px 10px', marginBottom: '4px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.67rem', color: 'rgba(255,255,255,0.3)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Signed in as
            </div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userName}
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            width:         '100%',
            display:       'flex',
            alignItems:    'center',
            gap:           '10px',
            padding:       '8px 10px',
            borderRadius:  '10px',
            background:    'transparent',
            border:        'none',
            color:         'rgba(255,255,255,0.35)',
            fontSize:      '0.82rem',
            fontFamily:    'var(--font-body)',
            cursor:        'pointer',
            transition:    'all 0.15s',
            textAlign:     'left',
          }}
          className="hover:bg-white/5 hover:text-white/60"
        >
          <span style={{ fontSize: '0.85rem' }}>◯</span>
          {loggingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block">{sidebar}</div>

      {/* Mobile: hamburger + drawer */}
      <div className="md:hidden">
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            position: 'fixed', top: '12px', left: '12px', zIndex: 50,
            width: '40px', height: '40px', borderRadius: '10px',
            background: '#0f3d1e', border: 'none', color: '#fef9c3',
            fontSize: '1.1rem', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
          aria-label="Toggle menu"
        >
          {open ? '✕' : '☰'}
        </button>

        {open && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 39 }}
              onClick={() => setOpen(false)}
            />
            {sidebar}
          </>
        )}
      </div>
    </>
  )
}
