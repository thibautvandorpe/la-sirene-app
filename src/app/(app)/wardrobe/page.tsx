'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import AppHeader from '@/components/AppHeader'

type Service = {
  id: string
  category: string
  sub_category: string
}

type CategoryCard = {
  category: string
  count: number
  firstPhotoUrl: string | null
}

export default function WardrobePage() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [clientId, setClientId] = useState<string | null>(null)
  const [categoryCards, setCategoryCards] = useState<CategoryCard[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [services, setServices] = useState<Service[]>([])

  // Add form
  const [showAddForm, setShowAddForm] = useState(false)
  const [addCategory, setAddCategory] = useState('')
  const [addSubCategory, setAddSubCategory] = useState('')
  const [addBrand, setAddBrand] = useState('')
  const [addColor, setAddColor] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addPhotos, setAddPhotos] = useState<File[]>([])
  const [addPreviews, setAddPreviews] = useState<string[]>([])
  const [addSaving, setAddSaving] = useState(false)
  const addFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setLoggedIn(false); setLoaded(true); return }
      setLoggedIn(true)
      setClientId(session.user.id)
      const [, { data: svcData }] = await Promise.all([
        loadCategories(session.user.id),
        supabase.from('services').select('id, category, sub_category').order('category').order('sub_category'),
      ])
      setServices((svcData as Service[]) ?? [])
      setLoaded(true)
    })
  }, [])

  async function loadCategories(cid: string) {
    const { data } = await supabase
      .from('garments')
      .select('id, services(category), garment_photos(url)')
      .eq('client_id', cid)
      .order('created_at', { ascending: false })

    const map = new Map<string, { count: number; firstPhotoUrl: string | null }>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const g of (data ?? []) as any[]) {
      const cat = (Array.isArray(g.services) ? g.services[0]?.category : g.services?.category) ?? 'Other'
      const photo = Array.isArray(g.garment_photos) ? (g.garment_photos[0]?.url ?? null) : null
      const ex = map.get(cat)
      map.set(cat, { count: (ex?.count ?? 0) + 1, firstPhotoUrl: ex?.firstPhotoUrl ?? photo })
    }

    const cards = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, { count, firstPhotoUrl }]) => ({ category, count, firstPhotoUrl }))

    setCategoryCards(cards)
    setTotalItems((data ?? []).length)
  }

  function resetAddForm() {
    setAddCategory(''); setAddSubCategory(''); setAddBrand(''); setAddColor('')
    setAddNotes(''); setAddPhotos([]); setAddPreviews([])
    if (addFileInputRef.current) addFileInputRef.current.value = ''
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setAddPhotos(files)
    setAddPreviews(files.map(f => URL.createObjectURL(f)))
  }

  async function handleAddGarment() {
    if (!addCategory || !addSubCategory || !clientId) return
    const service = services.find(s => s.category === addCategory && s.sub_category === addSubCategory)
    if (!service) return
    setAddSaving(true)
    try {
      const { data, error } = await supabase
        .from('garments')
        .insert({ client_id: clientId, brand: addBrand.trim() || null, color: addColor.trim() || null, notes: addNotes.trim() || null, service_id: service.id })
        .select('id').single()
      if (error) throw error

      const snapshot = { photos: addPhotos, garmentId: data.id, cid: clientId }
      resetAddForm(); setShowAddForm(false); setAddSaving(false)
      await loadCategories(clientId)

      if (snapshot.photos.length > 0) {
        Promise.all(snapshot.photos.map(async file => {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
          const path = `${snapshot.cid}/${snapshot.garmentId}/${Date.now()}-${safeName}`
          const { error: uploadError } = await supabase.storage.from('garment-photos').upload(path, file)
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('garment-photos').getPublicUrl(path)
            await supabase.from('garment_photos').insert({ garment_id: snapshot.garmentId, url: publicUrl, label: null })
          }
        })).catch(() => {})
      }
    } catch { setAddSaving(false) }
  }

  if (!loaded) return null

  if (!loggedIn) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#1c2b1e' }}>
        <AppHeader />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-light tracking-wide" style={{ color: '#f5f0e8' }}>Please sign in to access your wardrobe</p>
          <Link href="/login" className="mt-5 px-6 py-2 text-[10px] tracking-widest uppercase" style={{ color: '#c4b89a', border: '1px solid rgba(196,184,154,0.3)' }}>Sign In</Link>
        </div>
      </div>
    )
  }

  const addCategoryOptions = Array.from(new Set(services.map(s => s.category))).sort()
  const addSubCategoryOptions = services.filter(s => s.category === addCategory)

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#1c2b1e' }}>
      <AppHeader />
      <main className="flex-1 px-6 pt-4 pb-24">

        {/* Header row */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[10px] tracking-[0.35em] uppercase mb-1" style={{ color: '#c4b89a' }}>My Wardrobe</p>
            {totalItems > 0 && (
              <p className="text-xs font-light" style={{ color: 'rgba(245,240,232,0.4)' }}>
                {totalItems} {totalItems === 1 ? 'item' : 'items'}
              </p>
            )}
          </div>
          {!showAddForm && (
            <button
              onClick={() => { resetAddForm(); setShowAddForm(true) }}
              className="w-8 h-8 flex items-center justify-center text-lg leading-none"
              style={{ color: '#c4b89a', border: '1px solid rgba(196,184,154,0.35)', borderRadius: '50%' }}
            >
              +
            </button>
          )}
        </div>

        {/* ── Add item form ── */}
        {showAddForm && (
          <div className="flex flex-col gap-6 mb-8 p-5" style={{ border: '1px solid rgba(196,184,154,0.2)', backgroundColor: 'rgba(245,240,232,0.02)' }}>
            <div>
              <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>Category</label>
              <div className="grid grid-cols-2 gap-2">
                {addCategoryOptions.map(cat => (
                  <button key={cat} type="button" onClick={() => { setAddCategory(cat); setAddSubCategory('') }}
                    className="py-3 px-2 rounded-xl text-xs text-center"
                    style={{ backgroundColor: addCategory === cat ? 'rgba(196,184,154,0.18)' : 'rgba(255,255,255,0.04)', border: addCategory === cat ? '1px solid #c4b89a' : '1px solid rgba(196,184,154,0.15)', color: addCategory === cat ? '#c4b89a' : 'rgba(245,240,232,0.75)' }}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {addCategory && (
              <div>
                <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>{addCategory}</label>
                <div className="grid grid-cols-2 gap-2">
                  {addSubCategoryOptions.map(svc => (
                    <button key={svc.sub_category} type="button" onClick={() => setAddSubCategory(svc.sub_category)}
                      className="py-3 px-2 rounded-xl text-xs text-center"
                      style={{ backgroundColor: addSubCategory === svc.sub_category ? 'rgba(196,184,154,0.18)' : 'rgba(255,255,255,0.03)', border: addSubCategory === svc.sub_category ? '1px solid #c4b89a' : '1px solid rgba(196,184,154,0.1)', color: addSubCategory === svc.sub_category ? '#c4b89a' : 'rgba(245,240,232,0.7)' }}>
                      {svc.sub_category}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>Brand <span style={{ color: 'rgba(196,184,154,0.4)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
              <input type="text" value={addBrand} onChange={e => setAddBrand(e.target.value)} placeholder="e.g. Louis Vuitton" className="w-full bg-transparent outline-none text-sm font-light pb-3 placeholder:text-[rgba(245,240,232,0.25)]" style={{ color: '#f5f0e8', borderBottom: '1px solid rgba(196,184,154,0.4)' }} />
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>Color <span style={{ color: 'rgba(196,184,154,0.4)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
              <input type="text" value={addColor} onChange={e => setAddColor(e.target.value)} placeholder="e.g. Black" className="w-full bg-transparent outline-none text-sm font-light pb-3 placeholder:text-[rgba(245,240,232,0.25)]" style={{ color: '#f5f0e8', borderBottom: '1px solid rgba(196,184,154,0.4)' }} />
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>Care Notes <span style={{ color: 'rgba(196,184,154,0.4)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
              <textarea value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="e.g. Dry clean only, handle with care…" rows={2} className="w-full bg-transparent outline-none text-sm font-light resize-none pb-2 placeholder:text-[rgba(245,240,232,0.25)]" style={{ color: '#f5f0e8', borderBottom: '1px solid rgba(196,184,154,0.4)' }} />
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>Photos <span style={{ color: 'rgba(196,184,154,0.4)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
              <input ref={addFileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoChange} className="text-xs font-light w-full" style={{ color: 'rgba(245,240,232,0.5)' }} />
              {addPreviews.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {addPreviews.map((src, i) => <img key={i} src={src} alt="" className="w-16 h-16 object-cover" style={{ border: '1px solid rgba(196,184,154,0.2)' }} />)}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={handleAddGarment} disabled={!addCategory || !addSubCategory || addSaving} className="flex-1 py-3 text-[10px] tracking-[0.35em] uppercase font-medium disabled:opacity-40" style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}>
                {addSaving ? 'Saving…' : 'Add to Wardrobe'}
              </button>
              <button onClick={() => { setShowAddForm(false); resetAddForm() }} disabled={addSaving} className="px-5 py-3 text-[10px] tracking-[0.3em] uppercase font-light disabled:opacity-40" style={{ border: '1px solid rgba(196,184,154,0.3)', color: 'rgba(196,184,154,0.7)' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {categoryCards.length === 0 && !showAddForm && (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <p className="text-sm font-light mb-2" style={{ color: 'rgba(245,240,232,0.5)' }}>Your wardrobe is empty</p>
            <p className="text-xs font-light mb-8" style={{ color: 'rgba(245,240,232,0.3)' }}>Add items manually or book an appointment to get started</p>
            <Link href="/book" className="px-6 py-3 text-[10px] tracking-[0.35em] uppercase font-medium" style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}>Book an Appointment</Link>
          </div>
        )}

        {/* Category cards grid */}
        {categoryCards.length > 0 && !showAddForm && (
          <div className="grid grid-cols-2 gap-3">
            {categoryCards.map(({ category, count, firstPhotoUrl }) => (
              <Link
                key={category}
                href={`/wardrobe/${encodeURIComponent(category)}`}
                className="relative flex flex-col justify-end overflow-hidden"
                style={{ aspectRatio: '3/4', backgroundColor: 'rgba(245,240,232,0.04)', border: '1px solid rgba(196,184,154,0.12)' }}
              >
                {firstPhotoUrl ? (
                  <img src={firstPhotoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.55 }} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span style={{ color: 'rgba(196,184,154,0.18)', fontSize: 36 }}>✦</span>
                  </div>
                )}
                <div className="relative z-10 p-3" style={{ background: 'linear-gradient(to top, rgba(28,43,30,0.95) 0%, rgba(28,43,30,0) 100%)' }}>
                  <p className="text-sm font-light tracking-wide" style={{ color: '#f5f0e8' }}>{category}</p>
                  <p className="text-[10px] font-light mt-0.5" style={{ color: '#c4b89a' }}>{count} {count === 1 ? 'item' : 'items'}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}
