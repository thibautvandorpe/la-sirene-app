'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const TIME_SLOTS = [
  '9:00 AM – 11:00 AM',
  '11:00 AM – 1:00 PM',
  '1:00 PM – 3:00 PM',
  '3:00 PM – 5:00 PM',
  '5:00 PM – 7:00 PM',
]

function getTomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

// "9:00 AM – 11:00 AM" + "2026-04-28" → "2026-04-28T09:00:00.000Z"
function slotToISO(date: string, slot: string): string {
  const start = slot.split('–')[0].trim()
  const [timePart, period] = start.split(' ')
  let [hours, minutes] = timePart.split(':').map(Number)
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return `${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`
}

// "2026-04-28T09:00:00.000Z" → "9:00 AM – 11:00 AM"
function isoToSlot(iso: string): string {
  const hour = new Date(iso).getUTCHours()
  return TIME_SLOTS.find(slot => {
    const start = slot.split('–')[0].trim()
    const [timePart, period] = start.split(' ')
    let h = parseInt(timePart.split(':')[0], 10)
    if (period === 'PM' && h !== 12) h += 12
    if (period === 'AM' && h === 12) h = 0
    return h === hour
  }) ?? ''
}

type Service = {
  id: string
  category: string
  sub_category: string
  price: number
}

type OrderItem = {
  id: string
  appointmentItemId: string
  garmentId: string
  category: string
  subCategory: string
  brand: string
  color: string
  instructions: string
  price: number
  photoPreviews: string[]
}

function BookPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loaded, setLoaded] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [saving, setSaving] = useState(false)

  // Step 1
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [step1Error, setStep1Error] = useState<string | null>(null)

  // Persisted across steps
  const [clientId, setClientId] = useState<string | null>(null)
  const [appointmentId, setAppointmentId] = useState<string | null>(null)

  // Step 2 — services
  const [services, setServices] = useState<Service[]>([])
  // Step 2 — items list
  const [items, setItems] = useState<OrderItem[]>([])
  // Step 2 — inline form visibility
  const [showForm, setShowForm] = useState(false)
  // Step 2 — form fields
  const [formCategory, setFormCategory] = useState('')
  const [formSubCategory, setFormSubCategory] = useState('')
  const [formBrand, setFormBrand] = useState('')
  const [formColor, setFormColor] = useState('')
  const [formInstructions, setFormInstructions] = useState('')
  const [formPreviews, setFormPreviews] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const urlApptId = searchParams.get('appointmentId')
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      setClientId(session.user.id)

      if (urlApptId) {
        const { data: draft } = await supabase
          .from('appointments')
          .select('id, scheduled_at, appointment_items(id, garment_id, estimated_price, special_instructions, garments(brand, color), services(category, sub_category))')
          .eq('id', urlApptId)
          .maybeSingle()

        if (draft) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const d = draft as any
          setAppointmentId(d.id)
          setDate((d.scheduled_at as string).split('T')[0])
          setTime(isoToSlot(d.scheduled_at as string))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setItems(((d.appointment_items ?? []) as any[]).map((ai: any) => {
            const g   = ai.garments ?? {}
            const svc = ai.services ?? {}
            return {
              id: crypto.randomUUID(),
              appointmentItemId: ai.id as string,
              garmentId: ai.garment_id as string,
              category:     (svc.category     ?? '') as string,
              subCategory:  (svc.sub_category  ?? '') as string,
              brand:        (g.brand  ?? '') as string,
              color:        (g.color  ?? '') as string,
              instructions: (ai.special_instructions ?? '') as string,
              price:        (ai.estimated_price ?? 0) as number,
              photoPreviews: [],
            }
          }))
          setStep(2)
        }
      }

      setLoaded(true)
    })
  }, [router, searchParams])

  useEffect(() => {
    if (step !== 2) return
    supabase
      .from('services')
      .select('id, category, sub_category, price')
      .then(({ data }) => setServices((data as Service[]) ?? []))
  }, [step])

  if (!loaded) return null

  const categories = Array.from(new Set(services.map(s => s.category))).sort()
  const subCategoryOptions = services.filter(s => s.category === formCategory)
  const selectedService = subCategoryOptions.find(s => s.sub_category === formSubCategory)

  function resetForm() {
    setFormCategory('')
    setFormSubCategory('')
    setFormBrand('')
    setFormColor('')
    setFormInstructions('')
    setFormPreviews([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setFormPreviews(files.map(f => URL.createObjectURL(f)))
  }

  async function handleContinueToStep2(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !time) {
      setStep1Error('Please fill in both fields before continuing.')
      return
    }
    setStep1Error(null)
    setSaving(true)
    try {
      const scheduledAt = slotToISO(date, time)
      if (appointmentId) {
        const { error } = await supabase
          .from('appointments')
          .update({ scheduled_at: scheduledAt, notes: time })
          .eq('id', appointmentId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('appointments')
          .insert({ client_id: clientId, scheduled_at: scheduledAt, status: 'draft', notes: time })
          .select('id')
          .single()
        if (error) throw error
        setAppointmentId(data.id)
      }
      setStep(2)
    } catch {
      setStep1Error('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddItem() {
    if (!formCategory || !formSubCategory || !appointmentId) return
    const service = services.find(
      s => s.category === formCategory && s.sub_category === formSubCategory,
    )
    if (!service) return

    setSaving(true)
    try {
      const { data: garment, error: garmentErr } = await supabase
        .from('garments')
        .insert({
          client_id: clientId,
          brand: formBrand || null,
          color: formColor || null,
          notes: formInstructions || null,
          service_id: service.id,
        })
        .select('id')
        .single()
      if (garmentErr) throw garmentErr

      const { data: ai, error: aiErr } = await supabase
        .from('appointment_items')
        .insert({
          appointment_id: appointmentId,
          garment_id: garment.id,
          service_id: service.id,
          special_instructions: formInstructions || null,
          estimated_price: service.price,
        })
        .select('id')
        .single()
      if (aiErr) throw aiErr

      setItems(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          appointmentItemId: ai.id,
          garmentId: garment.id,
          category: formCategory,
          subCategory: formSubCategory,
          brand: formBrand,
          color: formColor,
          instructions: formInstructions,
          price: service.price,
          photoPreviews: formPreviews,
        },
      ])
      setShowForm(false)
      resetForm()
    } catch {
      // no-op — keep form open so user can retry
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveItem(item: OrderItem) {
    setItems(prev => prev.filter(i => i.id !== item.id))
    await supabase.from('appointment_items').delete().eq('id', item.appointmentItemId)
  }

  async function handleEditItem(item: OrderItem) {
    setItems(prev => prev.filter(i => i.id !== item.id))
    await supabase.from('appointment_items').delete().eq('id', item.appointmentItemId)
    setFormCategory(item.category)
    setFormSubCategory(item.subCategory)
    setFormBrand(item.brand)
    setFormColor(item.color)
    setFormInstructions(item.instructions)
    setFormPreviews(item.photoPreviews)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setShowForm(true)
  }

  // ── STEP 2 ────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <main className="min-h-screen flex flex-col px-6 py-8" style={{ backgroundColor: '#1c2b1e' }}>

        {/* Top row */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => { setShowForm(false); setStep(1) }}
            className="text-lg leading-none"
            style={{ color: '#c4b89a' }}
            aria-label="Back to step 1"
          >
            ←
          </button>
          <h1 className="text-xl font-light tracking-wide" style={{ color: '#f5f0e8' }}>
            New Appointment
          </h1>
        </div>

        {/* Step indicator */}
        <p className="text-[10px] tracking-[0.3em] uppercase mb-5" style={{ color: '#c4b89a' }}>
          Step 2 of 3 — Your Items
        </p>

        {/* Step 1 recap */}
        <div
          className="flex flex-col gap-1 pl-3 mb-8"
          style={{ borderLeft: '1px solid rgba(196, 184, 154, 0.35)' }}
        >
          <p className="text-xs font-light" style={{ color: 'rgba(245, 240, 232, 0.55)' }}>
            {new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            })}
          </p>
          <p className="text-xs font-light" style={{ color: 'rgba(245, 240, 232, 0.4)' }}>
            {time}
          </p>
        </div>

        {/* Items list */}
        {items.length > 0 && (
          <ul className="flex flex-col gap-2 mb-4">
            {items.map(item => (
              <li
                key={item.id}
                className="flex items-center justify-between py-3 px-4"
                style={{
                  backgroundColor: 'rgba(245, 240, 232, 0.04)',
                  borderBottom: '1px solid rgba(196, 184, 154, 0.12)',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-light" style={{ color: '#f5f0e8' }}>
                    {item.subCategory}{item.brand ? ` · ${item.brand}` : ''}
                  </p>
                  <p className="text-xs" style={{ color: '#c4b89a' }}>
                    {item.price > 0
                      ? `$${item.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : 'Price TBD'}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <button
                    onClick={() => handleEditItem(item)}
                    className="text-xs font-light"
                    style={{ color: 'rgba(196, 184, 154, 0.7)' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemoveItem(item)}
                    className="text-xs font-light"
                    style={{ color: 'rgba(196, 184, 154, 0.4)' }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Estimated total */}
        {items.length > 0 && (
          <div className="flex items-center justify-between mb-6 px-1">
            <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: '#c4b89a' }}>
              Estimated Total
            </p>
            <p className="text-sm font-light" style={{ color: '#c4b89a' }}>
              ${items.reduce((sum, i) => sum + i.price, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}

        {/* Add Item button */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-3 text-[10px] tracking-[0.35em] uppercase font-medium mb-4"
            style={{ border: '1px solid #c4b89a', color: '#c4b89a', backgroundColor: 'transparent' }}
          >
            + Add Item
          </button>
        )}

        {/* Inline item form */}
        {showForm && (
          <div
            className="flex flex-col gap-7 mb-8 p-5"
            style={{
              border: '1px solid rgba(196, 184, 154, 0.2)',
              backgroundColor: 'rgba(245, 240, 232, 0.02)',
            }}
          >
            {/* Category */}
            <div>
              <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>
                Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => { setFormCategory(cat); setFormSubCategory('') }}
                    className="py-3 px-2 rounded-xl text-xs text-center transition-colors"
                    style={{
                      backgroundColor: formCategory === cat ? 'rgba(196,184,154,0.18)' : 'rgba(255,255,255,0.04)',
                      border: formCategory === cat ? '1px solid #c4b89a' : '1px solid rgba(196,184,154,0.15)',
                      color: formCategory === cat ? '#c4b89a' : 'rgba(245,240,232,0.75)',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-category */}
            {formCategory && (
              <div>
                <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>
                  {formCategory}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {subCategoryOptions.map(svc => (
                    <button
                      key={svc.sub_category}
                      type="button"
                      onClick={() => setFormSubCategory(svc.sub_category)}
                      className="py-3 px-2 rounded-xl text-xs text-center transition-colors"
                      style={{
                        backgroundColor: formSubCategory === svc.sub_category ? 'rgba(196,184,154,0.18)' : 'rgba(255,255,255,0.03)',
                        border: formSubCategory === svc.sub_category ? '1px solid #c4b89a' : '1px solid rgba(196,184,154,0.1)',
                        color: formSubCategory === svc.sub_category ? '#c4b89a' : 'rgba(245,240,232,0.7)',
                      }}
                    >
                      {svc.sub_category}
                    </button>
                  ))}
                </div>
                {selectedService && (
                  <p className="mt-3 text-xs font-light" style={{ color: '#c4b89a' }}>
                    ${selectedService.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
            )}

            {/* Brand */}
            <div>
              <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>
                Brand{' '}
                <span style={{ color: 'rgba(196, 184, 154, 0.4)', textTransform: 'none', letterSpacing: 0 }}>
                  (optional)
                </span>
              </label>
              <input
                type="text"
                value={formBrand}
                onChange={e => setFormBrand(e.target.value)}
                placeholder="e.g. Louis Vuitton"
                className="w-full bg-transparent outline-none text-sm font-light pb-3 placeholder:text-[rgba(245,240,232,0.25)]"
                style={{
                  color: '#f5f0e8',
                  borderBottom: '1px solid rgba(196, 184, 154, 0.4)',
                }}
              />
            </div>

            {/* Color */}
            <div>
              <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>
                Color{' '}
                <span style={{ color: 'rgba(196, 184, 154, 0.4)', textTransform: 'none', letterSpacing: 0 }}>
                  (optional)
                </span>
              </label>
              <input
                type="text"
                value={formColor}
                onChange={e => setFormColor(e.target.value)}
                placeholder="e.g. Black"
                className="w-full bg-transparent outline-none text-sm font-light pb-3 placeholder:text-[rgba(245,240,232,0.25)]"
                style={{
                  color: '#f5f0e8',
                  borderBottom: '1px solid rgba(196, 184, 154, 0.4)',
                }}
              />
            </div>

            {/* Special instructions */}
            <div>
              <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>
                Special Instructions{' '}
                <span style={{ color: 'rgba(196, 184, 154, 0.4)', textTransform: 'none', letterSpacing: 0 }}>
                  (optional)
                </span>
              </label>
              <textarea
                value={formInstructions}
                onChange={e => setFormInstructions(e.target.value)}
                placeholder="Any special care instructions…"
                rows={3}
                className="w-full bg-transparent outline-none text-sm font-light resize-none pb-2 placeholder:text-[rgba(245,240,232,0.25)]"
                style={{
                  color: '#f5f0e8',
                  borderBottom: '1px solid rgba(196, 184, 154, 0.4)',
                }}
              />
            </div>

            {/* Photos */}
            <div>
              <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>
                Photos{' '}
                <span style={{ color: 'rgba(196, 184, 154, 0.4)', textTransform: 'none', letterSpacing: 0 }}>
                  (optional)
                </span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoChange}
                className="text-xs font-light w-full"
                style={{ color: 'rgba(245, 240, 232, 0.5)' }}
              />
              {formPreviews.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {formPreviews.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      className="w-14 h-14 object-cover rounded-sm"
                      style={{ border: '1px solid rgba(196, 184, 154, 0.2)' }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Form actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleAddItem}
                disabled={!formCategory || !formSubCategory || saving}
                className="flex-1 py-3 text-[10px] tracking-[0.35em] uppercase font-medium disabled:opacity-40"
                style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
              >
                {saving ? 'Saving…' : 'Add to Order'}
              </button>
              <button
                onClick={() => { setShowForm(false); resetForm() }}
                disabled={saving}
                className="px-5 py-3 text-[10px] tracking-[0.3em] uppercase font-light disabled:opacity-40"
                style={{ border: '1px solid rgba(196, 184, 154, 0.3)', color: 'rgba(196, 184, 154, 0.7)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Continue to Review */}
        <button
          disabled={items.length === 0}
          className="w-full py-4 text-[10px] tracking-[0.35em] uppercase font-medium disabled:opacity-40"
          style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
        >
          Continue to Review
        </button>
      </main>
    )
  }

  // ── STEP 1 ────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col px-6 py-8" style={{ backgroundColor: '#1c2b1e' }}>

      {/* Top row */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/orders"
          className="text-lg leading-none"
          style={{ color: '#c4b89a' }}
          aria-label="Back to orders"
        >
          ←
        </Link>
        <h1 className="text-xl font-light tracking-wide" style={{ color: '#f5f0e8' }}>
          New Appointment
        </h1>
      </div>

      {/* Step indicator */}
      <p className="text-[10px] tracking-[0.3em] uppercase mb-10" style={{ color: '#c4b89a' }}>
        Step 1 of 3 — Date &amp; Time
      </p>

      <form onSubmit={handleContinueToStep2} className="flex flex-col">
        <div className="flex flex-col gap-10">

          {/* Preferred date */}
          <div>
            <label
              htmlFor="preferred-date"
              className="block text-[10px] tracking-[0.3em] uppercase mb-3"
              style={{ color: '#c4b89a' }}
            >
              Preferred Date
            </label>
            <input
              id="preferred-date"
              type="date"
              value={date}
              min={getTomorrow()}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-transparent outline-none text-sm font-light pb-3 transition-colors"
              style={{
                color: date ? '#f5f0e8' : 'rgba(245, 240, 232, 0.35)',
                borderBottom: '1px solid rgba(196, 184, 154, 0.4)',
                colorScheme: 'dark',
              }}
            />
          </div>

          {/* Preferred time */}
          <div>
            <label
              className="block text-[10px] tracking-[0.3em] uppercase mb-3"
              style={{ color: '#c4b89a' }}
            >
              Preferred Time
            </label>
            <div className="flex flex-col gap-2">
              {TIME_SLOTS.map(slot => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTime(slot)}
                  className="flex items-center justify-between px-4 py-3 rounded-xl transition-colors"
                  style={{
                    backgroundColor: time === slot ? 'rgba(196,184,154,0.15)' : 'rgba(255,255,255,0.04)',
                    border: time === slot ? '1px solid #c4b89a' : '1px solid rgba(196,184,154,0.15)',
                    color: time === slot ? '#c4b89a' : 'rgba(245,240,232,0.75)',
                  }}
                >
                  <span className="text-sm font-light">{slot}</span>
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: time === slot ? '#c4b89a' : 'transparent',
                      border: time === slot ? '1px solid #c4b89a' : '1px solid rgba(196,184,154,0.3)',
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Error */}
        {step1Error && (
          <p className="text-sm font-light text-center mt-6" style={{ color: '#e8a090' }}>
            {step1Error}
          </p>
        )}

        {/* Continue */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 text-[10px] tracking-[0.35em] uppercase font-medium mt-10 disabled:opacity-40"
          style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </main>
  )
}

export default function BookPage() {
  return (
    <Suspense>
      <BookPageInner />
    </Suspense>
  )
}
