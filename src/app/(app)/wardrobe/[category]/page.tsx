'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppHeader from '@/components/AppHeader'

type SubCategoryCard = {
  subCategory: string
  count: number
  firstPhotoUrl: string | null
}

export default function WardrobeCategoryPage() {
  const params = useParams()
  const router = useRouter()
  const category = decodeURIComponent(params.category as string)

  const [loaded, setLoaded] = useState(false)
  const [subCategoryCards, setSubCategoryCards] = useState<SubCategoryCard[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      const { data } = await supabase
        .from('garments')
        .select('id, services(category, sub_category), garment_photos(url)')
        .eq('client_id', session.user.id)
        .order('created_at', { ascending: false })

      const map = new Map<string, { count: number; firstPhotoUrl: string | null }>()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const g of (data ?? []) as any[]) {
        const svc = Array.isArray(g.services) ? g.services[0] : g.services
        if (!svc || svc.category !== category) continue
        const sub = svc.sub_category ?? 'Other'
        const photo = Array.isArray(g.garment_photos) ? (g.garment_photos[0]?.url ?? null) : null
        const ex = map.get(sub)
        map.set(sub, { count: (ex?.count ?? 0) + 1, firstPhotoUrl: ex?.firstPhotoUrl ?? photo })
      }

      const cards = Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([subCategory, { count, firstPhotoUrl }]) => ({ subCategory, count, firstPhotoUrl }))

      setSubCategoryCards(cards)
      setLoaded(true)
    })
  }, [category, router])

  if (!loaded) return null

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8F0ED' }}>
      <AppHeader />
      <main className="px-6 pt-4 pb-32">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/wardrobe" className="text-lg leading-none" style={{ color: '#9A7532' }} aria-label="Back">←</Link>
          <div>
            <p className="text-[10px] tracking-[0.35em] uppercase mb-0.5" style={{ color: 'rgba(154,117,50,0.5)' }}>My Wardrobe</p>
            <p className="text-lg font-light tracking-wide" style={{ color: '#141B45' }}>{category}</p>
          </div>
        </div>

        {/* Subcategory cards grid */}
        {subCategoryCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <p className="text-sm font-light" style={{ color: 'rgba(20,27,69,0.4)' }}>No items in this category yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 content-start">
            {subCategoryCards.map(({ subCategory, count, firstPhotoUrl }) => (
              <Link
                key={subCategory}
                href={`/wardrobe/${encodeURIComponent(category)}/${encodeURIComponent(subCategory)}`}
                className="relative flex flex-col justify-end overflow-hidden"
                style={{ aspectRatio: '3/4', backgroundColor: 'rgba(20,27,69,0.04)', border: '1px solid rgba(154,117,50,0.12)' }}
              >
                {firstPhotoUrl ? (
                  <>
                    <img src={firstPhotoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="relative z-10 p-3" style={{ background: 'linear-gradient(to top, rgba(20,27,69,0.85) 0%, rgba(20,27,69,0) 100%)' }}>
                      <p className="text-sm font-light tracking-wide" style={{ color: '#F8F0ED' }}>{subCategory}</p>
                      <p className="text-[10px] font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>{count} {count === 1 ? 'item' : 'items'}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span style={{ color: 'rgba(154,117,50,0.18)', fontSize: 28 }}>✦</span>
                    </div>
                    <div className="relative z-10 p-3">
                      <p className="text-sm font-light tracking-wide" style={{ color: '#141B45' }}>{subCategory}</p>
                      <p className="text-[10px] font-light mt-0.5" style={{ color: 'rgba(20,27,69,0.45)' }}>{count} {count === 1 ? 'item' : 'items'}</p>
                    </div>
                  </>
                )}
              </Link>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}
