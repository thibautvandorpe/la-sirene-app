'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ProfilePage() {
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[10px] tracking-widest uppercase text-[#f5f0e8]/30">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <p className="text-[10px] tracking-[0.35em] uppercase text-[#c4b89a] mb-4">La Sirène</p>
      <h1 className="text-3xl font-light tracking-wide text-[#f5f0e8]">Welcome</h1>
      <div className="mt-6 w-10 border-t border-[#c4b89a]/40" />
    </div>
  )
}
