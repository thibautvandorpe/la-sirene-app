import { NextResponse } from 'next/server'
import { callCleanCloud } from '@/lib/cleancloud'

// Condense long arrays so the response stays readable.
function summarise(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.length > 3 ? { count: data.length, first3: data.slice(0, 3) } : data
  }
  if (data !== null && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      out[k] = Array.isArray(v) && v.length > 3
        ? { count: v.length, first3: v.slice(0, 3) }
        : v
    }
    return out
  }
  return data
}

// Attempt to pull price list IDs out of whatever shape getPriceLists returns.
function extractPriceListIds(data: unknown): string[] {
  const candidates: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>)?.priceLists)
      ? (data as Record<string, unknown>).priceLists as unknown[]
      : Array.isArray((data as Record<string, unknown>)?.data)
        ? (data as Record<string, unknown>).data as unknown[]
        : []

  return candidates
    .map(item => {
      if (!item || typeof item !== 'object') return null
      const obj = item as Record<string, unknown>
      return obj.priceListID ?? obj.priceListId ?? obj.id ?? obj.ID
    })
    .filter((id): id is string | number => id != null)
    .map(String)
}

async function tryCall(endpoint: string, params?: Record<string, unknown>) {
  try {
    const data = await callCleanCloud(endpoint, params)
    return { ok: true as const, data }
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) }
  }
}

function report(res: Awaited<ReturnType<typeof tryCall>>) {
  if (!res.ok) return { ok: false, error: res.error }
  return { ok: true, result: summarise(res.data) }
}

// This route calls live CleanCloud endpoints, so it must never be cached.
// Without this, Next caches the handler (it has no dynamic input) and
// the Data Cache also caches the fetch calls underneath it.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse(null, { status: 404 })
  }

  // 1. getPriceLists — needed raw to extract IDs for step 5
  const priceListsRaw = await tryCall('getPriceLists')
  const priceListIds = priceListsRaw.ok ? extractPriceListIds(priceListsRaw.data) : []

  // 2–4. getProducts variants — fire in parallel
  const [withInStore, withParents, withNothing] = await Promise.all([
    tryCall('getProducts', { inStore: 1 }),
    tryCall('getProducts', { sendParents: 1, sendUpcharges: 1 }),
    tryCall('getProducts'),
  ])

  // 5. getProducts per price list ID — fire in parallel
  const perPriceList: Record<string, unknown> = {}
  await Promise.all(
    priceListIds.map(async id => {
      const res = await tryCall('getProducts', { priceListID: id })
      perPriceList[id] = report(res)
    })
  )

  return NextResponse.json({
    getPriceLists:              report(priceListsRaw),
    extractedPriceListIds:      priceListIds,
    'getProducts{}':            report(withNothing),
    'getProducts{inStore:1}':   report(withInStore),
    'getProducts{sendParents:1,sendUpcharges:1}': report(withParents),
    getProductsPerPriceList:    perPriceList,
  })
}
