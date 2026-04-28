'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Appointment = {
  id: string
  delivery_method: string | null
  scheduled_at: string | null
  notes: string | null
  status: string
  created_at: string
  clients: { full_name: string } | null
  appointment_items: { estimated_price: number }[]
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: 'rgba(196,184,154,0.12)', color: '#c4b89a',  label: 'In Progress' },
  pending:   { bg: 'rgba(200,122,58,0.18)',  color: '#c87a3a',  label: 'Pending' },
  confirmed: { bg: 'rgba(46,74,50,0.6)',     color: '#a8c5a0',  label: 'Confirmed' },
  cancelled: { bg: 'rgba(58,28,28,0.6)',     color: '#c08080',  label: 'Cancelled' },
}

function badge(status: string) {
  return STATUS_BADGE[status.toLowerCase()] ?? STATUS_BADGE.pending
}

export default function AdminAppointments() {
  const router = useRouter()
  const [loaded, setLoaded] = useState(false)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [filter, setFilter] = useState<'pending' | 'draft' | 'cancelled' | 'all'>('pending')

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
        .from('appointments')
        .select('id, delivery_method, scheduled_at, notes, status, created_at, clients(full_name), appointment_items(estimated_price)')
        .order('created_at', { ascending: false })

      setAppointments((data as unknown as Appointment[]) ?? [])
      setLoaded(true)
    })
  }, [router])

  if (!loaded) return null

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
            Appointments
          </h1>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-6 max-w-2xl">
        {(['pending', 'draft', 'cancelled', 'all'] as const).map(f => {
          const isActive = filter === f
          const labels = { pending: 'Pending', draft: 'In Progress', cancelled: 'Cancelled', all: 'All' }
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-1.5 text-[9px] tracking-[0.2em] uppercase transition-colors"
              style={{
                backgroundColor: isActive ? 'rgba(196,184,154,0.15)' : 'transparent',
                color: isActive ? '#c4b89a' : 'rgba(245,240,232,0.35)',
                border: isActive ? '1px solid rgba(196,184,154,0.4)' : '1px solid rgba(196,184,154,0.1)',
              }}
            >
              {labels[f]}
            </button>
          )
        })}
      </div>

      {(() => {
        const filtered = filter === 'all'
          ? appointments
          : appointments.filter(a => a.status === filter)
        return filtered.length === 0 ? (
        <p className="text-sm font-light text-center mt-16" style={{ color: 'rgba(245,240,232,0.3)' }}>
          No {filter === 'all' ? '' : filter} appointments
        </p>
      ) : (
        <ul className="flex flex-col max-w-2xl">
          {filtered.map((appt, idx) => {
            const total = (appt.appointment_items ?? []).reduce((s, i) => s + (i.estimated_price ?? 0), 0)
            const { bg, color, label } = badge(appt.status)
            const deliveryLabel =
              appt.delivery_method === 'drop_off' ? 'Drop Off'
              : appt.delivery_method === 'fedex' ? 'FedEx'
              : 'Pick Up'

            return (
              <li key={appt.id}>
                <Link
                  href={`/admin/appointments/${appt.id}`}
                  className="flex items-center justify-between py-4 px-4 transition-opacity hover:opacity-75"
                  style={{
                    borderTop: idx === 0 ? '1px solid rgba(196,184,154,0.1)' : undefined,
                    borderBottom: '1px solid rgba(196,184,154,0.1)',
                  }}
                >
                  {/* Left: client + delivery */}
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1 pr-4">
                    <p className="text-sm font-light truncate" style={{ color: '#f5f0e8' }}>
                      {appt.clients?.full_name ?? '—'}
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
                        {(appt.delivery_method === 'pick_up' || appt.delivery_method == null) && appt.scheduled_at
                          ? ` · ${new Date(appt.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                          : ''}
                      </span>
                    </div>
                  </div>

                  {/* Right: total */}
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-sm font-light" style={{ color: total > 0 ? '#c4b89a' : 'rgba(245,240,232,0.25)' }}>
                      {total > 0
                        ? `$${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : 'TBD'}
                    </p>
                    <span style={{ color: 'rgba(196,184,154,0.35)' }}>›</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )
      })()}
    </main>
  )
}
