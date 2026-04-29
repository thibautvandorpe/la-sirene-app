'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppHeader from '@/components/AppHeader'

type GarmentCard = {
  id: string
  brand: string | null
  color: string | null
  firstPhotoUrl: string | null
}

export default function WardrobeSubCategoryPage() {
  const params = useParams()
  const router = useRouter()
  const category = decodeURIComponent(params.category as string)
  const subcategory = decodeURIComponent(params.subcategory as string)

  const [loaded, setLoaded] = useState(false)
  const [garments, setGarments] = useState<GarmentCard[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      const { data } = await supabase
        .from('garments')
        .select('id, brand, color, services(category, sub_category), garment_photos(url)')
        .eq('client_id', session.user.id)
        .order('created_at', { ascending: false })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filtered = ((data ?? []) as any[])
        .filter(g => {
          const svc = Array.isArray(g.services) ? g.services[0] : g.services
          return svc?.category === category && svc?.sub_category === subcategory
        })
        .map(g => ({
          id: g.id as string,
          brand: g.brand as string | null,
          color: g.color as string | null,
          firstPhotoUrl: Array.isArray(g.garment_photos) ? (g.garment_photos[0]?.url ?? null) : null,
        }))

      setGarments(filtered)
      setLoaded(true)
    })
  }, [category, subcategory, router])

  if (!loaded) return null

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#1c2b1e' }}>
      <AppHeader />
      <main className="flex-1 px-6 pt-4 pb-24">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/wardrobe/${encodeURIComponent(category)}`} className="text-lg leading-none" style={{ color: '#c4b89a' }} aria-label="Back">←</Link>
          <div>
            <p className="text-[10px] tracking-[0.35em] uppercase mb-0.5" style={{ color: 'rgba(196,184,154,0.5)' }}>{category}</p>
            <p className="text-lg font-light tracking-wide" style={{ color: '#f5f0e8' }}>{subcategory}</p>
          </div>
        </div>

        {/* Items count */}
        {garments.length > 0 && (
          <p className="text-xs font-light mb-5" style={{ color: 'rgba(245,240,232,0.35)' }}>
            {garments.length} {garments.length === 1 ? 'item' : 'items'}
          </p>
        )}

        {/* Garment grid */}
        {garments.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <p className="text-sm font-light" style={{ color: 'rgba(245,240,232,0.4)' }}>No items here yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {garments.map(garment => (
              <Link
                key={garment.id}
                href={`/wardrobe/${encodeURIComponent(category)}/${encodeURIComponent(subcategory)}/${garment.id}`}
                className="flex flex-col overflow-hidden"
                style={{ backgroundColor: 'rgba(245,240,232,0.04)', border: '1px solid rgba(196,184,154,0.12)' }}
              >
                {/* Photo */}
                <div className="relative w-full" style={{ aspectRatio: '1/1', backgroundColor: 'rgba(196,184,154,0.06)' }}>
                  {garment.firstPhotoUrl ? (
                    <img src={garment.firstPhotoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span style={{ color: 'rgba(196,184,154,0.2)', fontSize: 24 }}>✦</span>
                    </div>
                  )}
                </div>
                {/* Details */}
                <div className="p-3">
                  {(garment.brand || garment.color) ? (
                    <>
                      {garment.brand && <p className="text-xs font-light" style={{ color: '#f5f0e8' }}>{garment.brand}</p>}
                      {garment.color && <p className="text-[10px] font-light mt-0.5" style={{ color: 'rgba(245,240,232,0.45)' }}>{garment.color}</p>}
                    </>
                  ) : (
                    <p className="text-xs font-light" style={{ color: 'rgba(245,240,232,0.35)' }}>{subcategory}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}
