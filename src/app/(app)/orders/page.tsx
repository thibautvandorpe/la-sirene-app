'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import AppHeader from '@/components/AppHeader'

type Appointment = {
  id: string
  scheduled_at: string | null
  notes: string | null
  status: string
  delivery_method: string | null
  appointment_items: { id: string }[]
}

type Order = {
  id: string
  status: string
  total_price: number | null
  delivery_method: string | null
  scheduled_at: string | null
  notes: string | null
}

const APPT_BADGE: Record<string, string> = {
  draft:     'bg-[#c4b89a]/15 text-[#c4b89a]',
  pending:   'bg-[#c87a3a]/20 text-[#c87a3a]',
  confirmed: 'bg-[#2e4a32]/60 text-[#a8c5a0]',
  cancelled: 'bg-[#3a1c1c]/60 text-[#c08080]',
}

const ORDER_BADGE: Record<string, string> = {
  under_review:           'bg-[#c4b89a]/15 text-[#c4b89a]',
  awaiting_confirmation:  'bg-[#c87a3a]/20 text-[#c87a3a]',
  in_progress:            'bg-[rgba(30,70,100,0.45)] text-[#70b8d8]',
  ready:                  'bg-[rgba(20,75,35,0.65)] text-[#5dce7a]',
  completed:              'bg-[rgba(50,60,55,0.5)] text-[#8fa8a0]',
  cancelled:              'bg-[#3a1c1c]/60 text-[#c08080]',
}

const ORDER_LABEL: Record<string, string> = {
  under_review:           'Under Review',
  awaiting_confirmation:  'Awaiting Confirmation',
  in_progress:            'In Progress',
  ready:                  'Ready',
  completed:              'Completed',
  cancelled:              'Cancelled',
}

function orderStatusLabel(status: string) {
  return ORDER_LABEL[status.toLowerCase()] ?? status
}

function badgeClass(map: Record<string, string>, status: string) {
  return map[status.toLowerCase()] ?? 'bg-[#c4b89a]/20 text-[#c4b89a]'
}

function formatApptDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
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
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!session) { setLoaded(true); return }
        setLoggedIn(true)
        setLoaded(true)

        const [{ data: apptData }, { data: orderData }] = await Promise.all([
          supabase
            .from('appointments')
            .select('id, scheduled_at, notes, status, delivery_method, appointment_items(id)')
            .eq('client_id', session.user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('orders')
            .select('id, status, total_price, delivery_method, scheduled_at, notes')
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

      {/* Fixed Book button — always visible above tab bar */}
      {loggedIn && (
        <Link
          href="/book"
          className="fixed left-0 right-0 z-10 py-4 text-center text-[10px] tracking-[0.35em] uppercase font-medium"
          style={{
            backgroundColor: '#c4b89a',
            color: '#1c2b1e',
            bottom: 'calc(59px + env(safe-area-inset-bottom))',
          }}
        >
          Book an Appointment
        </Link>
      )}

      {loggedIn ? (
        <div className="flex flex-col px-6 pt-6 pb-36 gap-8">

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
                      <div className="flex flex-col gap-1.5">
                        {/* Line 1 — delivery method + date/time (pick up only) */}
                        <div className="flex flex-col gap-0.5">
                          <p
                            className="text-sm font-light"
                            style={{ color: isCancelled ? 'rgba(245, 240, 232, 0.35)' : '#f5f0e8' }}
                          >
                            {appt.delivery_method === 'drop_off'
                              ? 'Drop Off'
                              : appt.delivery_method === 'fedex'
                                ? 'FedEx'
                                : 'Pick Up'}
                          </p>
                          {(appt.delivery_method === 'pick_up' || appt.delivery_method == null) && appt.scheduled_at && (
                            <p className="text-xs font-light" style={{ color: isCancelled ? 'rgba(245, 240, 232, 0.25)' : 'rgba(245, 240, 232, 0.5)' }}>
                              {formatApptDate(appt.scheduled_at)}
                              {appt.notes ? ` · ${appt.notes}` : ''}
                            </p>
                          )}
                        </div>

                        {/* Line 2 — status badge */}
                        <span className={`self-start text-[9px] tracking-[0.25em] uppercase px-2 py-0.5 rounded-sm ${badgeClass(APPT_BADGE, appt.status)}`}>
                          {{ draft: 'Draft', pending: 'Pending', confirmed: 'Confirmed', cancelled: 'Cancelled' }[appt.status] ?? appt.status}
                        </span>

                        {/* Line 3 — item count */}
                        {itemCount > 0 && !isCancelled && (
                          <p className="text-[10px] font-light" style={MUTED}>
                            {itemCount} {itemCount === 1 ? 'item' : 'items'}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      {confirmDeleteId === appt.id ? (
                        <div className="flex flex-col items-end gap-2 ml-4 shrink-0">
                          <p className="text-[10px] font-light text-right" style={{ color: 'rgba(245, 240, 232, 0.5)' }}>
                            Delete this draft?
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { handleDeleteDraft(appt); setConfirmDeleteId(null) }}
                              className="px-3 py-1.5 text-[9px] tracking-[0.2em] uppercase font-medium"
                              style={{ backgroundColor: 'rgba(220,80,60,0.75)', color: '#f5f0e8' }}
                            >
                              Yes, Delete
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-3 py-1.5 text-[9px] tracking-[0.2em] uppercase font-light"
                              style={{ border: '1px solid rgba(196,184,154,0.25)', color: 'rgba(196,184,154,0.6)' }}
                            >
                              Keep
                            </button>
                          </div>
                        </div>
                      ) : confirmCancelId === appt.id ? (
                        <div className="flex flex-col items-end gap-2 ml-4 shrink-0">
                          <p className="text-[10px] font-light text-right" style={{ color: 'rgba(245, 240, 232, 0.5)' }}>
                            Cancel this appointment?
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { handleCancelAppointment(appt); setConfirmCancelId(null) }}
                              className="px-3 py-1.5 text-[9px] tracking-[0.2em] uppercase font-medium"
                              style={{ backgroundColor: 'rgba(220,80,60,0.75)', color: '#f5f0e8' }}
                            >
                              Yes, Cancel
                            </button>
                            <button
                              onClick={() => setConfirmCancelId(null)}
                              className="px-3 py-1.5 text-[9px] tracking-[0.2em] uppercase font-light"
                              style={{ border: '1px solid rgba(196,184,154,0.25)', color: 'rgba(196,184,154,0.6)' }}
                            >
                              Keep
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 ml-4 shrink-0">
                          {appt.status === 'draft' && (
                            <>
                              <Link
                                href={`/book?appointmentId=${appt.id}`}
                                className="text-xs font-light"
                                style={{ color: '#c4b89a' }}
                              >
                                Continue
                              </Link>
                              <button
                                onClick={() => setConfirmDeleteId(appt.id)}
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
                                onClick={() => setConfirmCancelId(appt.id)}
                                className="text-xs font-light"
                                style={{ color: 'rgba(196, 184, 154, 0.4)' }}
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      )}
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
                    <div className="flex flex-col gap-1.5">
                      {/* Line 1 — delivery method + date/time (pick up only) */}
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-light" style={{ color: '#f5f0e8' }}>
                          {order.delivery_method === 'drop_off'
                            ? 'Drop Off'
                            : order.delivery_method === 'fedex'
                              ? 'FedEx'
                              : 'Pick Up'}
                        </p>
                        {(order.delivery_method === 'pick_up' || order.delivery_method == null) && order.scheduled_at && (
                          <p className="text-xs font-light" style={{ color: 'rgba(245,240,232,0.5)' }}>
                            {formatApptDate(order.scheduled_at)}
                            {order.notes ? ` · ${order.notes}` : ''}
                          </p>
                        )}
                      </div>
                      {/* Line 2 — status badge */}
                      <span className={`self-start text-[9px] tracking-[0.25em] uppercase px-2 py-0.5 rounded-sm ${badgeClass(ORDER_BADGE, order.status)}`}>
                        {orderStatusLabel(order.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 ml-4 shrink-0">
                      {order.total_price != null && (
                        <p className="text-sm font-light text-[#c4b89a]">
                          {order.total_price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                        </p>
                      )}
                      {order.status === 'awaiting_confirmation' && (
                        <Link
                          href={`/orders/order/${order.id}`}
                          className="text-xs font-light"
                          style={{ color: '#c87a3a' }}
                        >
                          Review
                        </Link>
                      )}
                    </div>
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
