// Server-only — uses service role key and CLEANCLOUD_API_TOKEN.

import { createClient } from '@supabase/supabase-js'
import { callCleanCloud } from '@/lib/cleancloud'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type CreatedResult  = { status: 'created';  customerId: string }
type ExistingResult = { status: 'existing'; customerId: string }
type SkippedResult  = { status: 'skipped';  reason: 'no_client' | 'no_email' | 'no_phone' }

export type EnsureCleanCloudCustomerResult =
  | CreatedResult
  | ExistingResult
  | SkippedResult

export async function ensureCleanCloudCustomer(
  clientId: string,
): Promise<EnsureCleanCloudCustomerResult> {
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('id, full_name, email, phone, cleancloud_customer_id')
    .eq('id', clientId)
    .single()

  if (!client) {
    return { status: 'skipped', reason: 'no_client' }
  }

  if (client.cleancloud_customer_id != null) {
    return { status: 'existing', customerId: String(client.cleancloud_customer_id) }
  }

  if (!client.email) {
    return { status: 'skipped', reason: 'no_email' }
  }

  if (!client.phone || !client.phone.trim()) {
    return { status: 'skipped', reason: 'no_phone' }
  }

  const customerName = (client.full_name ?? '').trim() || client.email

  const response = await callCleanCloud('addCustomer', {
    customerName,
    customerTel:   client.phone.trim(),
    customerEmail: client.email,
  }) as Record<string, unknown>

  const rawId = response?.CustomerID
  if (rawId == null) {
    throw new Error(`addCustomer returned no CustomerID: ${JSON.stringify(response)}`)
  }
  const customerId = String(rawId)

  const { data: updated } = await supabaseAdmin
    .from('clients')
    .update({ cleancloud_customer_id: customerId })
    .eq('id', clientId)
    .is('cleancloud_customer_id', null)
    .select('id')

  if (!updated || updated.length === 0) {
    console.warn(
      `ensureCleanCloudCustomer: race condition on client ${clientId} — ` +
      `orphaned CleanCloud customer ID ${customerId}. Re-reading winner.`,
    )
    const { data: refetched } = await supabaseAdmin
      .from('clients')
      .select('cleancloud_customer_id')
      .eq('id', clientId)
      .single()

    return { status: 'existing', customerId: String(refetched!.cleancloud_customer_id) }
  }

  return { status: 'created', customerId }
}
