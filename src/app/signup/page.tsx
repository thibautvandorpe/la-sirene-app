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
        emailRedirectTo: window.location.origin + '/auth/callback',
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
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16" style={{ backgroundColor: '#1c2b1e' }}>
      <div className="w-full max-w-sm">

        {/* Wordmark */}
        <div className="text-center mb-10">
          <h1 className="font-serif text-3xl font-light tracking-[0.15em]" style={{ color: '#f5f0e8' }}>
            La Sirène
          </h1>
          <div className="mx-auto mt-5 mb-0 h-px w-16" style={{ backgroundColor: '#c4b89a' }} />
        </div>

        {/* Notices */}
        {notice && (
          <div className="mb-8 text-sm font-light text-center leading-relaxed" style={{ color: '#c4b89a' }}>
            {notice}
          </div>
        )}
        {error && (
          <div className="mb-8 text-sm font-light text-center" style={{ color: '#e8a090' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>
              Full Name
            </label>
            <input
              type="text"
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              required
              autoComplete="name"
              placeholder="Marie Dupont"
              className="w-full bg-transparent outline-none text-sm font-light pb-3 placeholder-[#f5f0e8]/20 transition-colors"
              style={{
                color: '#f5f0e8',
                borderBottom: '1px solid rgba(196, 184, 154, 0.4)',
              }}
            />
          </div>

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
            <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>
              Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              autoComplete="tel"
              placeholder="+33 6 00 00 00 00"
              className="w-full bg-transparent outline-none text-sm font-light pb-3 placeholder-[#f5f0e8]/20 transition-colors"
              style={{
                color: '#f5f0e8',
                borderBottom: '1px solid rgba(196, 184, 154, 0.4)',
              }}
            />
          </div>

          <div>
            <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>
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
              placeholder="Minimum 8 characters"
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
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-xs font-light mt-10" style={{ color: 'rgba(245, 240, 232, 0.45)' }}>
          Already have an account?{' '}
          <Link href="/login" className="transition-opacity hover:opacity-100" style={{ color: '#c4b89a' }}>
            Sign In
          </Link>
        </p>
      </div>
    </main>
  )
}
