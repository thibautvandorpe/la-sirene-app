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

const BOUTIQUE_ADDRESS = '401 N Beverly Drive, Beverly Hills, CA 90210'
const BOUTIQUE_HOURS = 'Tuesday – Saturday · 11:00 AM – 7:00 PM'

type DeliveryMethod = 'pick_up' | 'drop_off' | 'fedex'

const DELIVERY_OPTIONS: { value: DeliveryMethod; label: string; description: string }[] = [
  {
    value: 'pick_up',
    label: 'Pick Up',
    description: 'Schedule a pick-up window. Our team comes to you.',
  },
  {
    value: 'drop_off',
    label: 'Drop Off',
    description: 'Bring your items to our Beverly Hills boutique.',
  },
  {
    value: 'fedex',
    label: 'FedEx',
    description: 'Ship your garments to us at your convenience.',
  },
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
  const timeParts = timePart.split(':').map(Number)
  let hours = timeParts[0]
  const minutes = timeParts[1]
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

function getStepLabel(step: 1 | 2 | 3 | 4, method: DeliveryMethod | null): string {
  if (step === 1) return 'Step 1 — Delivery Method'
  if (step === 2) return 'Step 2 of 4 — Date & Time'
  if (step === 3) return method === 'pick_up' ? 'Step 3 of 4 — Your Items' : 'Step 2 of 3 — Your Items'
  return method === 'pick_up' ? 'Step 4 of 4 — Review & Quote' : 'Step 3 of 3 — Review & Quote'
}

// Compact recap strip shown at the top of Steps 3 and 4
function DeliveryRecap({
  deliveryMethod,
  date,
  time,
}: {
  deliveryMethod: DeliveryMethod | null
  date: string
  time: string
}) {
  if (deliveryMethod === 'pick_up' && date) {
    return (
      <div
        className="flex flex-col gap-1 pl-3 mb-8"
        style={{ borderLeft: '1px solid rgba(196, 184, 154, 0.35)' }}
      >
        <p className="text-xs font-light" style={{ color: 'rgba(196, 184, 154, 0.75)' }}>
          Pick Up
        </p>
        <p className="text-xs font-light" style={{ color: 'rgba(245, 240, 232, 0.55)' }}>
          {new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
          })}
        </p>
        <p className="text-xs font-light" style={{ color: 'rgba(245, 240, 232, 0.4)' }}>
          {time}
        </p>
      </div>
    )
  }
  if (deliveryMethod === 'drop_off') {
    return (
      <div
        className="flex flex-col gap-1 pl-3 mb-8"
        style={{ borderLeft: '1px solid rgba(196, 184, 154, 0.35)' }}
      >
        <p className="text-xs font-light" style={{ color: 'rgba(196, 184, 154, 0.75)' }}>
          Drop Off
        </p>
        <p className="text-xs font-light" style={{ color: 'rgba(245, 240, 232, 0.55)' }}>
          {BOUTIQUE_ADDRESS}
        </p>
        <p className="text-xs font-light" style={{ color: 'rgba(245, 240, 232, 0.4)' }}>
          {BOUTIQUE_HOURS}
        </p>
      </div>
    )
  }
  if (deliveryMethod === 'fedex') {
    return (
      <div
        className="flex flex-col gap-1 pl-3 mb-8"
        style={{ borderLeft: '1px solid rgba(196, 184, 154, 0.35)' }}
      >
        <p className="text-xs font-light" style={{ color: 'rgba(196, 184, 154, 0.75)' }}>
          Ship via FedEx
        </p>
        <p className="text-xs font-light" style={{ color: 'rgba(245, 240, 232, 0.55)' }}>
          {BOUTIQUE_ADDRESS}
        </p>
      </div>
    )
  }
  return null
}

type Service = {
  id: string
  category: string
  sub_category: string
  price: number
}

type WardrobeItem = {
  id: string
  brand: string | null
  color: string | null
  services: { category: string; sub_category: string } | null
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
  photoPreviews: string[]  // blob URLs for newly added photos (current session only)
  photoUrls: string[]      // persisted DB photo URLs
}

function BookPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loaded, setLoaded] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [saving, setSaving] = useState(false)

  // Step 1 — Delivery Method
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | null>(null)
  const [step1Error, setStep1Error] = useState<string | null>(null)

  // Step 2 (Pick Up only) — Date & Time
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [step2Error, setStep2Error] = useState<string | null>(null)

  // Persisted across steps
  const [clientId, setClientId] = useState<string | null>(null)
  const [appointmentId, setAppointmentId] = useState<string | null>(null)

  // Step 3 — services
  const [services, setServices] = useState<Service[]>([])
  // Step 3 — items list
  const [items, setItems] = useState<OrderItem[]>([])
  // Step 3 — inline form visibility
  const [showForm, setShowForm] = useState(false)
  const [formIsEdit, setFormIsEdit] = useState(false)
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null)
  const [editRemovedPhotoUrls, setEditRemovedPhotoUrls] = useState<string[]>([])
  // Step 3 — wardrobe selector
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([])
  const [selectedWardrobeId, setSelectedWardrobeId] = useState<string | null>(null)
  // Step 3 — form fields
  const [formCategory, setFormCategory] = useState('')
  const [formSubCategory, setFormSubCategory] = useState('')
  const [formBrand, setFormBrand] = useState('')
  const [formColor, setFormColor] = useState('')
  const [formInstructions, setFormInstructions] = useState('')
  const [formPhotos, setFormPhotos] = useState<File[]>([])
  const [formPreviews, setFormPreviews] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Restore a draft appointment from URL param
  useEffect(() => {
    const urlApptId = searchParams.get('appointmentId')
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      setClientId(session.user.id)

      if (urlApptId) {
        const { data: draft } = await supabase
          .from('appointments')
          .select('id, scheduled_at, delivery_method, appointment_items(id, garment_id, estimated_price, special_instructions, garments(brand, color), services(category, sub_category), appointment_item_photos(url))')
          .eq('id', urlApptId)
          .maybeSingle()

        if (draft) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const d = draft as any
          setAppointmentId(d.id)
          const dm = (d.delivery_method as DeliveryMethod | null) ?? 'pick_up'
          setDeliveryMethod(dm)
          if (d.scheduled_at) {
            setDate((d.scheduled_at as string).split('T')[0])
            setTime(isoToSlot(d.scheduled_at as string))
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setItems(((d.appointment_items ?? []) as any[]).map((ai: any) => {
            const g   = ai.garments ?? {}
            const svc = ai.services ?? {}
            const photos = Array.isArray(ai.appointment_item_photos)
              ? (ai.appointment_item_photos as { url: string }[]).map(p => p.url)
              : []
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
              photoUrls: photos,
            }
          }))
          setStep(3)
        }
      }

      setLoaded(true)
    })
  }, [router, searchParams])

  // Fetch services + wardrobe when reaching Step 3
  useEffect(() => {
    if (step !== 3 || !clientId) return
    Promise.all([
      supabase.from('services').select('id, category, sub_category, price'),
      supabase.from('garments').select('id, brand, color, services(category, sub_category)').eq('client_id', clientId).order('created_at', { ascending: false }),
    ]).then(([{ data: svcData }, { data: gData }]) => {
      setServices((svcData as Service[]) ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wardrobe = ((gData ?? []) as any[]).map((g: any) => ({
        id: g.id as string,
        brand: g.brand as string | null,
        color: g.color as string | null,
        services: Array.isArray(g.services) ? (g.services[0] ?? null) : (g.services ?? null),
      })) as WardrobeItem[]
      setWardrobeItems(wardrobe)
    })
  }, [step, clientId])

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
    setFormPhotos([])
    setFormPreviews([])
    setSelectedWardrobeId(null)
    setFormIsEdit(false)
    setEditingItem(null)
    setEditRemovedPhotoUrls([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleCancelForm() {
    if (formIsEdit && editingItem) {
      setItems(prev => [...prev, editingItem])
    }
    setShowForm(false)
    resetForm()
  }

  function handleSelectWardrobeItem(item: WardrobeItem) {
    if (selectedWardrobeId === item.id) {
      setSelectedWardrobeId(null)
      setFormCategory('')
      setFormSubCategory('')
      setFormBrand('')
      setFormColor('')
    } else {
      setSelectedWardrobeId(item.id)
      setFormCategory(item.services?.category ?? '')
      setFormSubCategory(item.services?.sub_category ?? '')
      setFormBrand(item.brand ?? '')
      setFormColor(item.color ?? '')
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setFormPhotos(files)
    setFormPreviews(files.map(f => URL.createObjectURL(f)))
  }

  // ── Step 1 → Step 2 (Pick Up) or Step 3 (Drop Off / FedEx) ───
  async function handleDeliveryMethodContinue() {
    if (!deliveryMethod) {
      setStep1Error('Please select a delivery method.')
      return
    }
    setStep1Error(null)

    if (deliveryMethod === 'pick_up') {
      // No Supabase call yet — appointment is created when date/time is confirmed
      setStep(2)
      return
    }

    // Drop Off / FedEx: create (or update) the appointment now with no scheduled_at
    setSaving(true)
    try {
      if (appointmentId) {
        const { error } = await supabase
          .from('appointments')
          .update({ delivery_method: deliveryMethod, scheduled_at: null })
          .eq('id', appointmentId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('appointments')
          .insert({ client_id: clientId, scheduled_at: null, status: 'draft', delivery_method: deliveryMethod })
          .select('id')
          .single()
        if (error) throw error
        setAppointmentId(data.id)
      }
      setStep(3)
    } catch {
      setStep1Error('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Step 2 → Step 3 (Pick Up only) ───────────────────────────
  async function handleContinueToItems(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !time) {
      setStep2Error('Please fill in both fields before continuing.')
      return
    }
    setStep2Error(null)
    setSaving(true)
    try {
      const scheduledAt = slotToISO(date, time)
      if (appointmentId) {
        const { error } = await supabase
          .from('appointments')
          .update({ scheduled_at: scheduledAt, notes: time, delivery_method: 'pick_up' })
          .eq('id', appointmentId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('appointments')
          .insert({ client_id: clientId, scheduled_at: scheduledAt, status: 'draft', notes: time, delivery_method: 'pick_up' })
          .select('id')
          .single()
        if (error) throw error
        setAppointmentId(data.id)
      }
      setStep(3)
    } catch {
      setStep2Error('Failed to save. Please try again.')
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
      // ── EDIT MODE ──────────────────────────────────────────────
      if (formIsEdit && editingItem) {
        const { error: aiErr } = await supabase
          .from('appointment_items')
          .update({
            service_id: service.id,
            special_instructions: formInstructions || null,
            estimated_price: service.price,
          })
          .eq('id', editingItem.appointmentItemId)
        if (aiErr) throw aiErr

        const { error: garmentErr } = await supabase
          .from('garments')
          .update({ brand: formBrand || null, color: formColor || null })
          .eq('id', editingItem.garmentId)
        if (garmentErr) throw garmentErr

        if (editRemovedPhotoUrls.length > 0) {
          await supabase.from('appointment_item_photos').delete().in('url', editRemovedPhotoUrls)
        }

        const snapshotRemoved = editRemovedPhotoUrls
        const remainingUrls = editingItem.photoUrls.filter(u => !snapshotRemoved.includes(u))
        const updatedItem: OrderItem = {
          ...editingItem,
          category: formCategory,
          subCategory: formSubCategory,
          brand: formBrand,
          color: formColor,
          instructions: formInstructions,
          price: service.price,
          photoUrls: remainingUrls,
          photoPreviews: formPreviews,
        }
        setItems(prev => [...prev, updatedItem])
        setShowForm(false)
        resetForm()
        setSaving(false)

        if (snapshotRemoved.length > 0) {
          Promise.all(
            snapshotRemoved.map(async url => {
              const parts = url.split('/appointment-photos/')
              if (parts.length < 2) return
              const path = parts[1]
              await supabase.storage.from('appointment-photos').remove([path])
            })
          ).catch(() => {})
        }

        if (formPhotos.length > 0) {
          const snapshot = { photos: formPhotos, clientId, appointmentItemId: editingItem.appointmentItemId }
          Promise.all(
            snapshot.photos.map(async file => {
              const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
              const path = `${snapshot.clientId}/${snapshot.appointmentItemId}/${Date.now()}-${safeName}`
              const { error: uploadError } = await supabase.storage
                .from('appointment-photos')
                .upload(path, file)
              if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage
                  .from('appointment-photos')
                  .getPublicUrl(path)
                await supabase.from('appointment_item_photos').insert({
                  appointment_item_id: snapshot.appointmentItemId,
                  url: publicUrl,
                  label: null,
                })
              }
            })
          ).catch(() => {})
        }
        return
      }

      // ── ADD MODE ──────────────────────────────────────────────
      let garmentId: string

      if (selectedWardrobeId) {
        garmentId = selectedWardrobeId
      } else {
        const { data: garment, error: garmentErr } = await supabase
          .from('garments')
          .insert({
            client_id: clientId,
            brand: formBrand || null,
            color: formColor || null,
            notes: null,
            service_id: service.id,
          })
          .select('id')
          .single()
        if (garmentErr) throw garmentErr
        garmentId = garment.id
      }

      const { data: ai, error: aiErr } = await supabase
        .from('appointment_items')
        .insert({
          appointment_id: appointmentId,
          garment_id: garmentId,
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
          garmentId: garmentId,
          category: formCategory,
          subCategory: formSubCategory,
          brand: formBrand,
          color: formColor,
          instructions: formInstructions,
          price: service.price,
          photoPreviews: formPreviews,
          photoUrls: [],
        },
      ])
      setShowForm(false)
      resetForm()
      setSaving(false)

      if (formPhotos.length > 0) {
        const snapshot = { photos: formPhotos, clientId, appointmentItemId: ai.id }
        Promise.all(
          snapshot.photos.map(async file => {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
            const path = `${snapshot.clientId}/${snapshot.appointmentItemId}/${Date.now()}-${safeName}`
            const { error: uploadError } = await supabase.storage
              .from('appointment-photos')
              .upload(path, file)
            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from('appointment-photos')
                .getPublicUrl(path)
              await supabase.from('appointment_item_photos').insert({
                appointment_item_id: snapshot.appointmentItemId,
                url: publicUrl,
                label: null,
              })
            }
          })
        ).catch(() => {})
      }
    } catch {
      setSaving(false)
    }
  }

  async function handleRemoveItem(item: OrderItem) {
    setItems(prev => prev.filter(i => i.id !== item.id))
    await supabase.from('appointment_items').delete().eq('id', item.appointmentItemId)
  }

  function handleEditItem(item: OrderItem) {
    setItems(prev => prev.filter(i => i.id !== item.id))
    setEditingItem(item)
    setFormCategory(item.category)
    setFormSubCategory(item.subCategory)
    setFormBrand(item.brand)
    setFormColor(item.color)
    setFormInstructions(item.instructions)
    setFormPreviews(item.photoPreviews)
    setSelectedWardrobeId(item.garmentId)
    setFormIsEdit(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setShowForm(true)
  }

  async function handleDeleteEditingItem() {
    if (!editingItem) return
    setShowForm(false)
    resetForm()
    await supabase.from('appointment_items').delete().eq('id', editingItem.appointmentItemId)
  }

  async function handleConfirmBooking() {
    if (!appointmentId) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'pending' })
        .eq('id', appointmentId)
      if (error) throw error
      router.replace('/orders')
    } catch {
      // keep user on step 4, they can retry
    } finally {
      setSaving(false)
    }
  }

  // ── STEP 4 — Review & Quote ───────────────────────────────────
  if (step === 4) {
    const estimatedTotal = items.reduce((sum, i) => sum + i.price, 0)
    return (
      <main className="min-h-screen flex flex-col px-6 py-8" style={{ backgroundColor: '#1c2b1e' }}>

        {/* Top row */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => setStep(3)}
            className="text-lg leading-none"
            style={{ color: '#c4b89a' }}
            aria-label="Back to items"
          >
            ←
          </button>
          <h1 className="text-xl font-light tracking-wide" style={{ color: '#f5f0e8' }}>
            New Appointment
          </h1>
        </div>

        {/* Step indicator */}
        <p className="text-[10px] tracking-[0.3em] uppercase mb-5" style={{ color: '#c4b89a' }}>
          {getStepLabel(4, deliveryMethod)}
        </p>

        {/* Delivery recap */}
        <DeliveryRecap deliveryMethod={deliveryMethod} date={date} time={time} />

        {/* Section label */}
        <p className="text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: 'rgba(196, 184, 154, 0.6)' }}>
          Your Items
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
              <div className="flex flex-col gap-1 flex-1 min-w-0 pr-4">
                <p className="text-sm font-light" style={{ color: '#f5f0e8' }}>
                  {item.subCategory}
                </p>
                <p className="text-[11px] font-light" style={{ color: 'rgba(245, 240, 232, 0.45)' }}>
                  {[item.brand, item.color].filter(Boolean).join(' · ') || item.category}
                </p>
                {item.instructions && (
                  <p className="text-[11px] font-light italic mt-0.5" style={{ color: 'rgba(245, 240, 232, 0.35)' }}>
                    {'"'}{item.instructions}{'"'}
                  </p>
                )}
              </div>
              <p className="text-sm font-light shrink-0" style={{ color: '#c4b89a' }}>
                {item.price > 0
                  ? `$${item.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
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
          className="text-[11px] font-light leading-relaxed mb-10 pb-8"
          style={{
            color: 'rgba(245, 240, 232, 0.35)',
            borderBottom: '1px solid rgba(196, 184, 154, 0.1)',
          }}
        >
          Prices shown are estimates based on your selections. The final invoice will be confirmed by our team after inspection of your garments. Additional services may be recommended.
        </p>

        {/* Confirm button */}
        <button
          onClick={handleConfirmBooking}
          disabled={saving}
          className="w-full py-4 text-[10px] tracking-[0.35em] uppercase font-medium disabled:opacity-40"
          style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
        >
          {saving ? 'Confirming…' : 'Confirm Booking Request'}
        </button>

        {/* Cancel link */}
        <button
          onClick={() => router.replace('/orders')}
          disabled={saving}
          className="w-full py-3 text-[10px] tracking-[0.3em] uppercase font-light mt-3 disabled:opacity-40"
          style={{ color: 'rgba(196, 184, 154, 0.45)' }}
        >
          Cancel
        </button>
      </main>
    )
  }

  // ── STEP 3 — Items ────────────────────────────────────────────
  if (step === 3) {
    return (
      <main className="min-h-screen flex flex-col px-6 py-8" style={{ backgroundColor: '#1c2b1e' }}>

        {/* Top row */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => { setShowForm(false); setStep(deliveryMethod === 'pick_up' ? 2 : 1) }}
            className="text-lg leading-none"
            style={{ color: '#c4b89a' }}
            aria-label="Back"
          >
            ←
          </button>
          <h1 className="text-xl font-light tracking-wide" style={{ color: '#f5f0e8' }}>
            New Appointment
          </h1>
        </div>

        {/* Step indicator */}
        <p className="text-[10px] tracking-[0.3em] uppercase mb-5" style={{ color: '#c4b89a' }}>
          {getStepLabel(3, deliveryMethod)}
        </p>

        {/* Delivery recap */}
        <DeliveryRecap deliveryMethod={deliveryMethod} date={date} time={time} />

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
            onClick={() => { resetForm(); setShowForm(true) }}
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
            {/* From your wardrobe */}
            {!formIsEdit && wardrobeItems.length > 0 && (
              <div>
                <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>
                  From your wardrobe
                </label>
                <div className="flex flex-col gap-2">
                  {wardrobeItems.map(item => {
                    const isSelected = selectedWardrobeId === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectWardrobeItem(item)}
                        className="flex items-center justify-between px-3 py-3 rounded-xl text-left transition-colors"
                        style={{
                          backgroundColor: isSelected ? 'rgba(196,184,154,0.18)' : 'rgba(255,255,255,0.03)',
                          border: isSelected ? '1px solid #c4b89a' : '1px solid rgba(196,184,154,0.12)',
                        }}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-light" style={{ color: isSelected ? '#c4b89a' : '#f5f0e8' }}>
                            {item.services?.sub_category ?? '—'}
                          </span>
                          {(item.brand || item.color) && (
                            <span className="text-[11px] font-light" style={{ color: 'rgba(245,240,232,0.45)' }}>
                              {[item.brand, item.color].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </div>
                        {isSelected && (
                          <span className="text-[10px] ml-3 shrink-0" style={{ color: '#c4b89a' }}>✓</span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-3 mt-4 mb-1">
                  <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(196,184,154,0.12)' }} />
                  <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(196,184,154,0.4)' }}>
                    or new item
                  </span>
                  <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(196,184,154,0.12)' }} />
                </div>
              </div>
            )}

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
                style={{ color: '#f5f0e8', borderBottom: '1px solid rgba(196, 184, 154, 0.4)' }}
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
                style={{ color: '#f5f0e8', borderBottom: '1px solid rgba(196, 184, 154, 0.4)' }}
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
                style={{ color: '#f5f0e8', borderBottom: '1px solid rgba(196, 184, 154, 0.4)' }}
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

              {formIsEdit && editingItem && editingItem.photoUrls.filter(u => !editRemovedPhotoUrls.includes(u)).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {editingItem.photoUrls
                    .filter(u => !editRemovedPhotoUrls.includes(u))
                    .map((url, i) => (
                      <div key={i} className="relative">
                        <img
                          src={url}
                          alt=""
                          className="w-14 h-14 object-cover rounded-sm"
                          style={{ border: '1px solid rgba(196, 184, 154, 0.2)' }}
                        />
                        <button
                          type="button"
                          onClick={() => setEditRemovedPhotoUrls(prev => [...prev, url])}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center text-[10px] font-medium rounded-full"
                          style={{ backgroundColor: 'rgba(220,80,60,0.85)', color: '#fff' }}
                          aria-label="Remove photo"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                </div>
              )}

              {formPreviews.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {formPreviews.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      className="w-14 h-14 object-cover rounded-sm opacity-70"
                      style={{ border: '1px solid rgba(196, 184, 154, 0.35)' }}
                    />
                  ))}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoChange}
                className="text-xs font-light w-full"
                style={{ color: 'rgba(245, 240, 232, 0.5)' }}
              />
            </div>

            {/* Form actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleAddItem}
                disabled={!formCategory || !formSubCategory || saving}
                className="flex-1 py-3 text-[10px] tracking-[0.35em] uppercase font-medium disabled:opacity-40"
                style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
              >
                {saving ? 'Saving…' : formIsEdit ? 'Confirm' : 'Add to Order'}
              </button>
              {formIsEdit ? (
                <>
                  <button
                    onClick={handleCancelForm}
                    disabled={saving}
                    className="px-4 py-3 text-[10px] tracking-[0.3em] uppercase font-light disabled:opacity-40"
                    style={{ border: '1px solid rgba(196, 184, 154, 0.3)', color: 'rgba(196, 184, 154, 0.7)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteEditingItem}
                    disabled={saving}
                    className="px-4 py-3 text-[10px] tracking-[0.3em] uppercase font-light disabled:opacity-40"
                    style={{ border: '1px solid rgba(220,80,60,0.4)', color: 'rgba(220,80,60,0.7)' }}
                  >
                    Delete
                  </button>
                </>
              ) : (
                <button
                  onClick={handleCancelForm}
                  disabled={saving}
                  className="px-5 py-3 text-[10px] tracking-[0.3em] uppercase font-light disabled:opacity-40"
                  style={{ border: '1px solid rgba(196, 184, 154, 0.3)', color: 'rgba(196, 184, 154, 0.7)' }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* Continue to Review */}
        <button
          onClick={() => setStep(4)}
          disabled={items.length === 0}
          className="w-full py-4 text-[10px] tracking-[0.35em] uppercase font-medium disabled:opacity-40"
          style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
        >
          Continue to Review
        </button>
      </main>
    )
  }

  // ── STEP 2 — Date & Time (Pick Up only) ──────────────────────
  if (step === 2) {
    return (
      <main className="min-h-screen flex flex-col px-6 py-8" style={{ backgroundColor: '#1c2b1e' }}>

        {/* Top row */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => setStep(1)}
            className="text-lg leading-none"
            style={{ color: '#c4b89a' }}
            aria-label="Back to delivery method"
          >
            ←
          </button>
          <h1 className="text-xl font-light tracking-wide" style={{ color: '#f5f0e8' }}>
            New Appointment
          </h1>
        </div>

        {/* Step indicator */}
        <p className="text-[10px] tracking-[0.3em] uppercase mb-10" style={{ color: '#c4b89a' }}>
          {getStepLabel(2, deliveryMethod)}
        </p>

        <form onSubmit={handleContinueToItems} className="flex flex-col">
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

          {step2Error && (
            <p className="text-sm font-light text-center mt-6" style={{ color: '#e8a090' }}>
              {step2Error}
            </p>
          )}

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

  // ── STEP 1 — Delivery Method ──────────────────────────────────
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
        {getStepLabel(1, deliveryMethod)}
      </p>

      {/* Delivery method cards */}
      <div className="flex flex-col gap-3 mb-8">
        {DELIVERY_OPTIONS.map(option => {
          const isSelected = deliveryMethod === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => { setDeliveryMethod(option.value); setStep1Error(null) }}
              className="flex flex-col gap-1 px-5 py-4 rounded-xl text-left transition-colors"
              style={{
                backgroundColor: isSelected ? 'rgba(196,184,154,0.12)' : 'rgba(255,255,255,0.03)',
                border: isSelected ? '1px solid #c4b89a' : '1px solid rgba(196,184,154,0.18)',
              }}
            >
              <span
                className="text-sm font-light tracking-wide"
                style={{ color: isSelected ? '#c4b89a' : '#f5f0e8' }}
              >
                {option.label}
              </span>
              <span
                className="text-[11px] font-light leading-relaxed"
                style={{ color: 'rgba(245,240,232,0.45)' }}
              >
                {option.description}
              </span>
            </button>
          )
        })}
      </div>

      {/* Contextual info for the selected method */}
      {deliveryMethod === 'drop_off' && (
        <div
          className="flex flex-col gap-2 px-5 py-4 mb-8"
          style={{
            backgroundColor: 'rgba(196,184,154,0.06)',
            border: '1px solid rgba(196,184,154,0.15)',
          }}
        >
          <p className="text-[10px] tracking-[0.25em] uppercase mb-1" style={{ color: 'rgba(196,184,154,0.7)' }}>
            Our Boutique
          </p>
          <p className="text-sm font-light" style={{ color: '#f5f0e8' }}>
            {BOUTIQUE_ADDRESS}
          </p>
          <p className="text-xs font-light" style={{ color: 'rgba(245,240,232,0.5)' }}>
            {BOUTIQUE_HOURS}
          </p>
        </div>
      )}

      {deliveryMethod === 'fedex' && (
        <div
          className="flex flex-col gap-2 px-5 py-4 mb-8"
          style={{
            backgroundColor: 'rgba(196,184,154,0.06)',
            border: '1px solid rgba(196,184,154,0.15)',
          }}
        >
          <p className="text-[10px] tracking-[0.25em] uppercase mb-1" style={{ color: 'rgba(196,184,154,0.7)' }}>
            Ship To
          </p>
          <p className="text-sm font-light" style={{ color: '#f5f0e8' }}>
            La Sirène
          </p>
          <p className="text-sm font-light" style={{ color: 'rgba(245,240,232,0.7)' }}>
            {BOUTIQUE_ADDRESS}
          </p>
          <p className="text-xs font-light mt-1" style={{ color: 'rgba(245,240,232,0.4)' }}>
            Please include your name and contact information inside the package.
          </p>
        </div>
      )}

      {step1Error && (
        <p className="text-sm font-light text-center mb-6" style={{ color: '#e8a090' }}>
          {step1Error}
        </p>
      )}

      {/* Continue */}
      <button
        onClick={handleDeliveryMethodContinue}
        disabled={!deliveryMethod || saving}
        className="w-full py-4 text-[10px] tracking-[0.35em] uppercase font-medium disabled:opacity-40"
        style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
      >
        {saving ? 'Saving…' : 'Continue'}
      </button>
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
