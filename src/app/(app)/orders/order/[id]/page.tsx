'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type OrderItem = {
  id: string
  final_price: number
  special_instructions: string | null
  reviewed_price: number | null
  services: { category: string; sub_category: string } | null
  reviewed_service: { category: string; sub_category: string } | null
  garments: { brand: string | null; color: string | null } | null
  order_item_photos: { url: string }[]
}

type Order = {
  id: string
  status: string
  total_price: number | null
  delivery_method: string | null
  scheduled_at: string | null
  notes: string | null
  admin_message: string | null
  order_items: OrderItem[]
}

function OrderDetailInner() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loaded, setLoaded] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      // 1. Fetch order with original service only — can't join services twice in one query
      const { data, error: queryErr } = await supabase
        .from('orders')
        .select(`
          id, status, total_price, delivery_method, scheduled_at, notes, admin_message,
          order_items(
            id, final_price, special_instructions, reviewed_price, reviewed_service_id,
            services!order_items_service_id_fkey(category, sub_category),
            garments(brand, color),
            order_item_photos(url)
          )
        `)
        .eq('id', id)
        .eq('client_id', session.user.id)
        .maybeSingle()

      if (queryErr) { console.error(queryErr); router.replace('/orders'); return }
      if (!data) { router.replace('/orders'); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = data as any

      // 2. Fetch reviewed services separately for items that have one
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reviewedIds = (raw.order_items ?? []).map((i: any) => i.reviewed_service_id).filter(Boolean) as string[]
      const reviewedMap: Record<string, { category: string; sub_category: string }> = {}
      if (reviewedIds.length > 0) {
        const { data: revSvcs } = await supabase
          .from('services')
          .select('id, category, sub_category')
          .in('id', reviewedIds)
        ;(revSvcs ?? []).forEach((s: { id: string; category: string; sub_category: string }) => {
          reviewedMap[s.id] = s
        })
      }

      const enriched: Order = {
        ...raw,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        order_items: (raw.order_items ?? []).map((item: any) => ({
          id: item.id,
          final_price: item.final_price ?? 0,
          special_instructions: item.special_instructions ?? null,
          reviewed_price: item.reviewed_price ?? null,
          services: Array.isArray(item.services)
            ? (item.services[0] ?? null)
            : (item.services ?? null),
          reviewed_service: item.reviewed_service_id ? (reviewedMap[item.reviewed_service_id] ?? null) : null,
          garments: Array.isArray(item.garments) ? (item.garments[0] ?? null) : (item.garments ?? null),
          order_item_photos: Array.isArray(item.order_item_photos) ? item.order_item_photos : [],
        })),
      }

      setOrder(enriched)
      setLoaded(true)
    })
  }, [id, router])

  async function handleConfirm() {
    if (!order) return
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase
        .from('orders')
        .update({ status: 'in_progress' })
        .eq('id', order.id)
      if (err) throw err
      router.replace('/orders')
    } catch {
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  if (!loaded) return null
  if (!order) return null

  const deliveryLabel =
    order.delivery_method === 'drop_off' ? 'Drop Off'
    : order.delivery_method === 'fedex' ? 'FedEx'
    : 'Pick Up'

  return (
    <main className="min-h-screen flex flex-col px-6 py-8" style={{ backgroundColor: '#1c2b1e' }}>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.back()}
          className="text-lg leading-none"
          style={{ color: '#c4b89a' }}
          aria-label="Back to orders"
        >
          ←
        </button>
        <h1 className="text-xl font-light tracking-wide" style={{ color: '#f5f0e8' }}>
          Order Review
        </h1>
      </div>

      {/* Delivery info */}
      <div
        className="flex flex-col gap-1 pl-3 mb-8"
        style={{ borderLeft: '1px solid rgba(196,184,154,0.35)' }}
      >
        <p className="text-xs font-light" style={{ color: 'rgba(196,184,154,0.75)' }}>
          {deliveryLabel}
        </p>
        {(order.delivery_method === 'pick_up' || order.delivery_method == null) && order.scheduled_at && (
          <p className="text-xs font-light" style={{ color: 'rgba(245,240,232,0.55)' }}>
            {new Date(order.scheduled_at).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            })}
          </p>
        )}
        <span
          className="self-start mt-1 text-[9px] tracking-[0.25em] uppercase px-2 py-0.5 rounded-sm"
          style={{ backgroundColor: 'rgba(200,122,58,0.18)', color: '#c87a3a' }}
        >
          Awaiting Your Confirmation
        </span>
      </div>

      {/* Admin message */}
      {order.admin_message && (
        <div
          className="mb-8 px-4 py-3"
          style={{ backgroundColor: 'rgba(196,184,154,0.06)', border: '1px solid rgba(196,184,154,0.15)' }}
        >
          <p className="text-[9px] tracking-[0.2em] uppercase mb-1.5" style={{ color: 'rgba(196,184,154,0.6)' }}>
            Message from La Sirène
          </p>
          <p className="text-[12px] font-light leading-relaxed" style={{ color: 'rgba(245,240,232,0.75)' }}>
            {order.admin_message}
          </p>
        </div>
      )}

      {/* Items label */}
      <p className="text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: 'rgba(196,184,154,0.6)' }}>
        Items
      </p>

      {/* Items list */}
      <ul className="flex flex-col mb-1">
        {order.order_items.map((item, idx) => {
          const hasChange = !!item.reviewed_service || item.reviewed_price != null
          const displayService = hasChange && item.reviewed_service
            ? item.reviewed_service
            : item.services
          const displayPrice = hasChange && item.reviewed_price != null
            ? item.reviewed_price
            : item.final_price

          return (
            <li
              key={item.id}
              className="flex flex-col py-4"
              style={{
                borderTop: idx === 0 ? '1px solid rgba(196,184,154,0.15)' : undefined,
                borderBottom: '1px solid rgba(196,184,154,0.15)',
              }}
            >
              {/* Original — shown crossed out only if something changed */}
              {hasChange && (
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-light" style={{ color: 'rgba(245,240,232,0.3)', textDecoration: 'line-through' }}>
                    {item.services?.sub_category ?? '—'}
                  </p>
                  <p className="text-sm font-light ml-4 shrink-0" style={{ color: 'rgba(196,184,154,0.3)', textDecoration: 'line-through' }}>
                    {item.final_price > 0
                      ? `$${item.final_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : 'TBD'}
                  </p>
                </div>
              )}

              {/* Current (revised or original) */}
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1 flex-1 min-w-0 pr-4">
                  <p className="text-sm font-light" style={{ color: '#f5f0e8' }}>
                    {displayService?.sub_category ?? '—'}
                  </p>
                  <p className="text-[11px] font-light" style={{ color: 'rgba(245,240,232,0.4)' }}>
                    {[item.garments?.brand, item.garments?.color].filter(Boolean).join(' · ') || displayService?.category || ''}
                  </p>
                  {item.special_instructions && (
                    <p className="text-[11px] font-light italic mt-0.5" style={{ color: 'rgba(245,240,232,0.35)' }}>
                      {'"'}{item.special_instructions}{'"'}
                    </p>
                  )}
                  {item.order_item_photos.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {item.order_item_photos.map((photo, i) => (
                        <a key={i} href={photo.url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={photo.url}
                            alt=""
                            className="w-16 h-16 object-cover rounded-sm"
                            style={{ border: '1px solid rgba(196,184,154,0.2)' }}
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-sm font-light shrink-0" style={{ color: '#c4b89a' }}>
                  {displayPrice > 0
                    ? `$${displayPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                    : 'TBD'}
                </p>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Total */}
      <div className="flex items-center justify-between mt-5 mb-8 px-1">
        <p className="text-[10px] tracking-[0.3em] uppercase font-medium" style={{ color: '#c4b89a' }}>
          Total
        </p>
        <p className="text-base font-light" style={{ color: '#c4b89a' }}>
          {order.total_price != null
            ? order.total_price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
            : 'TBD'}
        </p>
      </div>

      {/* Disclaimer */}
      <p className="text-[11px] font-light leading-relaxed mb-8" style={{ color: 'rgba(245,240,232,0.35)' }}>
        Please review the services and pricing above. By confirming, you agree to proceed with the order as shown.
      </p>

      {/* Error */}
      {error && (
        <p className="text-xs font-light mb-4" style={{ color: '#e8a090' }}>
          {error}
        </p>
      )}

      {/* Confirm action */}
      {confirming ? (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-light" style={{ color: 'rgba(245,240,232,0.5)' }}>
            By confirming, you approve the order and our team will begin working on your garments.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 py-3 text-[10px] tracking-[0.3em] uppercase font-medium disabled:opacity-40"
              style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
            >
              {saving ? 'Confirming…' : 'Yes, Confirm'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={saving}
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
          style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
        >
          Confirm Order
        </button>
      )}

    </main>
  )
}

export default function ClientOrderDetailPage() {
  return (
    <Suspense>
      <OrderDetailInner />
    </Suspense>
  )
}
