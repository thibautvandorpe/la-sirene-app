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
    <main className="min-h-screen bg-stone-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <p className="text-xs tracking-[0.3em] uppercase text-stone-400 mb-3">La Sirène</p>
          <h1 className="text-2xl font-light tracking-wide text-stone-900">Welcome back</h1>
          <p className="mt-3 text-sm text-stone-500 font-light">
            Sign in to manage your garment care.
          </p>
        </div>

        <div className="bg-white border border-stone-200 px-10 py-10">
          {error && (
            <div className="mb-6 px-4 py-3 bg-red-50 border border-red-100 text-red-700 text-sm font-light">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs tracking-widest uppercase text-stone-500 mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
                className="w-full border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 placeholder-stone-300 outline-none focus:border-stone-400 focus:bg-white transition-colors"
                placeholder="marie@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs tracking-widest uppercase text-stone-500">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
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
                className="w-full border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 placeholder-stone-300 outline-none focus:border-stone-400 focus:bg-white transition-colors"
                placeholder="Your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-stone-900 text-white text-xs tracking-widest uppercase py-4 hover:bg-stone-800 active:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-stone-400 font-light mt-8">
          New to La Sirène?{' '}
          <Link href="/signup" className="text-stone-700 underline underline-offset-4 hover:text-stone-900 transition-colors">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  )
}
