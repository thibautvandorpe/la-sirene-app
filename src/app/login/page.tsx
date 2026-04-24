'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16" style={{ backgroundColor: '#1c2b1e' }}>
      <div className="w-full max-w-sm">

        {/* Wordmark */}
        <div className="text-center mb-10">
          <h1 className="font-serif text-3xl font-light tracking-[0.15em]" style={{ color: '#f5f0e8' }}>
            La Sirène
          </h1>
          <div className="mx-auto mt-5 mb-0 h-px w-16" style={{ backgroundColor: '#c4b89a' }} />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-8 text-sm font-light text-center" style={{ color: '#e8a090' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>
              Email
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
              placeholder="marie@example.com"
              className="w-full bg-transparent outline-none text-sm font-light pb-3 placeholder-[#f5f0e8]/20 transition-colors"
              style={{
                color: '#f5f0e8',
                borderBottom: '1px solid rgba(196, 184, 154, 0.4)',
              }}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-[10px] tracking-[0.3em] uppercase" style={{ color: '#c4b89a' }}>
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[10px] tracking-wide transition-opacity hover:opacity-100"
                style={{ color: 'rgba(196, 184, 154, 0.55)' }}
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
              placeholder="Your password"
              className="w-full bg-transparent outline-none text-sm font-light pb-3 placeholder-[#f5f0e8]/20 transition-colors"
              style={{
                color: '#f5f0e8',
                borderBottom: '1px solid rgba(196, 184, 154, 0.4)',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full text-[10px] tracking-[0.3em] uppercase py-4 mt-4 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs font-light mt-10" style={{ color: 'rgba(245, 240, 232, 0.45)' }}>
          New to La Sirène?{' '}
          <Link href="/signup" className="transition-opacity hover:opacity-100" style={{ color: '#c4b89a' }}>
            Create Account
          </Link>
        </p>
      </div>
    </main>
  )
}
