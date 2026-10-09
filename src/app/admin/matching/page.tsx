'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Probe page for Step 4b-i. Renders the raw matching-queue JSON so we can
// inspect the real response shape before any UI is designed against it.
// Step 4b-ii replaces this entire body with the real design.
type Result =
  | { ok: true; data: unknown }
  | { ok: false; status: number; body: string }

export default function AdminMatchingQueueProbe() {
  const router = useRouter()
  const [loaded, setLoaded] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      const { data: client } = await supabase
        .from('clients')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (client?.role !== 'admin') { router.replace('/'); return }

      const res = await fetch('/api/admin/matching-queue', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!res.ok) {
        const body = await res.text()
        setResult({ ok: false, status: res.status, body })
      } else {
        const data = await res.json()
        setResult({ ok: true, data })
      }

      setLoaded(true)
    })
  }, [router])

  if (!loaded) return null

  return (
    <main className="p-6">
      {result?.ok === false ? (
        <pre className="text-xs whitespace-pre-wrap">
          {`HTTP ${result.status}\n\n${result.body}`}
        </pre>
      ) : (
        <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(result?.data, null, 2)}</pre>
      )}
    </main>
  )
}
