// app/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8faf8',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: 'white',
          border: '1px solid rgba(15,61,30,0.1)',
          borderRadius: '20px',
          padding: '48px 40px',
          maxWidth: '440px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 4px 24px rgba(15,61,30,0.08)',
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: '56px',
            height: '56px',
            background: '#0f3d1e',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            fontFamily: 'Georgia, serif',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#ca8a04',
          }}
        >
          S
        </div>

        <h1
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: '4rem',
            fontWeight: 700,
            color: '#0a2412',
            margin: '0 0 8px',
            lineHeight: 1,
          }}
        >
          404
        </h1>
        <h2
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: '1.25rem',
            color: '#0a2412',
            margin: '0 0 12px',
          }}
        >
          Page not found
        </h2>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', lineHeight: 1.6, margin: '0 0 32px' }}>
          This page doesn&apos;t exist or you may not have access to it.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Link
            href="/dashboard"
            style={{
              display: 'block',
              background: '#0f3d1e',
              color: '#fef9c3',
              padding: '11px 24px',
              borderRadius: '10px',
              textDecoration: 'none',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            style={{
              display: 'block',
              color: '#9ca3af',
              padding: '8px 24px',
              textDecoration: 'none',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
            }}
          >
            Back to homepage
          </Link>
        </div>
      </div>
    </div>
  )
}
