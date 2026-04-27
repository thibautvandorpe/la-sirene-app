'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import AppHeader from '@/components/AppHeader'

type Appointment = {
  id: string
  scheduled_at: string
  notes: string | null
  status: string
  appointment_items: { id: string }[]
}

type Order = {
  id: string
  status: string
  total_price: number | null
  appointments: { scheduled_at: string } | null
}

const APPT_BADGE: Record<string, string> = {
  draft:     'bg-[#c4b89a]/15 text-[#c4b89a]',
  pending:   'bg-[#c4b89a]/20 text-[#c4b89a]',
  confirmed: 'bg-[#2e4a32]/60 text-[#a8c5a0]',
  cancelled: 'bg-[#3a1c1c]/60 text-[#c08080]',
}

const ORDER_BADGE: Record<string, string> = {
  pending:   'bg-[#c4b89a]/20 text-[#c4b89a]',
  confirmed: 'bg-[#2e4a32]/60 text-[#a8c5a0]',
  completed: 'bg-[#1c3a1e]/80 text-[#7aab80]',
  cancelled: 'bg-[#3a1c1c]/60 text-[#c08080]',
}

function badgeClass(map: Record<string, string>, status: string) {
  return map[status.toLowerCase()] ?? 'bg-[#c4b89a]/20 text-[#c4b89a]'
}

function formatApptDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

function formatOrderDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

const CARD = {
  backgroundColor: 'rgba(245, 240, 232, 0.04)',
  borderBottom: '1px solid rgba(196, 184, 154, 0.12)',
} as const

const MUTED = { color: 'rgba(245, 240, 232, 0.35)' } as const

export default function OrdersPage() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!session) { setLoaded(true); return }
        setLoggedIn(true)
        setLoaded(true)

        const [{ data: apptData }, { data: orderData }] = await Promise.all([
          supabase
            .from('appointments')
            .select('id, scheduled_at, notes, status, appointment_items(id)')
            .eq('client_id', session.user.id)
            .order('scheduled_at', { ascending: false }),
          supabase
            .from('orders')
            .select('id, status, total_price, appointments(scheduled_at)')
            .eq('client_id', session.user.id)
            .order('created_at', { ascending: false }),
        ])

        setAppointments((apptData as unknown as Appointment[]) ?? [])
        setOrders((orderData as unknown as Order[]) ?? [])
        setDataLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  async function handleDeleteDraft(appt: Appointment) {
    setAppointments(prev => prev.filter(a => a.id !== appt.id))
    await supabase.from('appointment_items').delete().eq('appointment_id', appt.id)
    await supabase.from('appointments').delete().eq('id', appt.id)
  }

  async function handleCancelAppointment(appt: Appointment) {
    setAppointments(prev =>
      prev.map(a => a.id === appt.id ? { ...a, status: 'cancelled' } : a),
    )
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id)
  }

  if (!loaded) return null

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />

      {loggedIn ? (
        <div className="flex flex-col px-6 pt-6 gap-8">

          {/* Book button */}
          <Link
            href="/book"
            className="w-full py-4 text-center text-[10px] tracking-[0.35em] uppercase font-medium"
            style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
          >
            Book an Appointment
          </Link>

          {/* ── My Appointments ── */}
          <section>
            <p className="text-[10px] tracking-[0.35em] uppercase text-[#c4b89a] mb-4">
              My Appointments
            </p>

            {!dataLoaded ? null : appointments.length === 0 ? (
              <p className="text-sm font-light text-center mt-4" style={MUTED}>
                No appointments yet
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {appointments.map(appt => {
                  const itemCount = appt.appointment_items?.length ?? 0
                  const isCancelled = appt.status === 'cancelled'

                  return (
                    <li
                      key={appt.id}
                      className="flex items-center justify-between py-4 px-4"
                      style={CARD}
                    >
                      <div className="flex flex-col gap-1">
                        <p
                          className="text-sm font-light"
                          style={{ color: isCancelled ? 'rgba(245, 240, 232, 0.35)' : '#f5f0e8' }}
                        >
                          {formatApptDate(appt.scheduled_at)}
                        </p>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[9px] tracking-[0.25em] uppercase px-2 py-0.5 rounded-sm ${badgeClass(APPT_BADGE, appt.status)}`}>
                            {appt.status === 'draft' ? 'In Progress' : appt.status}
                          </span>
                          {appt.notes && !isCancelled && (
                            <span className="text-[9px] font-light" style={{ color: 'rgba(196, 184, 154, 0.5)' }}>
                              {appt.notes}
                            </span>
                          )}
                        </div>

                        {itemCount > 0 && !isCancelled && (
                          <p className="text-[10px] font-light" style={MUTED}>
                            {itemCount} {itemCount === 1 ? 'item' : 'items'}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        {appt.status === 'draft' && (
                          <>
                            <Link
                              href={`/book?appointmentId=${appt.id}`}
                              className="text-xs font-light"
                              style={{ color: '#c4b89a' }}
                            >
                              Continue →
                            </Link>
                            <button
                              onClick={() => handleDeleteDraft(appt)}
                              className="text-xs font-light"
                              style={{ color: 'rgba(196, 184, 154, 0.4)' }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {appt.status === 'pending' && (
                          <>
                            <Link
                              href={`/orders/${appt.id}`}
                              className="text-xs font-light"
                              style={{ color: '#c4b89a' }}
                            >
                              View
                            </Link>
                            <button
                              onClick={() => handleCancelAppointment(appt)}
                              className="text-xs font-light"
                              style={{ color: 'rgba(196, 184, 154, 0.4)' }}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* ── My Orders ── */}
          <section>
            <p className="text-[10px] tracking-[0.35em] uppercase text-[#c4b89a] mb-4">
              My Orders
            </p>

            {!dataLoaded ? null : orders.length === 0 ? (
              <p className="text-sm font-light text-center mt-4" style={MUTED}>
                No orders yet
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {orders.map(order => (
                  <li
                    key={order.id}
                    className="flex items-center justify-between py-4 px-4"
                    style={CARD}
                  >
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-light text-[#f5f0e8]">
                        {order.appointments?.scheduled_at
                          ? formatOrderDate(order.appointments.scheduled_at)
                          : 'Date TBD'}
                      </p>
                      <span className={`self-start text-[9px] tracking-[0.25em] uppercase px-2 py-0.5 rounded-sm ${badgeClass(ORDER_BADGE, order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                    {order.total_price != null && (
                      <p className="text-sm font-light text-[#c4b89a] ml-4 shrink-0">
                        {order.total_price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-light tracking-wide text-[#f5f0e8]">
            Please sign in to access your orders
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
