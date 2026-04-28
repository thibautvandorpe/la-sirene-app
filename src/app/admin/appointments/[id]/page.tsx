'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type AppointmentItem = {
  id: string
  garment_id: string
  service_id: string
  estimated_price: number
  special_instructions: string | null
  garments: { brand: string | null; color: string | null } | null
  services: { category: string; sub_category: string } | null
}

type Appointment = {
  id: string
  client_id: string
  delivery_method: string | null
  scheduled_at: string | null
  notes: string | null
  status: string
  clients: { full_name: string; email: string } | null
  appointment_items: AppointmentItem[]
}

export default function AdminAppointmentDetail() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loaded, setLoaded] = useState(false)
  const [appt, setAppt] = useState<Appointment | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [converting, setConverting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        .select(`
          id, client_id, delivery_method, scheduled_at, notes, status,
          clients(full_name, email),
          appointment_items(
            id, garment_id, service_id, estimated_price, special_instructions,
            garments(brand, color),
            services(category, sub_category)
          )
        `)
        .eq('id', id)
        .maybeSingle()

      setAppt(data as unknown as Appointment ?? null)
      setLoaded(true)
    })
  }, [router, id])

  async function handleConvert() {
    if (!appt) return
    setConverting(true)
    setError(null)
    try {
      const items = appt.appointment_items ?? []
      const totalPrice = items.reduce((sum, i) => sum + (i.estimated_price ?? 0), 0)

      // 1. Create the order
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          client_id: appt.client_id,
          appointment_id: appt.id,
          status: 'under_review',
          delivery_method: appt.delivery_method,
          scheduled_at: appt.scheduled_at,
          notes: appt.notes,
          total_price: totalPrice,
        })
        .select('id')
        .single()
      if (orderErr) throw orderErr

      // 2. Copy appointment_items → order_items
      if (items.length > 0) {
        const { error: itemsErr } = await supabase
          .from('order_items')
          .insert(
            items.map(ai => ({
              order_id: order.id,
              garment_id: ai.garment_id,
              service_id: ai.service_id,
              special_instructions: ai.special_instructions,
              final_price: ai.estimated_price,
            }))
          )
        if (itemsErr) throw itemsErr
      }

      // 3. Delete appointment_items
      const { error: delItemsErr } = await supabase
        .from('appointment_items')
        .delete()
        .eq('appointment_id', appt.id)
      if (delItemsErr) throw delItemsErr

      // 4. Delete appointment
      const { error: delApptErr } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appt.id)
      if (delApptErr) throw delApptErr

      // 5. Navigate back to appointments list
      router.replace('/admin/appointments')
    } catch {
      setError('Something went wrong. Please try again.')
      setConverting(false)
    }
  }

  async function handleDelete() {
    if (!appt) return
    setDeleting(true)
    setError(null)
    try {
      const items = appt.appointment_items ?? []

      // 1. For each item, fetch photos then delete storage files + photo rows
      await Promise.all(
        items.map(async item => {
          const { data: photos } = await supabase
            .from('appointment_item_photos')
            .select('url')
            .eq('appointment_item_id', item.id)

          const urls = (photos ?? []).map((p: { url: string }) => p.url)

          // Delete files from storage
          if (urls.length > 0) {
            const paths = urls
              .map((url: string) => {
                const parts = url.split('/appointment-photos/')
                return parts.length >= 2 ? parts[1] : null
              })
              .filter(Boolean) as string[]
            if (paths.length > 0) {
              await supabase.storage.from('appointment-photos').remove(paths)
            }
          }

          // Delete appointment_item_photos rows
          await supabase
            .from('appointment_item_photos')
            .delete()
            .eq('appointment_item_id', item.id)
        })
      )

      // 2. Delete appointment_items
      await supabase.from('appointment_items').delete().eq('appointment_id', appt.id)

      // 3. Delete appointment
      await supabase.from('appointments').delete().eq('id', appt.id)

      router.replace('/admin/appointments')
    } catch {
      setError('Something went wrong. Please try again.')
      setDeleting(false)
    }
  }

  if (!loaded) return null

  if (!appt) {
    return (
      <main className="min-h-screen px-6 py-10" style={{ backgroundColor: '#1c2b1e' }}>
        <Link href="/admin/appointments" className="text-sm font-light" style={{ color: '#c4b89a' }}>
          ← Back
        </Link>
        <p className="mt-10 text-sm font-light text-center" style={{ color: 'rgba(245,240,232,0.35)' }}>
          Appointment not found.
        </p>
      </main>
    )
  }

  const items = appt.appointment_items ?? []
  const total = items.reduce((s, i) => s + (i.estimated_price ?? 0), 0)
  const deliveryLabel =
    appt.delivery_method === 'drop_off' ? 'Drop Off'
    : appt.delivery_method === 'fedex' ? 'FedEx'
    : 'Pick Up'
  const isPending = appt.status === 'pending'
  const isCancelled = appt.status === 'cancelled'

  return (
    <main className="min-h-screen px-6 py-10" style={{ backgroundColor: '#1c2b1e' }}>

      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <Link
          href="/admin/appointments"
          className="text-lg leading-none"
          style={{ color: '#c4b89a' }}
          aria-label="Back to appointments"
        >
          ←
        </Link>
        <div>
          <p className="text-[10px] tracking-[0.35em] uppercase mb-0.5" style={{ color: 'rgba(196,184,154,0.5)' }}>
            Appointments
          </p>
          <h1 className="text-xl font-light tracking-wide" style={{ color: '#f5f0e8' }}>
            {appt.clients?.full_name ?? '—'}
          </h1>
        </div>
      </div>

      {/* Client + delivery info */}
      <div
        className="flex flex-col gap-1 pl-3 mb-8"
        style={{ borderLeft: '1px solid rgba(196,184,154,0.35)' }}
      >
        <p className="text-xs font-light" style={{ color: 'rgba(245,240,232,0.4)' }}>
          {appt.clients?.email ?? ''}
        </p>
        <p className="text-xs font-light" style={{ color: 'rgba(196,184,154,0.75)' }}>
          {deliveryLabel}
        </p>
        {(appt.delivery_method === 'pick_up' || appt.delivery_method == null) && appt.scheduled_at && (
          <>
            <p className="text-xs font-light" style={{ color: 'rgba(245,240,232,0.55)' }}>
              {new Date(appt.scheduled_at).toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              })}
            </p>
            {appt.notes && (
              <p className="text-xs font-light" style={{ color: 'rgba(245,240,232,0.4)' }}>
                {appt.notes}
              </p>
            )}
          </>
        )}
      </div>

      {/* Section label */}
      <p className="text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: 'rgba(196,184,154,0.6)' }}>
        Items
      </p>

      {/* Items list */}
      <ul className="flex flex-col mb-1 max-w-2xl">
        {items.map((item, idx) => (
          <li
            key={item.id}
            className="flex items-start justify-between py-4"
            style={{
              borderTop: idx === 0 ? '1px solid rgba(196,184,154,0.15)' : undefined,
              borderBottom: '1px solid rgba(196,184,154,0.15)',
            }}
          >
            <div className="flex flex-col gap-1 flex-1 min-w-0 pr-6">
              <p className="text-sm font-light" style={{ color: '#f5f0e8' }}>
                {item.services?.sub_category ?? '—'}
              </p>
              <p className="text-[11px] font-light" style={{ color: 'rgba(245,240,232,0.4)' }}>
                {[item.garments?.brand, item.garments?.color].filter(Boolean).join(' · ') || item.services?.category || ''}
              </p>
              {item.special_instructions && (
                <p className="text-[11px] font-light italic mt-0.5" style={{ color: 'rgba(245,240,232,0.3)' }}>
                  {'"'}{item.special_instructions}{'"'}
                </p>
              )}
            </div>
            <p className="text-sm font-light shrink-0" style={{ color: '#c4b89a' }}>
              {item.estimated_price > 0
                ? `$${item.estimated_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                : 'TBD'}
            </p>
          </li>
        ))}
      </ul>

      {/* Total */}
      <div className="flex items-center justify-between mt-5 mb-10 px-1 max-w-2xl">
        <p className="text-[10px] tracking-[0.3em] uppercase font-medium" style={{ color: '#c4b89a' }}>
          Estimated Total
        </p>
        <p className="text-base font-light" style={{ color: '#c4b89a' }}>
          ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Convert to Order — only for pending appointments */}
      {isCancelled && (
        <div className="max-w-2xl">
          {error && (
            <p className="text-xs font-light mb-4" style={{ color: '#e8a090' }}>
              {error}
            </p>
          )}
          {confirmingDelete ? (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-light" style={{ color: 'rgba(245,240,232,0.5)' }}>
                This will permanently delete the appointment, all its items and photos. Continue?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-3 text-[10px] tracking-[0.3em] uppercase font-medium disabled:opacity-40"
                  style={{ backgroundColor: 'rgba(220,80,60,0.75)', color: '#f5f0e8' }}
                >
                  {deleting ? 'Deleting…' : 'Yes, Delete'}
                </button>
                <button
                  onClick={() => { setConfirmingDelete(false); setError(null) }}
                  disabled={deleting}
                  className="flex-1 py-3 text-[10px] tracking-[0.3em] uppercase font-light disabled:opacity-40"
                  style={{ border: '1px solid rgba(196,184,154,0.25)', color: 'rgba(196,184,154,0.6)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setConfirmingDelete(true); setError(null) }}
              className="w-full py-3 text-[10px] tracking-[0.3em] uppercase font-medium"
              style={{ border: '1px solid rgba(220,80,60,0.4)', color: 'rgba(220,80,60,0.7)', backgroundColor: 'transparent' }}
            >
              Delete Appointment
            </button>
          )}
        </div>
      )}

      {isPending && (
        <div className="max-w-2xl">
          {error && (
            <p className="text-xs font-light mb-4" style={{ color: '#e8a090' }}>
              {error}
            </p>
          )}
          {confirming ? (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-light" style={{ color: 'rgba(245,240,232,0.5)' }}>
                This will create an order and remove the appointment. Continue?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleConvert}
                  disabled={converting}
                  className="flex-1 py-3 text-[10px] tracking-[0.3em] uppercase font-medium disabled:opacity-40"
                  style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
                >
                  {converting ? 'Converting…' : 'Yes, Convert'}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={converting}
                  className="flex-1 py-3 text-[10px] tracking-[0.3em] uppercase font-light disabled:opacity-40"
                  style={{ border: '1px solid rgba(196,184,154,0.25)', color: 'rgba(196,184,154,0.6)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="w-full py-3 text-[10px] tracking-[0.3em] uppercase font-medium"
              style={{ border: '1px solid #c4b89a', color: '#c4b89a', backgroundColor: 'transparent' }}
            >
              Convert to Order
            </button>
          )}
        </div>
      )}
    </main>
  )
}
