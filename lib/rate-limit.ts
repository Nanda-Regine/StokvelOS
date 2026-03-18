// lib/rate-limit.ts
// Sliding-window rate limiter.
// Uses Upstash Redis in production (when UPSTASH_REDIS_REST_URL is set),
// falls back to an in-memory Map for local development / serverless warm instances.

import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// ── Types ─────────────────────────────────────────────────────

export interface RateLimitResult {
  success:   boolean
  limit:     number
  remaining: number
  resetAt:   number
}

// ── Upstash setup (lazy singleton) ───────────────────────────

let _redis: Redis | null = null

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  if (!_redis) _redis = Redis.fromEnv()
  return _redis
}

// Cache Ratelimit instances keyed by "limit:window" to avoid re-creating on every request
const _limiters = new Map<string, Ratelimit>()

function getLimiter(limit: number, windowSeconds: number): Ratelimit | null {
  const r = getRedis()
  if (!r) return null
  const k = `${limit}:${windowSeconds}`
  if (!_limiters.has(k)) {
    _limiters.set(k, new Ratelimit({
      redis:   r,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      prefix:  'rl:stokvelos',
    }))
  }
  return _limiters.get(k)!
}

// ── In-memory fallback ────────────────────────────────────────

interface WindowEntry { count: number; resetAt: number }
const _store = new Map<string, WindowEntry>()

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [k, e] of Array.from(_store.entries())) {
      if (e.resetAt < now) _store.delete(k)
    }
  }, 5 * 60 * 1000)
}

function memLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now      = Date.now()
  const windowMs = windowSeconds * 1000
  const entry    = _store.get(key)

  if (!entry || entry.resetAt < now) {
    _store.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, limit, remaining: limit - 1, resetAt: now + windowMs }
  }
  if (entry.count >= limit) {
    return { success: false, limit, remaining: 0, resetAt: entry.resetAt }
  }
  entry.count++
  return { success: true, limit, remaining: limit - entry.count, resetAt: entry.resetAt }
}

// ── Core async rateLimit ──────────────────────────────────────

async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const limiter = getLimiter(limit, windowSeconds)
  if (limiter) {
    const { success, limit: l, remaining, reset } = await limiter.limit(key)
    return { success, limit: l, remaining, resetAt: reset }
  }
  return memLimit(key, limit, windowSeconds)
}

// ── Pre-configured limiters ───────────────────────────────────

/** AI endpoints: 10 requests per user per hour */
export async function checkAiRateLimit(userId: string, endpoint: string): Promise<RateLimitResult> {
  return rateLimit(`ai:${endpoint}:${userId}`, 10, 3600)
}

/** Auth endpoints: 5 attempts per IP per 15 minutes */
export async function checkAuthRateLimit(ip: string): Promise<RateLimitResult> {
  return rateLimit(`auth:${ip}`, 5, 900)
}

/** General API: 100 requests per user per minute */
export async function checkApiRateLimit(userId: string): Promise<RateLimitResult> {
  return rateLimit(`api:${userId}`, 100, 60)
}

/** PDF/export: 10 per user per hour */
export async function checkExportRateLimit(userId: string): Promise<RateLimitResult> {
  return rateLimit(`export:${userId}`, 10, 3600)
}

/** Bulk operations: 5 per user per minute */
export async function checkBulkRateLimit(userId: string): Promise<RateLimitResult> {
  return rateLimit(`bulk:${userId}`, 5, 60)
}

// ── Response helper ───────────────────────────────────────────

export function rateLimitResponse(result: RateLimitResult) {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please slow down.' }),
    {
      status: 429,
      headers: {
        'Content-Type':          'application/json',
        'Retry-After':           String(Math.ceil((result.resetAt - Date.now()) / 1000)),
        'X-RateLimit-Limit':     String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset':     String(result.resetAt),
      },
    }
  )
}
