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

type Garment = {
  id: string
  brand: string | null
  color: string | null
  notes: string | null
  created_at: string | null
  services: { category: string; sub_category: string } | null
  garment_photos: { url: string }[]
}

type GroupedGarments = {
  category: string
  items: Garment[]
}

export default function WardrobePage() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [clientId, setClientId] = useState<string | null>(null)
  const [groups, setGroups] = useState<GroupedGarments[]>([])
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  // Services (for add form)
  const [services, setServices] = useState<Service[]>([])

  // Add form state
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

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editColor, setEditColor] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editRemovedUrls, setEditRemovedUrls] = useState<string[]>([])
  const [editNewPhotos, setEditNewPhotos] = useState<File[]>([])
  const [editNewPreviews, setEditNewPreviews] = useState<string[]>([])
  const editFileInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)

  // Delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setLoggedIn(false)
        setLoaded(true)
        return
      }
      setLoggedIn(true)
      setClientId(session.user.id)

      const [, { data: svcData }] = await Promise.all([
        loadGarments(session.user.id),
        supabase.from('services').select('id, category, sub_category').order('category').order('sub_category'),
      ])
      setServices((svcData as Service[]) ?? [])
      setLoaded(true)
    })
  }, [])

  async function loadGarments(cid: string) {
    const { data } = await supabase
      .from('garments')
      .select('id, brand, color, notes, created_at, services(category, sub_category), garment_photos(url)')
      .eq('client_id', cid)
      .order('created_at', { ascending: false })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const garments = ((data ?? []) as any[]).map((g: any) => ({
      id: g.id as string,
      brand: g.brand as string | null,
      color: g.color as string | null,
      notes: g.notes as string | null,
      created_at: g.created_at as string | null,
      services: Array.isArray(g.services) ? (g.services[0] ?? null) : (g.services ?? null),
      garment_photos: Array.isArray(g.garment_photos) ? g.garment_photos : [],
    })) as Garment[]

    const map = new Map<string, Garment[]>()
    for (const g of garments) {
      const cat = g.services?.category ?? 'Other'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(g)
    }

    const sorted = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, items]) => ({ category, items }))

    setGroups(sorted)
    if (sorted.length === 1) setExpandedCategory(sorted[0].category)
  }

  function resetAddForm() {
    setAddCategory('')
    setAddSubCategory('')
    setAddBrand('')
    setAddColor('')
    setAddNotes('')
    setAddPhotos([])
    setAddPreviews([])
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
      // 1. Insert garment
      const { data, error } = await supabase
        .from('garments')
        .insert({
          client_id: clientId,
          brand: addBrand.trim() || null,
          color: addColor.trim() || null,
          notes: addNotes.trim() || null,
          service_id: service.id,
        })
        .select('id, brand, color, notes, created_at')
        .single()
      if (error) throw error

      // 2. Update UI immediately using blob preview URLs
      const newGarment: Garment = {
        id: data.id,
        brand: data.brand,
        color: data.color,
        notes: data.notes,
        created_at: data.created_at,
        services: { category: addCategory, sub_category: addSubCategory },
        garment_photos: addPreviews.map(url => ({ url })),
      }

      setGroups(prev => {
        const existing = prev.find(g => g.category === addCategory)
        if (existing) {
          return prev.map(g =>
            g.category === addCategory
              ? { ...g, items: [newGarment, ...g.items] }
              : g
          )
        }
        return [...prev, { category: addCategory, items: [newGarment] }]
          .sort((a, b) => a.category.localeCompare(b.category))
      })

      setExpandedCategory(addCategory)
      setShowAddForm(false)

      // Capture snapshot before resetAddForm clears state
      const snapshot = { photos: addPhotos, garmentId: data.id, cid: clientId }
      resetAddForm()
      setAddSaving(false)

      // 3. Fire-and-forget photo uploads
      if (snapshot.photos.length > 0) {
        Promise.all(
          snapshot.photos.map(async file => {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
            const path = `${snapshot.cid}/${snapshot.garmentId}/${Date.now()}-${safeName}`
            const { error: uploadError } = await supabase.storage
              .from('garment-photos')
              .upload(path, file)
            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from('garment-photos')
                .getPublicUrl(path)
              await supabase.from('garment_photos').insert({
                garment_id: snapshot.garmentId,
                url: publicUrl,
                label: null,
              })
            }
          })
        ).catch(() => {})
      }
    } catch {
      // keep form open so user can retry
      setAddSaving(false)
    }
  }

  function handleStartEdit(garment: Garment) {
    setConfirmDeleteId(null)
    setDeleteError(null)
    setEditingId(garment.id)
    setEditColor(garment.color ?? '')
    setEditNotes(garment.notes ?? '')
    setEditRemovedUrls([])
    setEditNewPhotos([])
    setEditNewPreviews([])
    if (editFileInputRef.current) editFileInputRef.current.value = ''
  }

  function handleCancelEdit() {
    setEditingId(null)
    setEditColor('')
    setEditNotes('')
    setEditRemovedUrls([])
    setEditNewPhotos([])
    setEditNewPreviews([])
  }

  function handleEditPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setEditNewPhotos(files)
    setEditNewPreviews(files.map(f => URL.createObjectURL(f)))
  }

  async function handleSaveEdit(garmentId: string) {
    setSaving(true)
    try {
      // 1. Update garment fields
      const { error } = await supabase
        .from('garments')
        .update({
          color: editColor.trim() || null,
          notes: editNotes.trim() || null,
        })
        .eq('id', garmentId)
      if (error) throw error

      // 2. Delete removed photo rows (blocking)
      if (editRemovedUrls.length > 0) {
        await supabase.from('garment_photos').delete().in('url', editRemovedUrls)
      }

      // 3. Update local state immediately
      const snapshotRemoved = editRemovedUrls
      const snapshotNewPhotos = editNewPhotos
      const snapshotNewPreviews = editNewPreviews
      const snapshotClientId = clientId

      setGroups(prev => prev.map(group => ({
        ...group,
        items: group.items.map(item => {
          if (item.id !== garmentId) return item
          const remainingPhotos = item.garment_photos.filter(p => !snapshotRemoved.includes(p.url))
          const newBlobPhotos = snapshotNewPreviews.map(url => ({ url }))
          return {
            ...item,
            color: editColor.trim() || null,
            notes: editNotes.trim() || null,
            garment_photos: [...remainingPhotos, ...newBlobPhotos],
          }
        }),
      })))
      setEditingId(null)
      setEditRemovedUrls([])
      setEditNewPhotos([])
      setEditNewPreviews([])
      setSaving(false)

      // 4. Fire-and-forget: delete files from storage
      if (snapshotRemoved.length > 0) {
        Promise.all(
          snapshotRemoved.map(async url => {
            const parts = url.split('/garment-photos/')
            if (parts.length < 2) return // URL format unrecognized — skip silently
            const path = parts[1]
            await supabase.storage.from('garment-photos').remove([path])
          })
        ).catch(() => {})
      }

      // 5. Fire-and-forget: upload new photos
      if (snapshotNewPhotos.length > 0 && snapshotClientId) {
        Promise.all(
          snapshotNewPhotos.map(async file => {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
            const path = `${snapshotClientId}/${garmentId}/${Date.now()}-${safeName}`
            const { error: uploadError } = await supabase.storage
              .from('garment-photos')
              .upload(path, file)
            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from('garment-photos')
                .getPublicUrl(path)
              await supabase.from('garment_photos').insert({
                garment_id: garmentId,
                url: publicUrl,
                label: null,
              })
            }
          })
        ).catch(() => {})
      }
    } catch {
      // keep form open so user can retry
      setSaving(false)
    }
  }

  async function handleConfirmDelete(garmentId: string) {
    setDeleting(true)
    setDeleteError(null)
    try {
      const { error } = await supabase
        .from('garments')
        .delete()
        .eq('id', garmentId)
      if (error) throw error

      setGroups(prev =>
        prev
          .map(group => ({ ...group, items: group.items.filter(i => i.id !== garmentId) }))
          .filter(group => group.items.length > 0)
      )
      setConfirmDeleteId(null)
    } catch {
      setDeleteError('This item is linked to an existing appointment and cannot be removed.')
    } finally {
      setDeleting(false)
    }
  }

  if (!loaded) return null

  if (!loggedIn) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#1c2b1e' }}>
        <AppHeader />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-light tracking-wide" style={{ color: '#f5f0e8' }}>
            Please sign in to access your wardrobe
          </p>
          <Link
            href="/login"
            className="mt-5 px-6 py-2 text-[10px] tracking-widest uppercase"
            style={{ color: '#c4b89a', border: '1px solid rgba(196,184,154,0.3)' }}
          >
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0)
  const addSubCategoryOptions = services.filter(s => s.category === addCategory)
  const categories = Array.from(new Set(services.map(s => s.category))).sort()

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#1c2b1e' }}>
      <AppHeader />

      <main className="flex-1 px-6 pt-4 pb-24">

        {/* Page title row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] tracking-[0.35em] uppercase mb-1" style={{ color: '#c4b89a' }}>
              My Wardrobe
            </p>
            {totalItems > 0 && (
              <p className="text-xs font-light" style={{ color: 'rgba(245,240,232,0.4)' }}>
                {totalItems} {totalItems === 1 ? 'item' : 'items'}
              </p>
            )}
          </div>
          {!showAddForm && (
            <button
              onClick={() => { resetAddForm(); setShowAddForm(true) }}
              className="text-[10px] tracking-[0.25em] uppercase font-light"
              style={{ color: 'rgba(196,184,154,0.7)' }}
            >
              + Add item
            </button>
          )}
        </div>

        {/* ── Add item form ── */}
        {showAddForm && (
          <div
            className="flex flex-col gap-6 mb-8 p-5"
            style={{
              border: '1px solid rgba(196,184,154,0.2)',
              backgroundColor: 'rgba(245,240,232,0.02)',
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
                    onClick={() => { setAddCategory(cat); setAddSubCategory('') }}
                    className="py-3 px-2 rounded-xl text-xs text-center transition-colors"
                    style={{
                      backgroundColor: addCategory === cat ? 'rgba(196,184,154,0.18)' : 'rgba(255,255,255,0.04)',
                      border: addCategory === cat ? '1px solid #c4b89a' : '1px solid rgba(196,184,154,0.15)',
                      color: addCategory === cat ? '#c4b89a' : 'rgba(245,240,232,0.75)',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Subcategory */}
            {addCategory && (
              <div>
                <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>
                  {addCategory}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {addSubCategoryOptions.map(svc => (
                    <button
                      key={svc.sub_category}
                      type="button"
                      onClick={() => setAddSubCategory(svc.sub_category)}
                      className="py-3 px-2 rounded-xl text-xs text-center transition-colors"
                      style={{
                        backgroundColor: addSubCategory === svc.sub_category ? 'rgba(196,184,154,0.18)' : 'rgba(255,255,255,0.03)',
                        border: addSubCategory === svc.sub_category ? '1px solid #c4b89a' : '1px solid rgba(196,184,154,0.1)',
                        color: addSubCategory === svc.sub_category ? '#c4b89a' : 'rgba(245,240,232,0.7)',
                      }}
                    >
                      {svc.sub_category}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Brand */}
            <div>
              <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>
                Brand{' '}
                <span style={{ color: 'rgba(196,184,154,0.4)', textTransform: 'none', letterSpacing: 0 }}>
                  (optional)
                </span>
              </label>
              <input
                type="text"
                value={addBrand}
                onChange={e => setAddBrand(e.target.value)}
                placeholder="e.g. Louis Vuitton"
                className="w-full bg-transparent outline-none text-sm font-light pb-3 placeholder:text-[rgba(245,240,232,0.25)]"
                style={{ color: '#f5f0e8', borderBottom: '1px solid rgba(196,184,154,0.4)' }}
              />
            </div>

            {/* Color */}
            <div>
              <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>
                Color{' '}
                <span style={{ color: 'rgba(196,184,154,0.4)', textTransform: 'none', letterSpacing: 0 }}>
                  (optional)
                </span>
              </label>
              <input
                type="text"
                value={addColor}
                onChange={e => setAddColor(e.target.value)}
                placeholder="e.g. Black"
                className="w-full bg-transparent outline-none text-sm font-light pb-3 placeholder:text-[rgba(245,240,232,0.25)]"
                style={{ color: '#f5f0e8', borderBottom: '1px solid rgba(196,184,154,0.4)' }}
              />
            </div>

            {/* Care Notes */}
            <div>
              <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>
                Care Notes{' '}
                <span style={{ color: 'rgba(196,184,154,0.4)', textTransform: 'none', letterSpacing: 0 }}>
                  (optional)
                </span>
              </label>
              <textarea
                value={addNotes}
                onChange={e => setAddNotes(e.target.value)}
                placeholder="e.g. Dry clean only, handle with care…"
                rows={3}
                className="w-full bg-transparent outline-none text-sm font-light resize-none pb-2 placeholder:text-[rgba(245,240,232,0.25)]"
                style={{ color: '#f5f0e8', borderBottom: '1px solid rgba(196,184,154,0.4)' }}
              />
            </div>

            {/* Photos */}
            <div>
              <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>
                Photos{' '}
                <span style={{ color: 'rgba(196,184,154,0.4)', textTransform: 'none', letterSpacing: 0 }}>
                  (optional)
                </span>
              </label>
              <input
                ref={addFileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoChange}
                className="text-xs font-light w-full"
                style={{ color: 'rgba(245,240,232,0.5)' }}
              />
              {addPreviews.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {addPreviews.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      className="w-16 h-16 object-cover"
                      style={{ border: '1px solid rgba(196,184,154,0.2)' }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Save / Cancel */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleAddGarment}
                disabled={!addCategory || !addSubCategory || addSaving}
                className="flex-1 py-3 text-[10px] tracking-[0.35em] uppercase font-medium disabled:opacity-40"
                style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
              >
                {addSaving ? 'Saving…' : 'Add to Wardrobe'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); resetAddForm() }}
                disabled={addSaving}
                className="px-5 py-3 text-[10px] tracking-[0.3em] uppercase font-light disabled:opacity-40"
                style={{ border: '1px solid rgba(196,184,154,0.3)', color: 'rgba(196,184,154,0.7)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {groups.length === 0 && !showAddForm && (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <p className="text-sm font-light mb-2" style={{ color: 'rgba(245,240,232,0.5)' }}>
              Your wardrobe is empty
            </p>
            <p className="text-xs font-light mb-8" style={{ color: 'rgba(245,240,232,0.3)' }}>
              Add items manually or book an appointment to get started
            </p>
            <Link
              href="/book"
              className="px-6 py-3 text-[10px] tracking-[0.35em] uppercase font-medium"
              style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
            >
              Book an Appointment
            </Link>
          </div>
        )}

        {/* Category groups */}
        {groups.map(({ category, items }) => {
          const isOpen = expandedCategory === category
          return (
            <div key={category} className="mb-3">

              {/* Category header */}
              <button
                onClick={() => setExpandedCategory(isOpen ? null : category)}
                className="w-full flex items-center justify-between py-4"
                style={{ borderBottom: '1px solid rgba(196,184,154,0.15)' }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-light tracking-wide" style={{ color: '#f5f0e8' }}>
                    {category}
                  </span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'rgba(196,184,154,0.12)', color: '#c4b89a' }}
                  >
                    {items.length}
                  </span>
                </div>
                <span
                  className="text-xs"
                  style={{
                    color: 'rgba(196,184,154,0.5)',
                    display: 'inline-block',
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                  }}
                >
                  ›
                </span>
              </button>

              {/* Garment cards */}
              {isOpen && (
                <ul className="flex flex-col gap-2 pt-3 pb-2">
                  {items.map(garment => (
                    <li
                      key={garment.id}
                      style={{
                        backgroundColor: 'rgba(245,240,232,0.03)',
                        border: '1px solid rgba(196,184,154,0.1)',
                      }}
                    >
                      {/* ── Default view ── */}
                      {editingId !== garment.id && confirmDeleteId !== garment.id && (
                        <div className="flex items-center gap-4 px-4 py-4">

                          {/* Photo or placeholder */}
                          <div
                            className="w-12 h-12 shrink-0 flex items-center justify-center overflow-hidden"
                            style={{
                              backgroundColor: 'rgba(196,184,154,0.07)',
                              border: '1px solid rgba(196,184,154,0.15)',
                            }}
                          >
                            {garment.garment_photos[0] ? (
                              <img
                                src={garment.garment_photos[0].url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[10px]" style={{ color: 'rgba(196,184,154,0.4)' }}>✦</span>
                            )}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-light" style={{ color: '#f5f0e8' }}>
                              {garment.services?.sub_category ?? category}
                            </p>
                            {(garment.brand || garment.color) && (
                              <p className="text-[11px] font-light mt-0.5" style={{ color: 'rgba(245,240,232,0.45)' }}>
                                {[garment.brand, garment.color].filter(Boolean).join(' · ')}
                              </p>
                            )}
                            {garment.notes && (
                              <p className="text-[11px] font-light italic mt-0.5 leading-relaxed" style={{ color: 'rgba(245,240,232,0.3)' }}>
                                {'"'}{garment.notes}{'"'}
                              </p>
                            )}
                            {garment.created_at && (
                              <p className="text-[10px] font-light mt-1" style={{ color: 'rgba(245,240,232,0.45)' }}>
                                Added {new Date(garment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                            )}
                          </div>

                          {/* Actions — far right */}
                          <div className="flex items-center gap-3 shrink-0">
                            <button
                              onClick={() => handleStartEdit(garment)}
                              className="text-[10px] tracking-[0.2em] uppercase font-light"
                              style={{ color: 'rgba(196,184,154,0.7)' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => { setEditingId(null); setDeleteError(null); setConfirmDeleteId(garment.id) }}
                              className="text-[10px] tracking-[0.2em] uppercase font-light"
                              style={{ color: 'rgba(196,184,154,0.35)' }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Delete confirmation ── */}
                      {confirmDeleteId === garment.id && (
                        <div className="px-4 py-4 flex flex-col gap-3">
                          {deleteError ? (
                            <>
                              <p className="text-xs font-light leading-relaxed" style={{ color: 'rgba(245,240,232,0.55)' }}>
                                {deleteError}
                              </p>
                              <button
                                onClick={() => { setConfirmDeleteId(null); setDeleteError(null) }}
                                className="w-full py-2.5 text-[10px] tracking-[0.3em] uppercase font-light"
                                style={{ border: '1px solid rgba(196,184,154,0.25)', color: 'rgba(196,184,154,0.6)' }}
                              >
                                Close
                              </button>
                            </>
                          ) : (
                            <>
                              <p className="text-xs font-light" style={{ color: 'rgba(245,240,232,0.6)' }}>
                                Remove <span style={{ color: '#f5f0e8' }}>{garment.services?.sub_category ?? 'this item'}</span> from your wardrobe?
                              </p>
                              <div className="flex gap-3">
                                <button
                                  onClick={() => handleConfirmDelete(garment.id)}
                                  disabled={deleting}
                                  className="flex-1 py-2.5 text-[10px] tracking-[0.3em] uppercase font-medium disabled:opacity-40"
                                  style={{ backgroundColor: 'rgba(220,80,60,0.75)', color: '#f5f0e8' }}
                                >
                                  {deleting ? 'Removing…' : 'Yes, Remove'}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  disabled={deleting}
                                  className="flex-1 py-2.5 text-[10px] tracking-[0.3em] uppercase font-light disabled:opacity-40"
                                  style={{ border: '1px solid rgba(196,184,154,0.25)', color: 'rgba(196,184,154,0.6)' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* ── Edit form ── */}
                      {editingId === garment.id && (
                        <div className="px-4 py-4 flex flex-col gap-5">

                          {/* Service type — read-only */}
                          <div>
                            <p className="text-[10px] tracking-[0.3em] uppercase mb-1" style={{ color: 'rgba(196,184,154,0.5)' }}>
                              Item
                            </p>
                            <p className="text-sm font-light" style={{ color: 'rgba(245,240,232,0.5)' }}>
                              {garment.services?.sub_category ?? category}
                              {garment.brand ? ` · ${garment.brand}` : ''}
                            </p>
                          </div>

                          {/* Color */}
                          <div>
                            <label className="block text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: '#c4b89a' }}>
                              Color
                            </label>
                            <input
                              type="text"
                              value={editColor}
                              onChange={e => setEditColor(e.target.value)}
                              placeholder="e.g. Black"
                              className="w-full bg-transparent outline-none text-sm font-light pb-2 placeholder:text-[rgba(245,240,232,0.25)]"
                              style={{ color: '#f5f0e8', borderBottom: '1px solid rgba(196,184,154,0.4)' }}
                            />
                          </div>

                          {/* Notes */}
                          <div>
                            <label className="block text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: '#c4b89a' }}>
                              Care Notes
                            </label>
                            <textarea
                              value={editNotes}
                              onChange={e => setEditNotes(e.target.value)}
                              placeholder="e.g. Dry clean only, handle with care…"
                              rows={3}
                              className="w-full bg-transparent outline-none text-sm font-light resize-none pb-2 placeholder:text-[rgba(245,240,232,0.25)]"
                              style={{ color: '#f5f0e8', borderBottom: '1px solid rgba(196,184,154,0.4)' }}
                            />
                          </div>

                          {/* Photos */}
                          <div>
                            <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>
                              Photos
                            </label>

                            {/* Existing photos */}
                            {garment.garment_photos.filter(p => !editRemovedUrls.includes(p.url)).length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {garment.garment_photos
                                  .filter(p => !editRemovedUrls.includes(p.url))
                                  .map((photo, i) => (
                                    <div key={i} className="relative">
                                      <img
                                        src={photo.url}
                                        alt=""
                                        className="w-16 h-16 object-cover"
                                        style={{ border: '1px solid rgba(196,184,154,0.2)' }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setEditRemovedUrls(prev => [...prev, photo.url])}
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

                            {/* New photo previews */}
                            {editNewPreviews.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {editNewPreviews.map((src, i) => (
                                  <div key={i} className="relative">
                                    <img
                                      src={src}
                                      alt=""
                                      className="w-16 h-16 object-cover opacity-70"
                                      style={{ border: '1px solid rgba(196,184,154,0.35)' }}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Add photos input */}
                            <input
                              ref={editFileInputRef}
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleEditPhotoChange}
                              className="text-xs font-light w-full"
                              style={{ color: 'rgba(245,240,232,0.5)' }}
                            />
                          </div>

                          {/* Save / Cancel */}
                          <div className="flex gap-3 pt-1">
                            <button
                              onClick={() => handleSaveEdit(garment.id)}
                              disabled={saving}
                              className="flex-1 py-2.5 text-[10px] tracking-[0.3em] uppercase font-medium disabled:opacity-40"
                              style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
                            >
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={saving}
                              className="flex-1 py-2.5 text-[10px] tracking-[0.3em] uppercase font-light disabled:opacity-40"
                              style={{ border: '1px solid rgba(196,184,154,0.25)', color: 'rgba(196,184,154,0.6)' }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </main>
    </div>
  )
}
