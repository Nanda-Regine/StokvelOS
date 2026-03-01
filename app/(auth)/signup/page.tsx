'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function SignupPage() {
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    toast.success('Check your email to confirm your account!')
    router.push('/auth/login')
  }

  return (
    <div className="card rounded-2xl p-8">
      <h1 className="font-display text-2xl font-bold text-white mb-1">Create your account</h1>
      <p className="text-forest-300 text-sm mb-8">Set up your stokvel in minutes — free forever</p>

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="block text-forest-200 text-sm font-medium mb-1.5" htmlFor="fullName">
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            required
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="form-input w-full"
            placeholder="Thabo Nkosi"
          />
        </div>

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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="form-input w-full"
            placeholder="At least 8 characters"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-2.5 rounded-xl font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating account…' : 'Create free account'}
        </button>
      </form>

      <p className="mt-6 text-center text-forest-400 text-sm">
        Already have an account?{' '}
        <Link href="/auth/login" className="text-earth-400 hover:text-earth-300 font-medium transition-colors">
          Sign in
        </Link>
      </p>

      <p className="mt-4 text-center text-forest-500 text-xs">
        By signing up you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  )
}
