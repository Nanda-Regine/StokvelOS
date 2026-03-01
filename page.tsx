import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'StokvelOS — South Africa\'s AI-Powered Stokvel Management Platform',
  description: 'Manage your stokvel with AI-powered insights, automated reminders, and professional reports. Built for South Africa\'s R50B+ community savings market.',
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-deep-900 text-cream-100 overflow-hidden">
      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav className="relative z-20 flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold flex items-center justify-center font-display text-lg font-bold text-deep-900">
            S
          </div>
          <span className="font-display text-xl text-cream-100">StokvelOS</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="btn btn-ghost btn-md text-cream-200 hover:bg-white/10"
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="btn btn-gold btn-md"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="relative px-6 md:px-12 pt-16 pb-24 text-center overflow-hidden">
        {/* Background mesh */}
        <div className="absolute inset-0 bg-hero-mesh opacity-60 pointer-events-none" />

        {/* Decorative circles */}
        <div className="absolute top-20 left-20 w-64 h-64 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #ca8a04, transparent)' }} />
        <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full opacity-5 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #22c55e, transparent)' }} />

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold/30 bg-gold/10 text-gold text-xs font-mono uppercase tracking-wider mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse-slow" />
            AI-Powered · Built for Mzansi
          </div>

          <h1 className="font-display text-5xl md:text-7xl mb-6 leading-tight"
            style={{ color: '#fef9c3' }}>
            Your Stokvel.{' '}
            <span className="text-gold">Organised.</span>{' '}
            <br className="hidden md:block" />
            Intelligent. Together.
          </h1>

          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ color: 'rgba(254,249,195,0.65)' }}>
            South Africa&apos;s first AI-powered stokvel management platform.
            Track contributions, send WhatsApp reminders, generate reports —
            all in one beautiful app.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/auth/signup"
              className="btn btn-gold btn-lg w-full sm:w-auto"
              style={{ minWidth: '200px' }}>
              Start for free →
            </Link>
            <Link href="/auth/login"
              className="btn btn-outline btn-lg w-full sm:w-auto text-cream-200 border-white/20 hover:bg-white/10 hover:border-white/40">
              Sign into your stokvel
            </Link>
          </div>

          {/* Social proof */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm"
            style={{ color: 'rgba(254,249,195,0.5)' }}>
            <span>✓ Free during beta</span>
            <span className="hidden sm:block">·</span>
            <span>✓ No credit card required</span>
            <span className="hidden sm:block">·</span>
            <span>✓ Works offline</span>
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────── */}
      <section className="px-6 md:px-12 py-24"
        style={{ background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="font-mono text-xs uppercase tracking-widest text-gold mb-4">Features</p>
            <h2 className="font-display text-4xl md:text-5xl" style={{ color: '#fef9c3' }}>
              Everything your stokvel needs
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: '🤖',
                title: 'AI Meeting Minutes',
                desc: 'Type rough notes, get professional formatted minutes instantly. Share via WhatsApp or email.',
              },
              {
                icon: '📊',
                title: 'Health Reports',
                desc: 'Monthly AI-generated compliance reports. Know exactly who\'s paid and who needs a reminder.',
              },
              {
                icon: '📲',
                title: 'WhatsApp Reminders',
                desc: 'AI writes personalised reminder messages for each member. One click to send via WhatsApp.',
              },
              {
                icon: '📅',
                title: 'Contribution Calendar',
                desc: 'Visual month-by-month view of all payments. Spot patterns and track compliance at a glance.',
              },
              {
                icon: '💰',
                title: 'Payout Queue',
                desc: 'Manage your payout rotation, track who\'s received, and plan upcoming disbursements.',
              },
              {
                icon: '📈',
                title: 'Annual Reports',
                desc: 'One-click PDF and CSV exports for all contributions, members, and payout history.',
              },
            ].map((f, i) => (
              <div key={i}
                className="p-6 rounded-2xl border"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  borderColor: 'rgba(255,255,255,0.07)',
                  animationDelay: `${i * 0.08}s`,
                }}>
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-display text-xl mb-2" style={{ color: '#fef9c3' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(254,249,195,0.55)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────── */}
      <section className="px-6 md:px-12 py-24">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-gold mb-4">Pricing</p>
          <h2 className="font-display text-4xl mb-4" style={{ color: '#fef9c3' }}>Simple, honest pricing</h2>
          <p className="text-sm mb-12" style={{ color: 'rgba(254,249,195,0.55)' }}>Free during beta · Upgrade when you&apos;re ready</p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: 'Beta',
                price: 'Free',
                sub: 'During beta period',
                features: ['Full AI features', 'Unlimited members', 'All exports', 'WhatsApp reminders', 'Priority support'],
                highlight: true,
                cta: 'Start free →',
              },
              {
                name: 'Basic',
                price: 'R199',
                sub: 'per month',
                features: ['Up to 20 members', 'Contribution tracking', 'Calendar view', 'Basic reports', 'CSV export'],
                highlight: false,
                cta: 'Get Basic',
              },
              {
                name: 'Premium',
                price: 'R499',
                sub: 'per month',
                features: ['Unlimited members', 'Full AI features', 'PDF reports', 'WhatsApp automation', 'Priority support'],
                highlight: false,
                cta: 'Get Premium',
              },
            ].map((plan, i) => (
              <div key={i}
                className="p-6 rounded-2xl border relative"
                style={{
                  background: plan.highlight ? 'rgba(202,138,4,0.1)' : 'rgba(255,255,255,0.03)',
                  borderColor: plan.highlight ? 'rgba(202,138,4,0.4)' : 'rgba(255,255,255,0.07)',
                }}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-deep-900 text-xs font-mono px-3 py-1 rounded-full">
                    Current offer
                  </div>
                )}
                <p className="font-mono text-xs uppercase tracking-wider mb-2" style={{ color: 'rgba(254,249,195,0.5)' }}>{plan.name}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-display text-4xl" style={{ color: '#fef9c3' }}>{plan.price}</span>
                </div>
                <p className="text-xs mb-6" style={{ color: 'rgba(254,249,195,0.4)' }}>{plan.sub}</p>
                <ul className="space-y-2 mb-6 text-left">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm" style={{ color: 'rgba(254,249,195,0.7)' }}>
                      <span className="text-gold">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup"
                  className={`btn ${plan.highlight ? 'btn-gold' : 'btn-outline text-cream-200 border-white/20 hover:bg-white/10'} btn-md w-full`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="px-6 md:px-12 py-10 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gold flex items-center justify-center font-display font-bold text-deep-900 text-sm">S</div>
            <span className="font-display" style={{ color: 'rgba(254,249,195,0.7)' }}>StokvelOS</span>
          </div>
          <p className="text-xs text-center" style={{ color: 'rgba(254,249,195,0.35)' }}>
            Built by{' '}
            <a href="https://creativelynanda.co.za" target="_blank" rel="noopener noreferrer"
              className="underline hover:text-gold transition-colors">
              Nanda Regine
            </a>
            {' '}· East London, South Africa · hello@mirembemuse.co.za
          </p>
          <div className="flex items-center gap-4 text-xs" style={{ color: 'rgba(254,249,195,0.35)' }}>
            <span>Basic R199/mo</span>
            <span>·</span>
            <span>Premium R499/mo</span>
            <span>·</span>
            <span className="text-gold">Free during beta</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
