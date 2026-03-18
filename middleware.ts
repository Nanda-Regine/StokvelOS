import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { checkAuthRateLimit, checkApiRateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'

  if (pathname.startsWith('/api/')) {
    const isAuth = pathname.startsWith('/api/auth')
    const result = isAuth
      ? await checkAuthRateLimit(ip)
      : await checkApiRateLimit(ip)

    if (!result.success) return rateLimitResponse(result)
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
