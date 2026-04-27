'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type AppointmentItem = {
  id: string
  estimated_price: number
  special_instructions: string | null
  services: { sub_category: string } | null
  garments: { brand: string | null; color: string | null } | null
}

type AppointmentDetail = {
  scheduled_at: string
  notes: string | null   // stores the time slot label
  status: string
  appointment_items: AppointmentItem[]
}

function AppointmentDetailInner() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loaded, setLoaded] = useState(false)
  const [detail, setDetail] = useState<AppointmentDetail | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      const { data } = await supabase
        .from('appointments')
        .select(`
          scheduled_at,
          notes,
          status,
          appointment_items (
            id,
            estimated_price,
            special_instructions,
            services ( sub_category ),
            garments ( brand, color )
          )
        `)
        .eq('id', id)
        .eq('client_id', session.user.id)
        .maybeSingle()

      if (!data) { router.replace('/orders'); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = data as any
      const detail: AppointmentDetail = {
        scheduled_at: raw.scheduled_at,
        notes: raw.notes,
        status: raw.status,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        appointment_items: (raw.appointment_items ?? []).map((ai: any) => ({
          id: ai.id,
          estimated_price: ai.estimated_price ?? 0,
          special_instructions: ai.special_instructions ?? null,
          services: Array.isArray(ai.services) ? (ai.services[0] ?? null) : (ai.services ?? null),
          garments: Array.isArray(ai.garments) ? (ai.garments[0] ?? null) : (ai.garments ?? null),
        })),
      }

      setDetail(detail)
      setLoaded(true)
    })
  }, [id, router])

  if (!loaded) return null

  const items = detail!.appointment_items
  const estimatedTotal = items.reduce((sum, i) => sum + i.estimated_price, 0)
  const date = detail!.scheduled_at.split('T')[0]
  const time = detail!.notes ?? ''

  return (
    <main className="min-h-screen flex flex-col px-6 py-8" style={{ backgroundColor: '#1c2b1e' }}>

      {/* Top row */}
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
          Appointment Details
        </h1>
      </div>

      {/* Appointment recap */}
      <div
        className="flex flex-col gap-1 pl-3 mb-8"
        style={{ borderLeft: '1px solid rgba(196, 184, 154, 0.35)' }}
      >
        <p className="text-xs font-light" style={{ color: 'rgba(245, 240, 232, 0.55)' }}>
          {new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
          })}
        </p>
        {time && (
          <p className="text-xs font-light" style={{ color: 'rgba(245, 240, 232, 0.4)' }}>
            {time}
          </p>
        )}
        <span
          className="self-start mt-1 text-[9px] tracking-[0.25em] uppercase px-2 py-0.5 rounded-sm"
          style={{ backgroundColor: 'rgba(196,184,154,0.2)', color: '#c4b89a' }}
        >
          {detail!.status}
        </span>
      </div>

      {/* Section label */}
      <p className="text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: 'rgba(196, 184, 154, 0.6)' }}>
        Items
      </p>

      {/* Item list */}
      <ul className="flex flex-col mb-1">
        {items.map((item, idx) => (
          <li
            key={item.id}
            className="flex items-start justify-between py-4"
            style={{
              borderTop: idx === 0 ? '1px solid rgba(196, 184, 154, 0.15)' : undefined,
              borderBottom: '1px solid rgba(196, 184, 154, 0.15)',
            }}
          >
            {/* Left: details */}
            <div className="flex flex-col gap-1 flex-1 min-w-0 pr-4">
              <p className="text-sm font-light" style={{ color: '#f5f0e8' }}>
                {item.services?.sub_category ?? '—'}
              </p>
              {(item.garments?.brand || item.garments?.color) && (
                <p className="text-[11px] font-light" style={{ color: 'rgba(245, 240, 232, 0.45)' }}>
                  {[item.garments.brand, item.garments.color].filter(Boolean).join(' · ')}
                </p>
              )}
              {item.special_instructions && (
                <p className="text-[11px] font-light italic mt-0.5" style={{ color: 'rgba(245, 240, 232, 0.35)' }}>
                  "{item.special_instructions}"
                </p>
              )}
            </div>
            {/* Right: price */}
            <p className="text-sm font-light shrink-0" style={{ color: '#c4b89a' }}>
              {item.estimated_price > 0
                ? `$${item.estimated_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                : 'TBD'}
            </p>
          </li>
        ))}
      </ul>

      {/* Estimated total */}
      <div className="flex items-center justify-between mt-5 mb-8 px-1">
        <p className="text-[10px] tracking-[0.3em] uppercase font-medium" style={{ color: '#c4b89a' }}>
          Estimated Total
        </p>
        <p className="text-base font-light" style={{ color: '#c4b89a' }}>
          ${estimatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Disclaimer */}
      <p
        className="text-[11px] font-light leading-relaxed"
        style={{ color: 'rgba(245, 240, 232, 0.35)' }}
      >
        Prices shown are estimates based on your selections. The final invoice will be confirmed by our team after inspection of your garments.
      </p>

    </main>
  )
}

export default function AppointmentDetailPage() {
  return (
    <Suspense>
      <AppointmentDetailInner />
    </Suspense>
  )
}
