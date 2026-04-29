'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Service = {
  id: string
  category: string
  sub_category: string
  price: number
}

type OrderItem = {
  id: string
  garment_id: string
  service_id: string
  final_price: number
  special_instructions: string | null
  reviewed_service_id: string | null
  reviewed_price: number | null
  treatment_notes: string | null
  garments: { brand: string | null; color: string | null } | null
  services: { category: string; sub_category: string; price: number } | null
  reviewed_service: { category: string; sub_category: string; price: number } | null
  order_item_photos: { url: string }[]
}

type Order = {
  id: string
  client_id: string
  status: string
  total_price: number | null
  delivery_method: string | null
  scheduled_at: string | null
  notes: string | null
  admin_message: string | null
  clients: { full_name: string; email: string } | null
  order_items: OrderItem[]
}

// Local state per item for admin edits
type ItemEdit = {
  reviewedServiceId: string   // '' = no change
  reviewedPrice: string       // '' = no change
  treatmentNotes: string      // free-text, filled in when in_progress
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  under_review:          { bg: 'rgba(196,184,154,0.12)', color: '#c4b89a',  label: 'Under Review' },
  awaiting_confirmation: { bg: 'rgba(200,122,58,0.18)',  color: '#c87a3a',  label: 'Awaiting Confirmation' },
  in_progress:           { bg: 'rgba(30,70,100,0.45)',   color: '#70b8d8',  label: 'In Progress' },
  ready:                 { bg: 'rgba(20,75,35,0.65)',    color: '#5dce7a',  label: 'Ready' },
  completed:             { bg: 'rgba(50,60,55,0.5)',     color: '#8fa8a0',  label: 'Completed' },
  cancelled:             { bg: 'rgba(58,28,28,0.6)',     color: '#c08080',  label: 'Cancelled' },
}

function badge(status: string) {
  return STATUS_BADGE[status.toLowerCase()] ?? STATUS_BADGE.under_review
}

