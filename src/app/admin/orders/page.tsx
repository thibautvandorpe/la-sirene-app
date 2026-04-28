'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Order = {
  id: string
  status: string
  total_price: number | null
  delivery_method: string | null
  scheduled_at: string | null
  created_at: string
  clients: { full_name: string } | null
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  under_review:          { bg: 'rgba(196,184,154,0.12)', color: '#c4b89a',  label: 'Under Review' },
  awaiting_confirmation: { bg: 'rgba(200,122,58,0.18)',  color: '#c87a3a',  label: 'Awaiting Confirmation' },
  in_progress:           { bg: 'rgba(46,74,50,0.6)',     color: '#a8c5a0',  label: 'In Progress' },
  ready:                 { bg: 'rgba(28,58,30,0.8)',     color: '#7aab80',  label: 'Ready' },
  completed:             { bg: 'rgba(28,58,30,0.8)',     color: '#7aab80',  label: 'Completed' },
  cancelled:             { bg: 'rgba(58,28,28,0.6)',     color: '#c08080',  label: 'Cancelled' },
}

function badge(status: string) {
  return STATUS_BADGE[status.toLowerCase()] ?? STATUS_BADGE.under_review
}

type FilterKey = 'under_review' | 'awaiting_confirmation' | 'in_progress' | 'all'

export default function AdminOrders() {
  const router = useRouter()
  const [loaded, setLoaded] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState<FilterKey>('under_review')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      const { data: client } = await supabase
        .from('clients')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (client?.role !== 'admin') { router.replace('/'); return }

      const { data } = await supabase
        .from('orders')
        .select('id, status, total_price, delivery_method, scheduled_at, created_at, clients(full_name)')
        .order('created_at', { ascending: false })

      setOrders((data as unknown as Order[]) ?? [])
      setLoaded(true)
    })
  }, [router])

  if (!loaded) return null

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'under_review',          label: 'Under Review' },
    { key: 'awaiting_confirmation',  label: 'Awaiting' },
    { key: 'in_progress',            label: 'In Progress' },
    { key: 'all',                    label: 'All' },
  ]

  const filtered = filter === 'all'
    ? orders
    : orders.filter(o => o.status === filter)

  return (
    <main className="min-h-screen px-6 py-10" style={{ backgroundColor: '#1c2b1e' }}>

      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <Link
          href="/admin"
          className="text-lg leading-none"
          style={{ color: '#c4b89a' }}
          aria-label="Back to dashboard"
        >
          ←
        </Link>
        <div>
          <p className="text-[10px] tracking-[0.35em] uppercase mb-0.5" style={{ color: 'rgba(196,184,154,0.5)' }}>
            Team Dashboard
          </p>
          <h1 className="text-xl font-light tracking-wide" style={{ color: '#f5f0e8' }}>
            Orders
          </h1>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-6 max-w-2xl flex-wrap">
        {FILTERS.map(({ key, label }) => {
          const isActive = filter === key
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="px-4 py-1.5 text-[9px] tracking-[0.2em] uppercase transition-colors"
              style={{
                backgroundColor: isActive ? 'rgba(196,184,154,0.15)' : 'transparent',
                color: isActive ? '#c4b89a' : 'rgba(245,240,232,0.35)',
                border: isActive ? '1px solid rgba(196,184,154,0.4)' : '1px solid rgba(196,184,154,0.1)',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm font-light text-center mt-16" style={{ color: 'rgba(245,240,232,0.3)' }}>
          No {filter === 'all' ? '' : filter.replace(/_/g, ' ')} orders
        </p>
      ) : (
        <ul className="flex flex-col max-w-2xl">
          {filtered.map((order, idx) => {
            const { bg, color, label } = badge(order.status)
            const deliveryLabel =
              order.delivery_method === 'drop_off' ? 'Drop Off'
              : order.delivery_method === 'fedex' ? 'FedEx'
              : 'Pick Up'

            return (
              <li key={order.id}>
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="flex items-center justify-between py-4 px-4 transition-opacity hover:opacity-75"
                  style={{
                    borderTop: idx === 0 ? '1px solid rgba(196,184,154,0.1)' : undefined,
                    borderBottom: '1px solid rgba(196,184,154,0.1)',
                  }}
                >
                  {/* Left: client + status + delivery */}
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1 pr-4">
                    <p className="text-sm font-light truncate" style={{ color: '#f5f0e8' }}>
                      {order.clients?.full_name ?? '—'}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 rounded-sm"
                        style={{ backgroundColor: bg, color }}
                      >
                        {label}
                      </span>
                      <span className="text-[10px] font-light" style={{ color: 'rgba(245,240,232,0.4)' }}>
                        {deliveryLabel}
                        {(order.delivery_method === 'pick_up' || order.delivery_method == null) && order.scheduled_at
                          ? ` · ${new Date(order.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                          : ''}
                      </span>
                    </div>
                  </div>

                  {/* Right: total */}
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-sm font-light" style={{ color: order.total_price ? '#c4b89a' : 'rgba(245,240,232,0.25)' }}>
                      {order.total_price
                        ? `$${order.total_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : 'TBD'}
                    </p>
                    <span style={{ color: 'rgba(196,184,154,0.35)' }}>›</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
