'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppHeader from '@/components/AppHeader'

type Garment = {
  id: string
  brand: string | null
  color: string | null
  notes: string | null
  created_at: string | null
  sub_category: string
  photos: { url: string }[]
}

type TreatmentEntry = {
  id: string
  sub_category: string
  treatment_notes: string
  date: string | null
}

export default function WardrobeItemDetailPage() {
  const params = useParams()
  const router = useRouter()
  const category = decodeURIComponent(params.category as string)
  const subcategory = decodeURIComponent(params.subcategory as string)
  const garmentId = params.garmentId as string

  const [loaded, setLoaded] = useState(false)
  const [garment, setGarment] = useState<Garment | null>(null)
  const [treatments, setTreatments] = useState<TreatmentEntry[]>([])
  const [activePhotoIdx, setActivePhotoIdx] = useState(0)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editColor, setEditColor] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editRemovedUrls, setEditRemovedUrls] = useState<string[]>([])
  const [editNewPhotos, setEditNewPhotos] = useState<File[]>([])
  const [editNewPreviews, setEditNewPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const editFileInputRef = useRef<HTMLInputElement>(null)

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      // Fetch garment details
      const { data: gData } = await supabase
        .from('garments')
        .select('id, brand, color, notes, created_at, services(sub_category), garment_photos(url)')
        .eq('id', garmentId)
        .eq('client_id', session.user.id)
        .maybeSingle()

      if (!gData) { router.replace('/wardrobe'); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = gData as any
      const svc = Array.isArray(g.services) ? g.services[0] : g.services
      setGarment({
        id: g.id,
        brand: g.brand,
        color: g.color,
        notes: g.notes,
        created_at: g.created_at,
        sub_category: svc?.sub_category ?? subcategory,
        photos: Array.isArray(g.garment_photos) ? g.garment_photos : [],
      })

      // Fetch treatment history
      const { data: tData } = await supabase
        .from('order_items')
        .select('id, treatment_notes, services:service_id(sub_category), orders!inner(status, created_at)')
        .eq('garment_id', garmentId)
        .not('treatment_notes', 'is', null)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entries: TreatmentEntry[] = ((tData ?? []) as any[])
        .filter(row => {
          const order = Array.isArray(row.orders) ? row.orders[0] : row.orders
          return order && ['completed', 'ready'].includes(order.status)
        })
        .map(row => {
          const order = Array.isArray(row.orders) ? row.orders[0] : row.orders
          const svcRow = Array.isArray(row.services) ? row.services[0] : row.services
          return {
            id: row.id,
            sub_category: svcRow?.sub_category ?? '',
            treatment_notes: row.treatment_notes,
            date: order?.created_at ?? null,
          }
        })
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

      setTreatments(entries)
      setLoaded(true)
    })
  }, [garmentId, subcategory, router])

  function handleStartEdit() {
    if (!garment) return
    setEditColor(garment.color ?? '')
    setEditNotes(garment.notes ?? '')
    setEditRemovedUrls([])
    setEditNewPhotos([])
    setEditNewPreviews([])
    setEditing(true)
  }

  function handleCancelEdit() {
    setEditing(false)
    setEditRemovedUrls([])
    setEditNewPhotos([])
    setEditNewPreviews([])
  }

  function handleEditPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setEditNewPhotos(files)
    setEditNewPreviews(files.map(f => URL.createObjectURL(f)))
  }

  async function handleSaveEdit() {
    if (!garment) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('garments')
        .update({ color: editColor.trim() || null, notes: editNotes.trim() || null })
        .eq('id', garment.id)
      if (error) throw error

      if (editRemovedUrls.length > 0) {
        await supabase.from('garment_photos').delete().in('url', editRemovedUrls)
      }

      const snapshotRemoved = editRemovedUrls
      const snapshotNewPhotos = editNewPhotos
      const snapshotNewPreviews = editNewPreviews

      const remainingPhotos = garment.photos.filter(p => !snapshotRemoved.includes(p.url))
      const newBlobPhotos = snapshotNewPreviews.map(url => ({ url }))

      setGarment(prev => prev ? {
        ...prev,
        color: editColor.trim() || null,
        notes: editNotes.trim() || null,
        photos: [...remainingPhotos, ...newBlobPhotos],
      } : prev)
      setEditing(false)
      setSaving(false)

      // Fire-and-forget: delete removed from storage
      if (snapshotRemoved.length > 0) {
        Promise.all(snapshotRemoved.map(async url => {
          const parts = url.split('/garment-photos/')
          if (parts.length < 2) return
          await supabase.storage.from('garment-photos').remove([parts[1]])
        })).catch(() => {})
      }

      // Fire-and-forget: upload new photos
      if (snapshotNewPhotos.length > 0) {
        Promise.all(snapshotNewPhotos.map(async file => {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
          const path = `${garment.id}/${Date.now()}-${safeName}`
          const { error: uploadError } = await supabase.storage.from('garment-photos').upload(path, file)
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('garment-photos').getPublicUrl(path)
            await supabase.from('garment_photos').insert({ garment_id: garment.id, url: publicUrl, label: null })
          }
        })).catch(() => {})
      }
    } catch { setSaving(false) }
  }

  async function handleDelete() {
    if (!garment) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const { error } = await supabase.from('garments').delete().eq('id', garment.id)
      if (error) throw error
      router.replace(`/wardrobe/${encodeURIComponent(category)}/${encodeURIComponent(subcategory)}`)
    } catch {
      setDeleteError('This item is linked to an existing appointment and cannot be removed.')
      setDeleting(false)
    }
  }

  if (!loaded || !garment) return null

  const visiblePhotos = editing
    ? garment.photos.filter(p => !editRemovedUrls.includes(p.url))
    : garment.photos
  const activePhoto = visiblePhotos[activePhotoIdx] ?? null

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#1c2b1e' }}>
      <AppHeader />
      <main className="flex-1 pb-24">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4 mb-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/wardrobe/${encodeURIComponent(category)}/${encodeURIComponent(subcategory)}`}
              className="text-lg leading-none"
              style={{ color: '#c4b89a' }}
              aria-label="Back"
            >
              ←
            </Link>
            <div>
              <p className="text-[10px] tracking-[0.35em] uppercase mb-0.5" style={{ color: 'rgba(196,184,154,0.5)' }}>{subcategory}</p>
              <p className="text-base font-light tracking-wide" style={{ color: '#f5f0e8' }}>
                {garment.brand ?? garment.sub_category}
              </p>
            </div>
          </div>
          {!editing && !confirmDelete && (
            <button onClick={handleStartEdit} className="text-[10px] tracking-[0.25em] uppercase font-light" style={{ color: 'rgba(196,184,154,0.6)' }}>
              Edit
            </button>
          )}
        </div>

        {/* Main photo */}
        <div
          className="relative w-full"
          style={{ aspectRatio: '4/5', backgroundColor: 'rgba(196,184,154,0.06)' }}
        >
          {activePhoto ? (
            <img src={activePhoto.url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span style={{ color: 'rgba(196,184,154,0.2)', fontSize: 48 }}>✦</span>
            </div>
          )}

          {/* Photo count indicator */}
          {visiblePhotos.length > 1 && (
            <div className="absolute bottom-3 right-3 px-2 py-0.5 text-[10px] font-light" style={{ backgroundColor: 'rgba(28,43,30,0.7)', color: 'rgba(245,240,232,0.7)' }}>
              {activePhotoIdx + 1} / {visiblePhotos.length}
            </div>
          )}

          {/* Tap areas for photo navigation */}
          {visiblePhotos.length > 1 && (
            <>
              <button className="absolute left-0 top-0 h-full w-1/2" onClick={() => setActivePhotoIdx(i => Math.max(0, i - 1))} aria-label="Previous photo" />
              <button className="absolute right-0 top-0 h-full w-1/2" onClick={() => setActivePhotoIdx(i => Math.min(visiblePhotos.length - 1, i + 1))} aria-label="Next photo" />
            </>
          )}
        </div>

        {/* Thumbnail row */}
        {visiblePhotos.length > 1 && (
          <div className="flex gap-2 px-6 mt-3 overflow-x-auto">
            {visiblePhotos.map((photo, i) => (
              <button key={i} onClick={() => setActivePhotoIdx(i)} className="shrink-0">
                <img
                  src={photo.url}
                  alt=""
                  className="w-12 h-12 object-cover"
                  style={{ border: i === activePhotoIdx ? '1px solid #c4b89a' : '1px solid rgba(196,184,154,0.15)', opacity: i === activePhotoIdx ? 1 : 0.55 }}
                />
              </button>
            ))}
          </div>
        )}

        {/* Details */}
        <div className="px-6 mt-6">

          {/* ── View mode ── */}
          {!editing && !confirmDelete && (
            <>
              <div className="flex flex-col gap-5 mb-8">
                <div>
                  <p className="text-[10px] tracking-[0.3em] uppercase mb-1" style={{ color: 'rgba(196,184,154,0.5)' }}>Type</p>
                  <p className="text-sm font-light" style={{ color: '#f5f0e8' }}>{garment.sub_category}</p>
                </div>
                {garment.brand && (
                  <div>
                    <p className="text-[10px] tracking-[0.3em] uppercase mb-1" style={{ color: 'rgba(196,184,154,0.5)' }}>Brand</p>
                    <p className="text-sm font-light" style={{ color: '#f5f0e8' }}>{garment.brand}</p>
                  </div>
                )}
                {garment.color && (
                  <div>
                    <p className="text-[10px] tracking-[0.3em] uppercase mb-1" style={{ color: 'rgba(196,184,154,0.5)' }}>Color</p>
                    <p className="text-sm font-light" style={{ color: '#f5f0e8' }}>{garment.color}</p>
                  </div>
                )}
                {garment.notes && (
                  <div>
                    <p className="text-[10px] tracking-[0.3em] uppercase mb-1" style={{ color: 'rgba(196,184,154,0.5)' }}>Care Notes</p>
                    <p className="text-sm font-light leading-relaxed" style={{ color: '#f5f0e8' }}>{garment.notes}</p>
                  </div>
                )}
                {garment.created_at && (
                  <div>
                    <p className="text-[10px] tracking-[0.3em] uppercase mb-1" style={{ color: 'rgba(196,184,154,0.5)' }}>Added</p>
                    <p className="text-sm font-light" style={{ color: 'rgba(245,240,232,0.55)' }}>
                      {new Date(garment.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>

              {/* Treatment history */}
              <div className="mb-8" style={{ borderTop: '1px solid rgba(196,184,154,0.1)', paddingTop: 24 }}>
                <p className="text-[10px] tracking-[0.3em] uppercase mb-4" style={{ color: '#c4b89a' }}>Treatment History</p>
                {treatments.length === 0 ? (
                  <p className="text-xs font-light" style={{ color: 'rgba(245,240,232,0.3)' }}>
                    No treatments recorded yet
                  </p>
                ) : (
                  <ul className="flex flex-col gap-4">
                    {treatments.map(entry => (
                      <li key={entry.id} className="flex flex-col gap-1 pl-3" style={{ borderLeft: '1px solid rgba(196,184,154,0.25)' }}>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-light" style={{ color: '#f5f0e8' }}>{entry.sub_category}</p>
                          {entry.date && (
                            <p className="text-[10px] font-light" style={{ color: 'rgba(245,240,232,0.35)' }}>
                              {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                        <p className="text-[11px] font-light leading-relaxed" style={{ color: 'rgba(245,240,232,0.55)' }}>
                          {entry.treatment_notes}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Delete button */}
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full py-3 text-[10px] tracking-[0.3em] uppercase font-light mb-4"
                style={{ border: '1px solid rgba(220,80,60,0.3)', color: 'rgba(220,80,60,0.6)' }}
              >
                Remove from Wardrobe
              </button>
            </>
          )}

          {/* ── Edit mode ── */}
          {editing && (
            <div className="flex flex-col gap-6 mb-8">
              <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: '#c4b89a' }}>Edit Item</p>

              <div>
                <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>Color</label>
                <input type="text" value={editColor} onChange={e => setEditColor(e.target.value)} placeholder="e.g. Black"
                  className="w-full bg-transparent outline-none text-sm font-light pb-3 placeholder:text-[rgba(245,240,232,0.25)]"
                  style={{ color: '#f5f0e8', borderBottom: '1px solid rgba(196,184,154,0.4)' }} />
              </div>

              <div>
                <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>Care Notes</label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="e.g. Dry clean only…" rows={3}
                  className="w-full bg-transparent outline-none text-sm font-light resize-none pb-2 placeholder:text-[rgba(245,240,232,0.25)]"
                  style={{ color: '#f5f0e8', borderBottom: '1px solid rgba(196,184,154,0.4)' }} />
              </div>

              {/* Existing photos */}
              <div>
                <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>Photos</label>
                {garment.photos.filter(p => !editRemovedUrls.includes(p.url)).length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {garment.photos.filter(p => !editRemovedUrls.includes(p.url)).map((photo, i) => (
                      <div key={i} className="relative">
                        <img src={photo.url} alt="" className="w-16 h-16 object-cover" style={{ border: '1px solid rgba(196,184,154,0.2)' }} />
                        <button type="button" onClick={() => setEditRemovedUrls(prev => [...prev, photo.url])}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center text-[10px] font-medium rounded-full"
                          style={{ backgroundColor: 'rgba(220,80,60,0.85)', color: '#fff' }}
                          aria-label="Remove photo">×</button>
                      </div>
                    ))}
                  </div>
                )}
                {editNewPreviews.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {editNewPreviews.map((src, i) => <img key={i} src={src} alt="" className="w-16 h-16 object-cover opacity-70" style={{ border: '1px solid rgba(196,184,154,0.35)' }} />)}
                  </div>
                )}
                <input ref={editFileInputRef} type="file" accept="image/*" multiple onChange={handleEditPhotoChange}
                  className="text-xs font-light w-full" style={{ color: 'rgba(245,240,232,0.5)' }} />
              </div>

              <div className="flex gap-3">
                <button onClick={handleSaveEdit} disabled={saving} className="flex-1 py-3 text-[10px] tracking-[0.3em] uppercase font-medium disabled:opacity-40" style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={handleCancelEdit} disabled={saving} className="flex-1 py-3 text-[10px] tracking-[0.3em] uppercase font-light disabled:opacity-40" style={{ border: '1px solid rgba(196,184,154,0.25)', color: 'rgba(196,184,154,0.6)' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Delete confirmation ── */}
          {confirmDelete && (
            <div className="flex flex-col gap-4 mb-8">
              {deleteError ? (
                <>
                  <p className="text-xs font-light leading-relaxed" style={{ color: 'rgba(245,240,232,0.55)' }}>{deleteError}</p>
                  <button onClick={() => { setConfirmDelete(false); setDeleteError(null) }}
                    className="w-full py-3 text-[10px] tracking-[0.3em] uppercase font-light"
                    style={{ border: '1px solid rgba(196,184,154,0.25)', color: 'rgba(196,184,154,0.6)' }}>
                    Close
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs font-light" style={{ color: 'rgba(245,240,232,0.6)' }}>
                    Remove <span style={{ color: '#f5f0e8' }}>{garment.brand ?? garment.sub_category}</span> from your wardrobe?
                  </p>
                  <div className="flex gap-3">
                    <button onClick={handleDelete} disabled={deleting} className="flex-1 py-3 text-[10px] tracking-[0.3em] uppercase font-medium disabled:opacity-40" style={{ backgroundColor: 'rgba(220,80,60,0.75)', color: '#f5f0e8' }}>
                      {deleting ? 'Removing…' : 'Yes, Remove'}
                    </button>
                    <button onClick={() => setConfirmDelete(false)} disabled={deleting} className="flex-1 py-3 text-[10px] tracking-[0.3em] uppercase font-light disabled:opacity-40" style={{ border: '1px solid rgba(196,184,154,0.25)', color: 'rgba(196,184,154,0.6)' }}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
