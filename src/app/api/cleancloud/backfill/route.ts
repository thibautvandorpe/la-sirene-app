import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ensureCleanCloudCustomer } from '@/lib/cleancloudCustomer'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return new Response(null, { status: 404 })
  }

  const { data: candidates } = await supabaseAdmin
    .from('clients')
    .select('id')
    .is('cleancloud_customer_id', null)

  const ids = candidates?.map(r => r.id) ?? []
  const summary = { created: 0, existing: 0, skipped: 0, failed: 0 }
  const details: Record<string, unknown>[] = []

  for (const id of ids) {
    try {
      const result = await ensureCleanCloudCustomer(id)
      summary[result.status]++
      details.push({ id, ...result })
    } catch (err) {
      summary.failed++
      details.push({ id, status: 'failed', error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({ candidates: ids.length, summary, details })
}
