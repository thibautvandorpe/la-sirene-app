'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function AppHeader() {
  const [fullName, setFullName] = useState<string | null>(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!session) {
          setLoaded(true)
          return
        }

        setLoggedIn(true)

        const { data } = await supabase
          .from('clients')
          .select('full_name')
          .eq('id', session.user.id)
          .single()

        setFullName(data?.full_name ?? null)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  if (!loaded) return null

  return (
    <header
      className="w-full bg-transparent px-6 flex items-end justify-between"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}
    >
      {loggedIn ? (
        <div className="pb-4">
          <p className="text-[10px] tracking-wide uppercase text-[#c4b89a]/60">
            Welcome back
          </p>
          <p className="text-lg font-light text-[#c4b89a]">
            {fullName ? `Hi ${fullName}` : 'Hi'}
          </p>
        </div>
      ) : (
        <div className="pb-4">
          <p className="font-serif text-xl text-[#f5f0e8]">La Sirène</p>
        </div>
      )}

      {!loggedIn && (
        <div className="pb-4">
          <Link
            href="/login"
            className="text-[10px] tracking-wide uppercase text-[#c4b89a] underline underline-offset-2 decoration-[#c4b89a]/40"
          >
            Sign In
          </Link>
        </div>
      )}
    </header>
  )
}
