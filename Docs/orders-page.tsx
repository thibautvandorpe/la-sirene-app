'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ─── Types ─────────────────────────────────────────────────────────────────────

type AppointmentItem = { id: string }

type Appointment = {
  id: string
  scheduled_at: string | null
  status: string
  notes: string | null
  created_at: string
  appointment_items: AppointmentItem[]
}

type Order = {
  id: string
  status: string
  total_price: number | null
  created_at: string
  appointments: { scheduled_at: string | null } | null
}

// ─── Badge configs ──────────────────────────────────────────────────────────────

const APPT_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  draft:     { label: 'Draft',     bg: 'rgba(120,113,108,0.25)', text: 'rgba(245,240,232,0.5)' },
  pending:   { label: 'Pending',   bg: 'rgba(196,184,154,0.15)', text: '#c4b89a' },
  confirmed: { label: 'Confirmed', bg: 'rgba(52,211,153,0.15)',  text: '#6ee7b7' },
  cancelled: { label: 'Cancelled', bg: 'rgba(248,113,113,0.12)', text: '#fca5a5' },
}

const ORDER_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  pending:     { label: 'Pending',     bg: 'rgba(196,184,154,0.15)', text: '#c4b89a' },
  in_progress: { label: 'In Progress', bg: 'rgba(96,165,250,0.15)',  text: '#93c5fd' },
  ready:       { label: 'Ready',       bg: 'rgba(52,211,153,0.15)',  text: '#6ee7b7' },
  completed:   { label: 'Completed',   bg: 'rgba(196,184,154,0.1)',  text: '#c4b89a' },
  cancelled:   { label: 'Cancelled',   bg: 'rgba(248,113,113,0.12)', text: '#fca5a5' },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// ─── Orders Page ───────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [user, setUser]                 = useState<any>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [orders, setOrders]             = useState<Order[]>([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const [apptRes, orderRes] = await Promise.all([
          supabase
            .from('appointments')
            .select('id, scheduled_at, status, notes, created_at, appointment_items(id)')
            .eq('client_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('orders')
            .select('id, status, total_price, created_at, appointments(scheduled_at)')
            .eq('client_id', user.id)
            .order('created_at', { ascending: false }),
        ])

        if (!apptRes.error) setAppointments((apptRes.data ?? []) as unknown as Appointment[])
        if (!orderRes.error) setOrders((orderRes.data ?? []) as unknown as Order[])
      }

      setLoading(false)
    }

    init()
  }, [])

  // ── Action handlers ─────────────────────────────────────────────────────────

  const handleDeleteDraft = async (apptId: string) => {
    setAppointments(prev => prev.filter(a => a.id !== apptId))
    await supabase.from('appointment_items').delete().eq('appointment_id', apptId)
    await supabase.from('appointments').delete().eq('id', apptId)
  }

  const handleCancelAppointment = async (apptId: string) => {
    setAppointments(prev =>
      prev.map(a => a.id === apptId ? { ...a, status: 'cancelled' } : a)
    )
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', apptId)
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#1c2b1e' }}>
        <div
          className="w-6 h-6 border-2 rounded-full animate-spin"
          style={{ borderColor: '#c4b89a', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  // ── Not logged in ───────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center" style={{ backgroundColor: '#1c2b1e' }}>
        <p className="font-serif text-xl mb-2" style={{ color: '#c4b89a' }}>Your Orders</p>
        <p className="text-sm mb-8" style={{ color: 'rgba(245,240,232,0.55)' }}>
          Sign in to view your appointments and orders.
        </p>
        <Link
          href="/login"
          className="px-8 py-3 rounded-full text-sm font-semibold"
          style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
        >
          Sign In
        </Link>
      </div>
    )
  }

  // ── Main view ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-28 px-4 pt-4" style={{ backgroundColor: '#1c2b1e' }}>

      {/* ── Book CTA ── */}
      <Link
        href="/book"
        className="flex items-center justify-center w-full py-4 rounded-2xl text-sm font-semibold tracking-wide mb-8"
        style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
      >
        + Book an Appointment
      </Link>

      {/* ══ MY APPOINTMENTS ══ */}
      <p className="text-xs uppercase tracking-widest mb-4" style={{ color: 'rgba(245,240,232,0.4)' }}>
        My Appointments
      </p>

      {appointments.length === 0 ? (
        <p className="text-sm mb-10" style={{ color: 'rgba(245,240,232,0.35)' }}>
          No appointments yet.
        </p>
      ) : (
        <div className="space-y-3 mb-10">
          {appointments.map(appt => {
            const badge      = APPT_BADGE[appt.status] ?? APPT_BADGE.draft
            const isCancelled = appt.status === 'cancelled'

            return (
              <div
                key={appt.id}
                className="rounded-2xl p-4 border"
                style={{
                  backgroundColor: isCancelled ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
                  borderColor: 'rgba(245,240,232,0.08)',
                  opacity: isCancelled ? 0.6 : 1,
                }}
              >
                {/* Date + badge */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    {appt.scheduled_at ? (
                      <>
                        <p className="text-sm font-medium" style={{ color: '#f5f0e8' }}>
                          {formatDate(appt.scheduled_at)}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'rgba(245,240,232,0.45)' }}>
                          {formatTime(appt.scheduled_at)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm" style={{ color: 'rgba(245,240,232,0.45)' }}>
                        No date selected
                      </p>
                    )}
                  </div>
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: badge.bg, color: badge.text }}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* Item count */}
                {appt.appointment_items.length > 0 && (
                  <p className="text-xs mb-2" style={{ color: 'rgba(245,240,232,0.45)' }}>
                    {appt.appointment_items.length} item{appt.appointment_items.length > 1 ? 's' : ''}
                  </p>
                )}

                {/* Draft actions */}
                {appt.status === 'draft' && (
                  <div className="flex gap-2 mt-3">
                    <Link
                      href="/book"
                      className="flex-1 text-center py-2 rounded-xl text-xs font-semibold"
                      style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
                    >
                      Continue →
                    </Link>
                    <button
                      onClick={() => handleDeleteDraft(appt.id)}
                      className="px-4 py-2 rounded-xl text-xs"
                      style={{ backgroundColor: 'rgba(248,113,113,0.12)', color: '#fca5a5' }}
                    >
                      Delete
                    </button>
                  </div>
                )}

                {/* Pending action */}
                {appt.status === 'pending' && (
                  <button
                    onClick={() => handleCancelAppointment(appt.id)}
                    className="mt-3 w-full py-2 rounded-xl text-xs"
                    style={{ backgroundColor: 'rgba(248,113,113,0.12)', color: '#fca5a5' }}
                  >
                    Cancel Appointment
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ══ MY ORDERS ══ */}
      <p className="text-xs uppercase tracking-widest mb-4" style={{ color: 'rgba(245,240,232,0.4)' }}>
        My Orders
      </p>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <p className="font-serif text-lg mb-2" style={{ color: '#c4b89a' }}>No orders yet</p>
          <p className="text-sm" style={{ color: 'rgba(245,240,232,0.45)' }}>
            Once La Sirène confirms your appointment, your order will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const badge = ORDER_BADGE[order.status] ?? ORDER_BADGE.pending
            return (
              <div
                key={order.id}
                className="rounded-2xl p-4 border"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(245,240,232,0.08)' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    {order.appointments?.scheduled_at ? (
                      <>
                        <p className="text-sm font-medium" style={{ color: '#f5f0e8' }}>
                          {formatDate(order.appointments.scheduled_at)}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'rgba(245,240,232,0.45)' }}>
                          {formatTime(order.appointments.scheduled_at)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm" style={{ color: 'rgba(245,240,232,0.45)' }}>No date on file</p>
                    )}
                  </div>
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: badge.bg, color: badge.text }}
                  >
                    {badge.label}
                  </span>
                </div>

                <div
                  className="flex items-center justify-between pt-3 border-t"
                  style={{ borderColor: 'rgba(245,240,232,0.08)' }}
                >
                  <p className="text-xs" style={{ color: 'rgba(245,240,232,0.35)' }}>
                    #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  {order.total_price != null && (
                    <p className="text-sm font-medium" style={{ color: '#c4b89a' }}>
                      ${order.total_price.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
