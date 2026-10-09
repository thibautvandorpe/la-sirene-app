import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizePhone, normalizeEmail } from '@/lib/phone'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// This route reads live Supabase state, so it must never be cached.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type ClientRow = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  role: string | null
  created_at: string
  cleancloud_link_status: string | null
  cleancloud_link_checked_at: string | null
}

type CustomerRow = {
  cleancloud_customer_id: string
  full_name: string | null
  phone_raw: string | null
  phone_e164: string | null
  email: string | null
  is_active: boolean
}

type Suggestion = CustomerRow & { matchedOn: 'phone' | 'email' | 'both' }

type QueueEntry = {
  clientId: string
  fullName: string | null
  email: string | null
  phone: string | null
  role: string | null
  createdAt: string
  linkStatus: string | null
  linkCheckedAt: string | null
  phoneKey: string | null
  emailKey: string | null
  suggestions: Suggestion[]
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: caller } = await supabaseAdmin
    .from('clients')
    .select('role')
    .eq('id', user.id)
    .single()

  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: clients, error: clientsError } = await supabaseAdmin
    .from('clients')
    .select('id, full_name, email, phone, role, created_at, cleancloud_link_status, cleancloud_link_checked_at')
    .is('cleancloud_customer_id', null)

  if (clientsError) {
    return NextResponse.json({ error: `Could not fetch clients: ${clientsError.message}` }, { status: 500 })
  }

  const keyed = ((clients ?? []) as ClientRow[]).map(client => ({
    client,
    phoneKey: normalizePhone(client.phone),
    emailKey: normalizeEmail(client.email),
  }))

  const phoneKeys = Array.from(new Set(keyed.map(k => k.phoneKey).filter((k): k is string => k !== null)))
  const emailKeys = Array.from(new Set(keyed.map(k => k.emailKey).filter((k): k is string => k !== null)))

  let phoneMatches: CustomerRow[] = []
  if (phoneKeys.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('cleancloud_customers')
      // Suggestions deliberately do NOT filter is_active, unlike the matcher.
      // The queue exists to tell the operator "this phone/email belongs to
      // deactivated customer N" — that is one of its main jobs. Do not add an
      // is_active filter here.
      .select('cleancloud_customer_id, full_name, phone_raw, phone_e164, email, is_active')
      .in('phone_e164', phoneKeys)
    if (error) {
      return NextResponse.json({ error: `Could not fetch phone suggestions: ${error.message}` }, { status: 500 })
    }
    phoneMatches = (data ?? []) as CustomerRow[]
  }

  let emailMatches: CustomerRow[] = []
  if (emailKeys.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('cleancloud_customers')
      .select('cleancloud_customer_id, full_name, phone_raw, phone_e164, email, is_active')
      .in('email', emailKeys)
    if (error) {
      return NextResponse.json({ error: `Could not fetch email suggestions: ${error.message}` }, { status: 500 })
    }
    emailMatches = (data ?? []) as CustomerRow[]
  }

  // Keyed maps, not a pooled array scanned with `===`. The index has active
  // rows with a null phone_e164, and rows fetched via the email query can
  // likewise have a null phone_e164 (or vice versa for email). A client with
  // phoneKey: null would match every null-phone row on a pooled `===` scan —
  // the same null-key trap from the matcher, reappearing in the join. Only
  // rows whose own key column is non-null are ever inserted, so a null key
  // can never enter either map and `Map.get(null)` is never reached.
  const byPhone = new Map<string, CustomerRow[]>()
  for (const row of phoneMatches) {
    if (row.phone_e164 === null) continue
    const list = byPhone.get(row.phone_e164) ?? []
    list.push(row)
    byPhone.set(row.phone_e164, list)
  }

  const byEmail = new Map<string, CustomerRow[]>()
  for (const row of emailMatches) {
    if (row.email === null) continue
    const list = byEmail.get(row.email) ?? []
    list.push(row)
    byEmail.set(row.email, list)
  }

  function suggestionsFor(phoneKey: string | null, emailKey: string | null): Suggestion[] {
    const phoneHits = phoneKey !== null ? (byPhone.get(phoneKey) ?? []) : []
    const emailHits = emailKey !== null ? (byEmail.get(emailKey) ?? []) : []

    const byId = new Map<string, Suggestion>()

    for (const row of phoneHits) {
      byId.set(row.cleancloud_customer_id, { ...row, matchedOn: 'phone' })
    }
    for (const row of emailHits) {
      const existing = byId.get(row.cleancloud_customer_id)
      byId.set(row.cleancloud_customer_id, { ...row, matchedOn: existing ? 'both' : 'email' })
    }

    return Array.from(byId.values())
  }

  const needsAction: QueueEntry[] = []
  const informational: QueueEntry[] = []
  const byStatus: Record<string, number> = {}

  for (const { client, phoneKey, emailKey } of keyed) {
    const statusKey = client.cleancloud_link_status ?? 'never_checked'
    byStatus[statusKey] = (byStatus[statusKey] ?? 0) + 1

    const entry: QueueEntry = {
      clientId: client.id,
      fullName: client.full_name,
      email: client.email,
      phone: client.phone,
      role: client.role,
      createdAt: client.created_at,
      linkStatus: client.cleancloud_link_status,
      linkCheckedAt: client.cleancloud_link_checked_at,
      phoneKey,
      emailKey,
      suggestions: suggestionsFor(phoneKey, emailKey),
    }

    if (client.cleancloud_link_status?.startsWith('needs_review:')) {
      needsAction.push(entry)
    } else {
      informational.push(entry)
    }
  }

  needsAction.sort((a, b) => {
    if (a.linkCheckedAt === null && b.linkCheckedAt === null) return 0
    if (a.linkCheckedAt === null) return 1
    if (b.linkCheckedAt === null) return -1
    return new Date(a.linkCheckedAt).getTime() - new Date(b.linkCheckedAt).getTime()
  })

  informational.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    counts: {
      needsAction: needsAction.length,
      informational: informational.length,
      byStatus,
    },
    needsAction,
    informational,
  })
}
