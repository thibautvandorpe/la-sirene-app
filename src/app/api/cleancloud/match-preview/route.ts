import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ensureCleanCloudCustomer } from '@/lib/cleancloudCustomer'
import { normalizePhone, normalizeEmail } from '@/lib/phone'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// This route reads live Supabase state, so it must never be cached.
// Without this, Next caches the handler (it has no dynamic input) and
// the Data Cache also caches the Supabase fetches underneath it.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse(null, { status: 404 })
  }

  const { data: clients, error } = await supabaseAdmin
    .from('clients')
    .select('id, full_name, email, phone, role, cleancloud_customer_id')
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: `Could not fetch clients: ${error.message}` }, { status: 500 })
  }

  const counts: Record<string, number> = {}
  const rows: Record<string, unknown>[] = []

  for (const client of clients ?? []) {
    const decision = await ensureCleanCloudCustomer(client.id, { dryRun: true })
    counts[decision.status] = (counts[decision.status] ?? 0) + 1
    rows.push({
      id: client.id,
      full_name: client.full_name,
      email: client.email,
      phone: client.phone,
      role: client.role,
      cleancloud_customer_id: client.cleancloud_customer_id,
      phoneKey: normalizePhone(client.phone),
      emailKey: normalizeEmail(client.email),
      decision,
    })
  }

  return NextResponse.json({ counts, clients: rows })
}
