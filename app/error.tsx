'use client'
// app/error.tsx  — global error boundary
// Next.js calls this when any server component throws an unhandled error

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to your error tracker here (e.g. Sentry)
    console.error('[StokvelOS Error]', error)
  }, [error])

  return (
    <html>
      <body style={{ fontFamily: 'sans-serif', background: '#f8faf8', margin: 0 }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              background: 'white',
              border: '1px solid rgba(15,61,30,0.1)',
              borderRadius: '20px',
              padding: '48px 40px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 4px 24px rgba(15,61,30,0.08)',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
            <h1
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: '1.5rem',
                color: '#0a2412',
                marginBottom: '12px',
                marginTop: 0,
              }}
            >
              Something went wrong
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '28px' }}>
              StokvelOS encountered an unexpected error. Your data is safe — please try again or refresh the page.
            </p>
            {error.digest && (
              <p style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#d1d5db', marginBottom: '24px' }}>
                Error ID: {error.digest}
              </p>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={reset}
                style={{
                  background: '#0f3d1e',
                  color: '#fef9c3',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 24px',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
              <a
                href="/dashboard"
                style={{
                  background: 'transparent',
                  color: '#6b7280',
                  border: '1px solid rgba(15,61,30,0.2)',
                  borderRadius: '10px',
                  padding: '10px 24px',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  textDecoration: 'none',
                }}
              >
                Go to dashboard
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
