'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const next         = searchParams.get('next') ?? '/dashboard'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    router.push(next)
    router.refresh()
  }

  return (
    <div className="card rounded-2xl p-8">
      <h1 className="font-display text-2xl font-bold text-white mb-1">Welcome back</h1>
      <p className="text-forest-300 text-sm mb-8">Sign in to your stokvel dashboard</p>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-forest-200 text-sm font-medium mb-1.5" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="form-input w-full"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-forest-200 text-sm font-medium mb-1.5" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="form-input w-full"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-2.5 rounded-xl font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-forest-400 text-sm">
        Don&apos;t have an account?{' '}
        <Link href="/auth/signup" className="text-earth-400 hover:text-earth-300 font-medium transition-colors">
          Create one free
        </Link>
      </p>
    </div>
  )
}
