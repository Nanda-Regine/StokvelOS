// lib/rate-limit.ts
// In-memory sliding window rate limiter
// For production scale, swap backing store with Upstash Redis

interface WindowEntry {
  count:     number
  resetAt:   number
}

const store = new Map<string, WindowEntry>()

// Clean up expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of Array.from(store.entries())) {
      if (entry.resetAt < now) store.delete(key)
    }
  }, 5 * 60 * 1000)
}

interface RateLimitOptions {
  /** Max requests per window */
  limit:        number
  /** Window size in seconds */
  windowSeconds: number
}

interface RateLimitResult {
  success:   boolean
  limit:     number
  remaining: number
  resetAt:   number
}

export function rateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const now      = Date.now()
  const windowMs = options.windowSeconds * 1000
  const entry    = store.get(key)

  // New or expired window
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return {
      success:   true,
      limit:     options.limit,
      remaining: options.limit - 1,
      resetAt:   now + windowMs,
    }
  }

  // Within window
  if (entry.count >= options.limit) {
    return {
      success:   false,
      limit:     options.limit,
      remaining: 0,
      resetAt:   entry.resetAt,
    }
  }

  entry.count++
  return {
    success:   true,
    limit:     options.limit,
    remaining: options.limit - entry.count,
    resetAt:   entry.resetAt,
  }
}

// ── Pre-configured limiters ───────────────────────────────────

/** AI endpoints: 10 requests per user per hour */
export function checkAiRateLimit(userId: string, endpoint: string) {
  return rateLimit(`ai:${endpoint}:${userId}`, { limit: 10, windowSeconds: 3600 })
}

/** Auth endpoints: 5 attempts per IP per 15 minutes */
export function checkAuthRateLimit(ip: string) {
  return rateLimit(`auth:${ip}`, { limit: 5, windowSeconds: 900 })
}

/** General API: 100 requests per user per minute */
export function checkApiRateLimit(userId: string) {
  return rateLimit(`api:${userId}`, { limit: 100, windowSeconds: 60 })
}

/** PDF/export: 10 per user per hour (expensive operations) */
export function checkExportRateLimit(userId: string) {
  return rateLimit(`export:${userId}`, { limit: 10, windowSeconds: 3600 })
}

/** Bulk operations: 5 per user per minute */
export function checkBulkRateLimit(userId: string) {
  return rateLimit(`bulk:${userId}`, { limit: 5, windowSeconds: 60 })
}

// ── Response helper ───────────────────────────────────────────
export function rateLimitResponse(result: RateLimitResult) {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please slow down.' }),
    {
      status: 429,
      headers: {
        'Content-Type':    'application/json',
        'Retry-After':     String(Math.ceil((result.resetAt - Date.now()) / 1000)),
        'X-RateLimit-Limit':     String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset':     String(result.resetAt),
      },
    }
  )
}
