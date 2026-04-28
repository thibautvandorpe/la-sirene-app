'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function AdminHome() {
  const router = useRouter()
  const [loaded, setLoaded] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingTotal, setPendingTotal] = useState(0)
  const [underReviewCount, setUnderReviewCount] = useState(0)
  const [awaitingCount, setAwaitingCount] = useState(0)
  const [orderTotal, setOrderTotal] = useState(0)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      const { data: client } = await supabase
        .from('clients')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (client?.role !== 'admin') { router.replace('/'); return }

      const [{ data: apptData }, { data: orderData }] = await Promise.all([
        // Pending appointments with item prices
        supabase
          .from('appointments')
          .select('id, appointment_items(estimated_price)')
          .eq('status', 'pending'),
        // Active orders (under_review + awaiting_confirmation)
        supabase
          .from('orders')
          .select('id, total_price, status')
          .in('status', ['under_review', 'awaiting_confirmation']),
      ])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const appts = (apptData as any[]) ?? []
      setPendingCount(appts.length)
      setPendingTotal(
        appts.reduce(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (sum, a) => sum + (a.appointment_items ?? []).reduce((s: number, i: any) => s + (i.estimated_price ?? 0), 0),
          0
        )
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orders = (orderData as any[]) ?? []
      setUnderReviewCount(orders.filter((o: any) => o.status === 'under_review').length)
      setAwaitingCount(orders.filter((o: any) => o.status === 'awaiting_confirmation').length)
      setOrderTotal(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        orders.reduce((sum: number, o: any) => sum + (o.total_price ?? 0), 0)
      )

      setLoaded(true)
    })
  }, [router])

  if (!loaded) return null

  return (
    <main className="min-h-screen px-6 py-10" style={{ backgroundColor: '#1c2b1e' }}>

      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <p className="text-[10px] tracking-[0.35em] uppercase mb-1" style={{ color: 'rgba(196,184,154,0.5)' }}>
            La Sirène
          </p>
          <h1 className="text-2xl font-light tracking-wide" style={{ color: '#f5f0e8' }}>
            Team Dashboard
          </h1>
        </div>
        <button
          onClick={handleSignOut}
          className="text-[10px] tracking-wide uppercase underline underline-offset-2"
          style={{ color: '#c4b89a', textDecorationColor: 'rgba(196,184,154,0.4)' }}
        >
          Sign Out
        </button>
      </div>

      <div className="flex flex-col gap-4 max-w-2xl">

        {/* Appointments card */}
        <Link
          href="/admin/appointments"
          className="flex items-center justify-between px-6 py-6 transition-opacity hover:opacity-80"
          style={{
            backgroundColor: 'rgba(245,240,232,0.04)',
            border: '1px solid rgba(196,184,154,0.15)',
          }}
        >
          <div className="flex flex-col gap-2">
            <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: '#c4b89a' }}>
              Appointments
            </p>
            <p className="text-3xl font-light" style={{ color: '#f5f0e8' }}>
              {pendingCount}
              <span className="text-base ml-2" style={{ color: 'rgba(245,240,232,0.45)' }}>
                pending
              </span>
            </p>
            <p className="text-sm font-light" style={{ color: 'rgba(245,240,232,0.4)' }}>
              {pendingTotal > 0
                ? `$${pendingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} estimated`
                : 'No estimated value yet'}
            </p>
          </div>
          <span className="text-lg shrink-0 ml-4" style={{ color: 'rgba(196,184,154,0.5)' }}>→</span>
        </Link>

        {/* Orders card */}
        <Link
          href="/admin/orders"
          className="flex items-center justify-between px-6 py-6 transition-opacity hover:opacity-80"
          style={{
            backgroundColor: 'rgba(245,240,232,0.04)',
            border: '1px solid rgba(196,184,154,0.15)',
          }}
        >
          <div className="flex flex-col gap-2">
            <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: '#c4b89a' }}>
              Orders
            </p>
            <div className="flex items-baseline gap-4">
              <p className="text-3xl font-light" style={{ color: '#f5f0e8' }}>
                {underReviewCount}
                <span className="text-base ml-2" style={{ color: 'rgba(245,240,232,0.45)' }}>
                  to review
                </span>
              </p>
              <p className="text-3xl font-light" style={{ color: awaitingCount > 0 ? '#c87a3a' : 'rgba(245,240,232,0.2)' }}>
                {awaitingCount}
                <span className="text-base ml-2" style={{ color: awaitingCount > 0 ? 'rgba(200,122,58,0.7)' : 'rgba(245,240,232,0.2)' }}>
                  awaiting client
                </span>
              </p>
            </div>
            <p className="text-sm font-light" style={{ color: 'rgba(245,240,232,0.4)' }}>
              {orderTotal > 0
                ? `$${orderTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} total value`
                : 'No active orders'}
            </p>
          </div>
          <span className="text-lg shrink-0 ml-4" style={{ color: 'rgba(196,184,154,0.5)' }}>→</span>
        </Link>

      </div>
    </main>
  )
}
