'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import AppHeader from '@/components/AppHeader'

export default function ProfilePage() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setLoggedIn(!!session)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  if (!loaded) return null

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      {loggedIn ? (
        <div className="px-6 pt-4">
          <p className="text-[10px] tracking-[0.35em] uppercase text-[#c4b89a]">Profile</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-light tracking-wide text-[#f5f0e8]">
            Please sign in to access your profile
          </p>
          <Link
            href="/login"
            className="mt-5 px-6 py-2 text-[10px] tracking-widest uppercase text-[#c4b89a] border border-[#c4b89a]/30 rounded-sm"
          >
            Sign In
          </Link>
        </div>
      )}
    </div>
  )
}