export default function AdminOrderDetail() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loaded, setLoaded] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [itemEdits, setItemEdits] = useState<Record<string, ItemEdit>>({})
  const [adminMessage, setAdminMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<'approval' | 'in_progress' | 'update' | 'ready' | 'completed' | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      const { data: client } = await supabase
        .from('clients')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (client?.role !== 'admin') { router.replace('/'); return }

      const [{ data: orderData, error: orderErr }, { data: svcsData, error: svcsErr }] = await Promise.all([
        supabase
          .from('orders')
          .select(`
            id, client_id, status, total_price, delivery_method, scheduled_at, notes, admin_message,
            clients(full_name, email),
            order_items(
              id, garment_id, service_id, final_price, special_instructions,
              reviewed_service_id, reviewed_price, treatment_notes,
              garments(brand, color),
              services!order_items_service_id_fkey(category, sub_category, price),
              order_item_photos(url)
            )
          `)
          .eq('id', id)
          .maybeSingle(),
        supabase.from('services').select('id, category, sub_category, price').order('category').order('sub_category'),
      ])

      if (orderErr) { console.error('Order query error:', orderErr); router.replace('/admin/orders'); return }
      if (svcsErr) console.error('Services query error:', svcsErr)

      const raw = orderData as unknown as Order | null
      if (!raw) { console.error('Order not found for id:', id); router.replace('/admin/orders'); return }

      // Fetch reviewed_service details separately for items that have one
      const reviewedIds = (raw.order_items ?? [])
        .map(i => i.reviewed_service_id)
        .filter(Boolean) as string[]

      const reviewedServicesMap: Record<string, { category: string; sub_category: string; price: number }> = {}
      if (reviewedIds.length > 0) {
        const { data: revSvcs } = await supabase
          .from('services')
          .select('id, category, sub_category, price')
          .in('id', reviewedIds)
        ;(revSvcs ?? []).forEach((s: Service) => { reviewedServicesMap[s.id] = s })
      }

      const enriched: Order = {
        ...raw,
        order_items: (raw.order_items ?? []).map(item => ({
          ...item,
          services: Array.isArray(item.services) ? (item.services[0] ?? null) : (item.services ?? null),
          garments: Array.isArray(item.garments) ? (item.garments[0] ?? null) : (item.garments ?? null),
          order_item_photos: Array.isArray(item.order_item_photos) ? item.order_item_photos : [],
          reviewed_service: item.reviewed_service_id ? (reviewedServicesMap[item.reviewed_service_id] ?? null) : null,
        })),
      }

      setOrder(enriched)
      setAdminMessage(raw.admin_message ?? '')
      setServices((svcsData as unknown as Service[]) ?? [])

      // Pre-populate edits from existing reviewed values
      const initialEdits: Record<string, ItemEdit> = {}
      for (const item of enriched.order_items) {
        initialEdits[item.id] = {
          reviewedServiceId: item.reviewed_service_id ?? '',
          reviewedPrice: item.reviewed_price != null ? String(item.reviewed_price) : '',
          treatmentNotes: item.treatment_notes ?? '',
        }
      }
      setItemEdits(initialEdits)
      setLoaded(true)
    })
  }, [id, router])

  function setEdit(itemId: string, field: keyof ItemEdit, value: string) {
    setItemEdits(prev => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }))
  }

  // When admin picks a new service, auto-fill the price from that service
  function handleServiceChange(itemId: string, serviceId: string) {
    const svc = services.find(s => s.id === serviceId)
    setItemEdits(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        reviewedServiceId: serviceId,
        reviewedPrice: svc ? String(svc.price) : prev[itemId]?.reviewedPrice ?? '',
      },
    }))
  }

  async function saveItems() {
    if (!order) return
    for (const item of order.order_items) {
      const edit = itemEdits[item.id]
      if (!edit) continue
      const reviewedServiceId = edit.reviewedServiceId || null
      const reviewedPrice = edit.reviewedPrice !== '' ? parseFloat(edit.reviewedPrice) : null
      const treatmentNotes = edit.treatmentNotes.trim() || null
      await supabase
        .from('order_items')
        .update({ reviewed_service_id: reviewedServiceId, reviewed_price: reviewedPrice, treatment_notes: treatmentNotes })
        .eq('id', item.id)
    }
  }

  function computeTotal() {
    return (order?.order_items ?? []).reduce((sum, item) => {
      const edit = itemEdits[item.id]
      const price = edit?.reviewedPrice !== '' ? parseFloat(edit?.reviewedPrice ?? '') : item.final_price
      return sum + (isNaN(price) ? item.final_price : price)
    }, 0)
  }

  async function handleSaveOnly() {
    if (!order) return
    setSaving(true)
    setError(null)
    try {
      await saveItems()
      const { error: orderErr } = await supabase
        .from('orders')
        .update({
          admin_message: adminMessage.trim() || null,
          total_price: computeTotal(),
        })
        .eq('id', order.id)
      if (orderErr) throw orderErr
      router.replace('/admin/orders')
    } catch {
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  async function handleSaveAndAdvance(newStatus: 'awaiting_confirmation' | 'in_progress' | 'ready' | 'completed') {
    if (!order) return
    setSaving(true)
    setError(null)
    try {
      await saveItems()

      // Update order status + admin_message + total_price
      const { error: orderErr } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          admin_message: adminMessage.trim() || null,
          total_price: computeTotal(),
        })
        .eq('id', order.id)
      if (orderErr) throw orderErr

      router.replace('/admin/orders')
    } catch {
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  if (!loaded) return null
  if (!order) return null

  const items = order.order_items
  const categories = Array.from(new Set(services.map(s => s.category))).sort()
  const deliveryLabel =
    order.delivery_method === 'drop_off' ? 'Drop Off'
    : order.delivery_method === 'fedex' ? 'FedEx'
    : 'Pick Up'
  const { bg, color, label: statusLabel } = badge(order.status)
  const isEditable = order.status === 'under_review' || order.status === 'awaiting_confirmation'

  return (
    <main className="min-h-screen px-6 py-10" style={{ backgroundColor: '#1c2b1e' }}>

      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <Link
          href="/admin/orders"
          className="text-lg leading-none"
          style={{ color: '#c4b89a' }}
          aria-label="Back to orders"
        >
          ←
        </Link>
        <div>
          <p className="text-[10px] tracking-[0.35em] uppercase mb-0.5" style={{ color: 'rgba(196,184,154,0.5)' }}>
            Orders
          </p>
          <h1 className="text-xl font-light tracking-wide" style={{ color: '#f5f0e8' }}>
            {order.clients?.full_name ?? '—'}
          </h1>
        </div>
      </div>

      {/* Client + delivery info */}
      <div
        className="flex flex-col gap-1 pl-3 mb-8"
        style={{ borderLeft: '1px solid rgba(196,184,154,0.35)' }}
      >
        <p className="text-xs font-light" style={{ color: 'rgba(245,240,232,0.4)' }}>
          {order.clients?.email ?? ''}
        </p>
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
          style={{ backgroundColor: bg, color }}
        >
          {statusLabel}
        </span>

      </div>

      {/* Section label */}
      <p className="text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: 'rgba(196,184,154,0.6)' }}>
        Items
      </p>

      {/* Items */}
      <ul className="flex flex-col mb-1 max-w-2xl">
        {items.map((item, idx) => {
          const edit = itemEdits[item.id] ?? { reviewedServiceId: '', reviewedPrice: '', treatmentNotes: '' }
          const selectedCat = edit.reviewedServiceId
            ? (services.find(s => s.id === edit.reviewedServiceId)?.category ?? '')
            : ''
          const subOptions = selectedCat ? services.filter(s => s.category === selectedCat) : []
          const hasChange = !!edit.reviewedServiceId || edit.reviewedPrice !== ''

          return (
            <li
              key={item.id}
              className="flex flex-col py-5"
              style={{
                borderTop: idx === 0 ? '1px solid rgba(196,184,154,0.15)' : undefined,
                borderBottom: '1px solid rgba(196,184,154,0.15)',
              }}
            >
              {/* Original values row */}
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1 flex-1 min-w-0 pr-6">
                  <p className="text-sm font-light" style={{ color: hasChange ? 'rgba(245,240,232,0.35)' : '#f5f0e8', textDecoration: hasChange ? 'line-through' : 'none' }}>
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
                <p
                  className="text-sm font-light shrink-0"
                  style={{ color: hasChange ? 'rgba(196,184,154,0.35)' : '#c4b89a', textDecoration: hasChange ? 'line-through' : 'none' }}
                >
                  {item.final_price > 0
                    ? `$${item.final_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                    : 'TBD'}
                </p>
              </div>

              {/* Reviewed values (shown if set) */}
              {hasChange && (
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm font-light" style={{ color: '#f5f0e8' }}>
                    {edit.reviewedServiceId
                      ? (services.find(s => s.id === edit.reviewedServiceId)?.sub_category ?? '—')
                      : item.services?.sub_category ?? '—'}
                  </p>
                  {edit.reviewedPrice !== '' && (
                    <p className="text-sm font-light" style={{ color: '#c4b89a' }}>
                      ${parseFloat(edit.reviewedPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              )}

              {/* Treatment notes — editable when in_progress, read-only otherwise */}
              {order.status?.toLowerCase() === 'in_progress' && (
                <div className="mt-4">
                  <p className="text-[9px] tracking-[0.2em] uppercase mb-2" style={{ color: 'rgba(196,184,154,0.5)' }}>
                    Treatment Notes
                  </p>
                  <textarea
                    rows={2}
                    placeholder="Describe exactly what was done — e.g. Full dry clean, stain removal on left sleeve…"
                    value={edit.treatmentNotes}
                    onChange={e => setEdit(item.id, 'treatmentNotes', e.target.value)}
                    className="w-full text-[11px] font-light px-3 py-2 resize-none leading-relaxed"
                    style={{
                      backgroundColor: 'rgba(245,240,232,0.04)',
                      border: '1px solid rgba(196,184,154,0.2)',
                      color: '#f5f0e8',
                      borderRadius: 0,
                      outline: 'none',
                    }}
                  />
                </div>
              )}
              {order.status !== 'in_progress' && item.treatment_notes && (
                <div className="mt-3 pl-3" style={{ borderLeft: '1px solid rgba(196,184,154,0.2)' }}>
                  <p className="text-[9px] tracking-[0.2em] uppercase mb-1" style={{ color: 'rgba(196,184,154,0.5)' }}>
                    Treatment Notes
                  </p>
                  <p className="text-[11px] font-light leading-relaxed" style={{ color: 'rgba(245,240,232,0.6)' }}>
                    {item.treatment_notes}
                  </p>
                </div>
              )}

              {/* Admin adjustment controls */}
              {isEditable && (
                <div className="flex flex-col gap-2 mt-4">
                  <p className="text-[9px] tracking-[0.2em] uppercase" style={{ color: 'rgba(196,184,154,0.5)' }}>
                    Adjust Service
                  </p>
                  <div className="flex gap-2">
                    {/* Category picker */}
                    <select
                      value={selectedCat}
                      onChange={e => {
                        const cat = e.target.value
                        if (!cat) {
                          setEdit(item.id, 'reviewedServiceId', '')
                          setEdit(item.id, 'reviewedPrice', '')
                        } else {
                          // Pick first sub-category of this category
                          const first = services.find(s => s.category === cat)
                          if (first) handleServiceChange(item.id, first.id)
                        }
                      }}
                      className="flex-1 text-[11px] font-light px-2 py-1.5 appearance-none"
                      style={{
                        backgroundColor: 'rgba(245,240,232,0.05)',
                        border: '1px solid rgba(196,184,154,0.2)',
                        color: selectedCat ? '#f5f0e8' : 'rgba(245,240,232,0.35)',
                        borderRadius: 0,
                      }}
                    >
                      <option value="">Category</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>

                    {/* Sub-category picker */}
                    <select
                      value={edit.reviewedServiceId}
                      onChange={e => handleServiceChange(item.id, e.target.value)}
                      disabled={!selectedCat}
                      className="flex-1 text-[11px] font-light px-2 py-1.5 appearance-none"
                      style={{
                        backgroundColor: 'rgba(245,240,232,0.05)',
                        border: '1px solid rgba(196,184,154,0.2)',
                        color: edit.reviewedServiceId ? '#f5f0e8' : 'rgba(245,240,232,0.35)',
                        borderRadius: 0,
                        opacity: selectedCat ? 1 : 0.4,
                      }}
                    >
                      <option value="">Sub-category</option>
                      {subOptions.map(s => (
                        <option key={s.id} value={s.id}>{s.sub_category}</option>
                      ))}
                    </select>
                  </div>

                  {/* Price override */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-light" style={{ color: 'rgba(196,184,154,0.5)' }}>$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={item.final_price > 0 ? item.final_price.toFixed(2) : 'Price'}
                      value={edit.reviewedPrice}
                      onChange={e => setEdit(item.id, 'reviewedPrice', e.target.value)}
                      className="w-28 text-[11px] font-light px-2 py-1.5"
                      style={{
                        backgroundColor: 'rgba(245,240,232,0.05)',
                        border: '1px solid rgba(196,184,154,0.2)',
                        color: '#f5f0e8',
                        borderRadius: 0,
                        outline: 'none',
                      }}
                    />
                    {hasChange && (
                      <button
                        onClick={() => setItemEdits(prev => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], reviewedServiceId: '', reviewedPrice: '' },
                        }))}
                        className="text-[9px] tracking-[0.15em] uppercase"
                        style={{ color: 'rgba(196,184,154,0.4)' }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {/* Total */}
      <div className="flex items-center justify-between mt-5 mb-8 px-1 max-w-2xl">
        <p className="text-[10px] tracking-[0.3em] uppercase font-medium" style={{ color: '#c4b89a' }}>
          {isEditable ? 'Revised Total' : 'Total'}
        </p>
        <p className="text-base font-light" style={{ color: '#c4b89a' }}>
          {(() => {
            const total = items.reduce((sum, item) => {
              const edit = itemEdits[item.id]
              const price = edit?.reviewedPrice !== '' ? parseFloat(edit?.reviewedPrice ?? '') : item.final_price
              return sum + (isNaN(price) ? item.final_price : price)
            }, 0)
            return `$${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
          })()}
        </p>
      </div>

      {/* Admin message */}
      {isEditable && (
        <div className="max-w-2xl mb-8">
          <p className="text-[9px] tracking-[0.2em] uppercase mb-2" style={{ color: 'rgba(196,184,154,0.5)' }}>
            Message to Client
          </p>
          <textarea
            rows={4}
            placeholder="Add a note for the client — e.g. explain a price adjustment or request additional info…"
            value={adminMessage}
            onChange={e => setAdminMessage(e.target.value)}
            className="w-full text-[12px] font-light px-3 py-2.5 resize-none leading-relaxed"
            style={{
              backgroundColor: 'rgba(245,240,232,0.04)',
              border: '1px solid rgba(196,184,154,0.2)',
              color: '#f5f0e8',
              borderRadius: 0,
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* Read-only message display */}
      {!isEditable && order.admin_message && (
        <div
          className="max-w-2xl mb-8 pl-3"
          style={{ borderLeft: '1px solid rgba(196,184,154,0.25)' }}
        >
          <p className="text-[9px] tracking-[0.2em] uppercase mb-1.5" style={{ color: 'rgba(196,184,154,0.5)' }}>
            Message to Client
          </p>
          <p className="text-[12px] font-light leading-relaxed" style={{ color: 'rgba(245,240,232,0.6)' }}>
            {order.admin_message}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs font-light mb-4 max-w-2xl" style={{ color: '#e8a090' }}>
          {error}
        </p>
      )}

      {/* Save treatment notes button — only shown when in_progress */}
      {order.status?.toLowerCase() === 'in_progress' && (
        <div className="max-w-2xl mb-6">
          <button
            onClick={async () => {
              setSaving(true)
              setError(null)
              try {
                await saveItems()
              } catch {
                setError('Something went wrong. Please try again.')
              } finally {
                setSaving(false)
              }
            }}
            disabled={saving}
            className="w-full py-3 text-[10px] tracking-[0.3em] uppercase font-medium disabled:opacity-40"
            style={{ border: '1px solid #c4b89a', color: '#c4b89a', backgroundColor: 'transparent' }}
          >
            {saving ? 'Saving…' : 'Save Treatment Notes'}
          </button>
        </div>
      )}

      {/* Mark as Ready — shown when in_progress */}
      {order.status?.toLowerCase() === 'in_progress' && confirmAction === null && (
        <div className="max-w-2xl mb-3">
          <button
            onClick={() => setConfirmAction('ready')}
            className="w-full py-3 text-[10px] tracking-[0.3em] uppercase font-medium"
            style={{ backgroundColor: 'rgba(28,58,30,0.8)', color: '#7aab80', border: '1px solid rgba(122,171,128,0.3)' }}
          >
            Mark as Ready
          </button>
        </div>
      )}
      {confirmAction === 'ready' && (
        <div className="max-w-2xl mb-6 flex flex-col gap-3">
          <p className="text-[11px] font-light" style={{ color: 'rgba(245,240,232,0.5)' }}>
            This will save treatment notes and mark the order as Ready to Pick Up. The client will be notified. Continue?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => handleSaveAndAdvance('ready')}
              disabled={saving}
              className="flex-1 py-3 text-[10px] tracking-[0.3em] uppercase font-medium disabled:opacity-40"
              style={{ backgroundColor: 'rgba(28,58,30,0.8)', color: '#7aab80' }}
            >
              {saving ? 'Saving…' : 'Yes, Mark Ready'}
            </button>
            <button
              onClick={() => setConfirmAction(null)}
              disabled={saving}
              className="flex-1 py-3 text-[10px] tracking-[0.3em] uppercase font-light disabled:opacity-40"
              style={{ border: '1px solid rgba(196,184,154,0.25)', color: 'rgba(196,184,154,0.6)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Mark as Completed — shown when ready */}
      {order.status?.toLowerCase() === 'ready' && confirmAction === null && (
        <div className="max-w-2xl mb-3">
          <button
            onClick={() => setConfirmAction('completed')}
            className="w-full py-3 text-[10px] tracking-[0.3em] uppercase font-medium"
            style={{ backgroundColor: 'rgba(28,58,30,0.8)', color: '#7aab80', border: '1px solid rgba(122,171,128,0.3)' }}
          >
            Mark as Completed
          </button>
        </div>
      )}
      {confirmAction === 'completed' && (
        <div className="max-w-2xl mb-6 flex flex-col gap-3">
          <p className="text-[11px] font-light" style={{ color: 'rgba(245,240,232,0.5)' }}>
            This will mark the order as Completed. This cannot be undone. Continue?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => handleSaveAndAdvance('completed')}
              disabled={saving}
              className="flex-1 py-3 text-[10px] tracking-[0.3em] uppercase font-medium disabled:opacity-40"
              style={{ backgroundColor: 'rgba(28,58,30,0.8)', color: '#7aab80' }}
            >
              {saving ? 'Saving…' : 'Yes, Complete'}
            </button>
            <button
              onClick={() => setConfirmAction(null)}
              disabled={saving}
              className="flex-1 py-3 text-[10px] tracking-[0.3em] uppercase font-light disabled:opacity-40"
              style={{ border: '1px solid rgba(196,184,154,0.25)', color: 'rgba(196,184,154,0.6)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {isEditable && (
        <div className="max-w-2xl flex flex-col gap-3">

          {/* awaiting_confirmation — Update Changes (saves without changing status) */}
          {order.status === 'awaiting_confirmation' && confirmAction === null && (
            <button
              onClick={() => setConfirmAction('update')}
              className="w-full py-3 text-[10px] tracking-[0.3em] uppercase font-medium"
              style={{ border: '1px solid #c4b89a', color: '#c4b89a', backgroundColor: 'transparent' }}
            >
              Update Changes
            </button>
          )}

          {/* under_review — Send for Approval + Move to In Progress */}
          {order.status === 'under_review' && confirmAction === null && (
            <>
              <button
                onClick={() => setConfirmAction('approval')}
                className="w-full py-3 text-[10px] tracking-[0.3em] uppercase font-medium"
                style={{ border: '1px solid #c4b89a', color: '#c4b89a', backgroundColor: 'transparent' }}
              >
                Send for Approval
              </button>
              <button
                onClick={() => setConfirmAction('in_progress')}
                className="w-full py-3 text-[10px] tracking-[0.3em] uppercase font-medium"
                style={{ border: '1px solid rgba(46,74,50,0.8)', color: '#a8c5a0', backgroundColor: 'transparent' }}
              >
                Move to In Progress
              </button>
            </>
          )}

          {/* Confirm: update changes (stays awaiting_confirmation) */}
          {confirmAction === 'update' && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-light" style={{ color: 'rgba(245,240,232,0.5)' }}>
                This will update the order details sent to the client. The status will remain Awaiting Confirmation. Continue?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveOnly}
                  disabled={saving}
                  className="flex-1 py-3 text-[10px] tracking-[0.3em] uppercase font-medium disabled:opacity-40"
                  style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
                >
                  {saving ? 'Saving…' : 'Yes, Update'}
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  disabled={saving}
                  className="flex-1 py-3 text-[10px] tracking-[0.3em] uppercase font-light disabled:opacity-40"
                  style={{ border: '1px solid rgba(196,184,154,0.25)', color: 'rgba(196,184,154,0.6)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Confirm: send for approval */}
          {confirmAction === 'approval' && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-light" style={{ color: 'rgba(245,240,232,0.5)' }}>
                This will save your changes and send the order to the client for approval. Continue?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleSaveAndAdvance('awaiting_confirmation')}
                  disabled={saving}
                  className="flex-1 py-3 text-[10px] tracking-[0.3em] uppercase font-medium disabled:opacity-40"
                  style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
                >
                  {saving ? 'Saving…' : 'Yes, Send'}
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  disabled={saving}
                  className="flex-1 py-3 text-[10px] tracking-[0.3em] uppercase font-light disabled:opacity-40"
                  style={{ border: '1px solid rgba(196,184,154,0.25)', color: 'rgba(196,184,154,0.6)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Confirm: move to in progress / confirm changes */}
          {confirmAction === 'in_progress' && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-light" style={{ color: 'rgba(245,240,232,0.5)' }}>
                {order.status === 'awaiting_confirmation'
                  ? 'This will save your changes and move the order to In Progress. Continue?'
                  : 'This will move the order to In Progress. Continue?'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleSaveAndAdvance('in_progress')}
                  disabled={saving}
                  className="flex-1 py-3 text-[10px] tracking-[0.3em] uppercase font-medium disabled:opacity-40"
                  style={{ backgroundColor: 'rgba(46,74,50,0.8)', color: '#a8c5a0' }}
                >
                  {saving ? 'Saving…' : order.status === 'awaiting_confirmation' ? 'Yes, Confirm' : 'Yes, Move'}
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  disabled={saving}
                  className="flex-1 py-3 text-[10px] tracking-[0.3em] uppercase font-light disabled:opacity-40"
                  style={{ border: '1px solid rgba(196,184,154,0.25)', color: 'rgba(196,184,154,0.6)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

        </div>
      )}


    </main>
  )
}
