import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '404 — Page not found',
  robots: { index: false },
}

export default function NotFound() {
  return (
    <main className="min-h-screen bg-deep-900 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-earth-500/20 flex items-center justify-center mb-6">
        <span className="text-3xl">🌿</span>
      </div>
      <h1 className="font-display text-4xl font-bold text-white mb-3">Page not found</h1>
      <p className="text-forest-300 text-lg mb-8 max-w-sm">
        This page doesn't exist or was moved. Let's get you back on track.
      </p>
      <Link href="/" className="btn-primary px-6 py-2.5 rounded-xl font-semibold">
        Go home
      </Link>
    </main>
  )
}
