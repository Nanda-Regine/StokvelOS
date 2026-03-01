import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// ── In-memory rate limiter ───────────────────────────────────
// For production at scale, swap Map for Upstash Redis
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'

  // ── Rate limiting on API routes ──────────────────────────────
  if (pathname.startsWith('/api/')) {
    const isAuthRoute = pathname.startsWith('/api/auth')
    const allowed = isAuthRoute
      ? rateLimit(`auth:${ip}`, 10, 60_000)   // 10 req/min on auth
      : rateLimit(`api:${ip}`,  60, 60_000)   // 60 req/min on other APIs

    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': isAuthRoute ? '10' : '60',
          },
        }
      )
    }
  }

  // ── Supabase session refresh + auth guard ────────────────────
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
