import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'StokvelOS — Smart Stokvel Management for South Africa',
  description:
    'Manage your stokvel with ease. Track contributions, manage members, log meetings, and generate financial reports — free and secure for South African stokvels.',
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-deep-900 via-forest-900 to-deep-800">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-earth-500 flex items-center justify-center font-bold text-white text-sm">S</div>
          <span className="text-white font-semibold text-lg">StokvelOS</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-forest-200 hover:text-white text-sm transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="btn-primary text-sm px-4 py-2 rounded-lg"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-forest-800/50 border border-forest-600/30 rounded-full px-4 py-1.5 mb-6">
          <span className="w-2 h-2 rounded-full bg-earth-400 animate-pulse" />
          <span className="text-forest-200 text-sm">Built for South African stokvels</span>
        </div>

        <h1 className="font-display text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
          Manage your stokvel{' '}
          <span className="text-earth-400">with confidence</span>
        </h1>

        <p className="text-forest-200 text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          Track contributions, manage members, log meetings, and generate financial
          reports — all in one secure platform designed for South African stokvels.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/auth/signup"
            className="btn-primary text-base px-8 py-3 rounded-xl font-semibold"
          >
            Start for free
          </Link>
          <Link
            href="/auth/login"
            className="text-forest-200 hover:text-white border border-forest-600/40 hover:border-forest-400 text-base px-8 py-3 rounded-xl font-semibold transition-all"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* ── Feature grid ─────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pb-24 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { icon: '👥', title: 'Member management',     desc: 'Add members, assign roles, track payout positions, and set contribution amounts.' },
          { icon: '💰', title: 'Contribution tracking', desc: 'Record payments by cash, EFT, SnapScan, or Ozow. Know who has paid at a glance.' },
          { icon: '📅', title: 'Meeting minutes',       desc: 'Log meetings, record attendance, and let AI format your minutes automatically.' },
          { icon: '📊', title: 'Financial reports',     desc: 'Export PDF and CSV reports. Monitor compliance, payouts, and yearly progress.' },
          { icon: '🤖', title: 'AI health insights',    desc: 'Get monthly AI-generated health reports and personalised recommendations.' },
          { icon: '🔒', title: 'Secure by design',      desc: 'Row-level security, encrypted sessions, and strict data isolation per stokvel.' },
        ].map(({ icon, title, desc }) => (
          <div key={title} className="card p-6 rounded-2xl">
            <div className="text-3xl mb-3">{icon}</div>
            <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
            <p className="text-forest-300 text-sm leading-relaxed">{desc}</p>
          </div>
        ))}
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-forest-800/50 py-8 text-center text-forest-400 text-sm">
        <p>&copy; {new Date().getFullYear()} StokvelOS. Built with love for South African communities.</p>
      </footer>
    </main>
  )
}
