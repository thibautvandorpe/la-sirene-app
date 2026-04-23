'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function DashboardPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
      } else {
        setChecking(false)
      }
    })
  }, [router])

  if (checking) {
    return (
      <main className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-xs tracking-widest uppercase text-stone-400">Loading…</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-4">
      <p className="text-xs tracking-[0.3em] uppercase text-stone-400 mb-4">La Sirène</p>
      <h1 className="text-3xl font-light tracking-wide text-stone-900">Welcome to La Sirène</h1>
      <div className="mt-6 w-12 border-t border-stone-300" />
    </main>
  )
}
