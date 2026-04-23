'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ fullName: '', email: '', password: '', phone: '' })
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: 'http://localhost:3001/auth/callback',
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const { error: insertError } = await supabase.from('clients').insert({
        id: data.user.id,
        full_name: form.fullName,
        phone: form.phone,
        email: form.email,
      })

      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }
    }

    if (data.session) {
      router.push('/dashboard')
    } else {
      setNotice('Please check your email to confirm your account before signing in.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <p className="text-xs tracking-[0.3em] uppercase text-stone-400 mb-3">La Sirène</p>
          <h1 className="text-2xl font-light tracking-wide text-stone-900">Create your account</h1>
          <p className="mt-3 text-sm text-stone-500 font-light">
            Trusted care for your most cherished garments.
          </p>
        </div>

        <div className="bg-white border border-stone-200 px-10 py-10">
          {notice && (
            <div className="mb-6 px-4 py-3 bg-stone-100 border border-stone-200 text-stone-700 text-sm font-light">
              {notice}
            </div>
          )}

          {error && (
            <div className="mb-6 px-4 py-3 bg-red-50 border border-red-100 text-red-700 text-sm font-light">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs tracking-widest uppercase text-stone-500 mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                required
                autoComplete="name"
                className="w-full border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 placeholder-stone-300 outline-none focus:border-stone-400 focus:bg-white transition-colors"
                placeholder="Marie Dupont"
              />
            </div>

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
              <label className="block text-xs tracking-widest uppercase text-stone-500 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                autoComplete="tel"
                className="w-full border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 placeholder-stone-300 outline-none focus:border-stone-400 focus:bg-white transition-colors"
                placeholder="+33 6 00 00 00 00"
              />
            </div>

            <div>
              <label className="block text-xs tracking-widest uppercase text-stone-500 mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
                minLength={8}
                className="w-full border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 placeholder-stone-300 outline-none focus:border-stone-400 focus:bg-white transition-colors"
                placeholder="Minimum 8 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-stone-900 text-white text-xs tracking-widest uppercase py-4 hover:bg-stone-800 active:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-stone-400 font-light mt-8">
          Already have an account?{' '}
          <Link href="/login" className="text-stone-700 underline underline-offset-4 hover:text-stone-900 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
