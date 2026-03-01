import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Toaster } from 'react-hot-toast'
import './globals.css'
import './globals-additions.css'

// ── SEO Metadata ─────────────────────────────────────────────
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://stokvelos.co.za'),

  title: {
    default: 'StokvelOS — Smart Stokvel Management for South Africa',
    template: '%s | StokvelOS',
  },
  description:
    'StokvelOS is a free, secure platform for South African stokvels. Track contributions, manage members, log meetings, and generate reports — all in one place.',
  keywords: [
    'stokvel',
    'stokvel management',
    'South Africa savings',
    'rotating savings',
    'ROSCA',
    'contribution tracker',
    'stokvel app',
    'South African fintech',
    'burial society',
    'grocery stokvel',
    'investment stokvel',
  ],
  authors: [{ name: 'StokvelOS' }],
  creator: 'StokvelOS',
  publisher: 'StokvelOS',
  applicationName: 'StokvelOS',
  category: 'Finance',

  // ── Open Graph ────────────────────────────────────────────────
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://stokvelos.co.za',
    siteName: 'StokvelOS',
    title: 'StokvelOS — Smart Stokvel Management for South Africa',
    description:
      'Track contributions, manage members, log meetings, and generate reports for your stokvel — free and secure.',
    images: [
      {
        url: '/og/og-default.png',
        width: 1200,
        height: 630,
        alt: 'StokvelOS — Smart Stokvel Management',
      },
    ],
  },

  // ── Twitter / X ───────────────────────────────────────────────
  twitter: {
    card: 'summary_large_image',
    title: 'StokvelOS — Smart Stokvel Management for South Africa',
    description:
      'Track contributions, manage members, log meetings, and generate reports for your stokvel.',
    images: ['/og/og-default.png'],
  },

  // ── Icons ─────────────────────────────────────────────────────
  icons: {
    icon: [
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
    shortcut: '/icons/favicon.ico',
  },
  manifest: '/manifest.json',

  // ── Robots ────────────────────────────────────────────────────
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },

  // ── Verification (add when deploying) ────────────────────────
  // verification: { google: 'YOUR_GOOGLE_SEARCH_CONSOLE_ID' },
}

export const viewport: Viewport = {
  themeColor: '#0f3d1e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA" suppressHydrationWarning>
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { background: '#1a4a2e', color: '#fff', fontSize: '14px' },
            success: { iconTheme: { primary: '#4ade80', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#f87171', secondary: '#fff' } },
          }}
        />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
