import type { Metadata, Viewport } from 'next'
import { Playfair_Display, Source_Sans_3, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: {
    default: 'StokvelOS — Your Stokvel. Organised. Intelligent.',
    template: '%s | StokvelOS',
  },
  description:
    'South Africa\'s first AI-powered stokvel management platform. Track contributions, manage members, generate reports and WhatsApp reminders — built for the R50B stokvel market.',
  keywords: [
    'stokvel', 'stokvel management', 'South Africa savings', 'stokvel app',
    'community savings', 'burial society', 'grocery stokvel', 'investment stokvel',
    'stokvels South Africa', 'stokvel software',
  ],
  authors: [{ name: 'Nanda Regine', url: 'https://creativelynanda.co.za' }],
  creator: 'Nanda Regine',
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: 'StokvelOS',
    title: 'StokvelOS — Your Stokvel. Organised. Intelligent.',
    description: 'AI-powered stokvel management for South Africa. Track contributions, send WhatsApp reminders, generate reports.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'StokvelOS',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StokvelOS — Your Stokvel. Organised.',
    description: 'AI-powered stokvel management for South Africa.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f3d1e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${sourceSans.variable} ${jetbrains.variable}`}
    >
      <body className="font-body antialiased bg-cream-50 text-gray-900 min-h-screen">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#0f3d1e',
              color: '#fef9c3',
              fontFamily: 'var(--font-body)',
              fontSize: '0.875rem',
              borderRadius: '8px',
              border: '1px solid rgba(202,138,4,0.3)',
            },
            success: {
              iconTheme: { primary: '#ca8a04', secondary: '#0f3d1e' },
            },
            error: {
              style: {
                background: '#7f1d1d',
                color: '#fecaca',
                border: '1px solid rgba(239,68,68,0.3)',
              },
            },
          }}
        />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
