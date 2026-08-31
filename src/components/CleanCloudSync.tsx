'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const synced = new Set<string>()

async function syncUser(userId: string, accessToken: string) {
  synced.add(userId)
  try {
    await fetch('/api/cleancloud/customer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    synced.delete(userId)
  }
}

export default function CleanCloudSync() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      const token = data.session?.access_token
      if (user && token && !synced.has(user.id)) {
        syncUser(user.id, token)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        const user = session?.user
        const token = session?.access_token
        if (user && token && !synced.has(user.id)) {
          syncUser(user.id, token)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return null
}
