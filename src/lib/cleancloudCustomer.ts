// Server-only — uses service role key and CLEANCLOUD_API_TOKEN.

import { createClient } from '@supabase/supabase-js'
import { callCleanCloud } from '@/lib/cleancloud'
import { normalizePhone, normalizeEmail } from '@/lib/phone'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export type EnsureCleanCloudCustomerResult =
  | { status: 'existing';     customerId: string }
  | { status: 'linked';       customerId: string; via: 'phone_and_email' | 'email_only' }
  | { status: 'created';      customerId: string }
  | { status: 'skipped';      reason: 'no_client' | 'no_email' | 'no_phone' | 'staff_account' }
  | { status: 'needs_review'; reason: 'phone_match_email_mismatch' | 'ambiguous_phone' | 'ambiguous_email' | 'unresolvable_phone' | 'addcustomer_rejected' | 'index_lookup_failed'; details?: Record<string, unknown> }
  | { status: 'would_create' }

async function writeStatus(clientId: string, label: string): Promise<void> {
  await supabaseAdmin
    .from('clients')
    .update({
      cleancloud_link_status: label,
      cleancloud_link_checked_at: new Date().toISOString(),
    })
    .eq('id', clientId)
}

export async function ensureCleanCloudCustomer(
  clientId: string,
  opts: { dryRun?: boolean } = {},
): Promise<EnsureCleanCloudCustomerResult> {
  // dryRun is a hard read-only guarantee: no Supabase writes and no CleanCloud
  // calls may be made anywhere in this function when dryRun is true. Every
  // write must be guarded by `if (!dryRun)` — add no exceptions to this rule.
  const { dryRun = false } = opts

  // A fetch error (network, RLS, missing row) is deliberately treated as
  // "no client" — this path writes nothing and creates nothing, so the
  // worst outcome is a missed link that a retry will catch.
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('id, full_name, email, phone, cleancloud_customer_id, role')
    .eq('id', clientId)
    .single()

  if (!client) return { status: 'skipped', reason: 'no_client' }

  // Already linked — return immediately without writing. This path runs on
  // every app load (CleanCloudSync retries on mount), so a status write here
  // would mean one UPDATE per page load to record what the column already says.
  if (client.cleancloud_customer_id != null) {
    return { status: 'existing', customerId: String(client.cleancloud_customer_id) }
  }

  if (client.role === 'admin') {
    if (!dryRun) await writeStatus(clientId, 'skipped:staff_account')
    return { status: 'skipped', reason: 'staff_account' }
  }

  if (!client.email) {
    if (!dryRun) await writeStatus(clientId, 'skipped:no_email')
    return { status: 'skipped', reason: 'no_email' }
  }

  if (!client.phone || !client.phone.trim()) {
    if (!dryRun) await writeStatus(clientId, 'skipped:no_phone')
    return { status: 'skipped', reason: 'no_phone' }
  }

  const phoneKey = normalizePhone(client.phone)
  const emailKey = normalizeEmail(client.email)

  if (phoneKey !== null) {
    // Branch A: phone resolved — primary lookup is by phone.
    const { data: phoneMatches, error: phoneErr } = await supabaseAdmin
      .from('cleancloud_customers')
      .select('cleancloud_customer_id, email')
      .eq('phone_e164', phoneKey)
      .eq('is_active', true)

    if (phoneErr) {
      if (!dryRun) await writeStatus(clientId, 'needs_review:index_lookup_failed')
      return {
        status: 'needs_review',
        reason: 'index_lookup_failed',
        details: { stage: 'phone_lookup', error: phoneErr.message },
      }
    }

    if (phoneMatches && phoneMatches.length > 1) {
      if (!dryRun) await writeStatus(clientId, 'needs_review:ambiguous_phone')
      return {
        status: 'needs_review',
        reason: 'ambiguous_phone',
        details: { matchedIds: phoneMatches.map(r => r.cleancloud_customer_id) },
      }
    }

    if (phoneMatches && phoneMatches.length === 1) {
      const row = phoneMatches[0]
      const rowEmail = normalizeEmail(row.email)
      // Both sides must be non-null before comparing. null === null must never
      // count as agreement — a counter customer with no email and a client whose
      // email fails normalisation would otherwise silently match each other.
      const emailMatch = emailKey !== null && rowEmail !== null && rowEmail === emailKey

      if (emailMatch) {
        const customerId = String(row.cleancloud_customer_id)
        if (!dryRun) {
          const { data: updated } = await supabaseAdmin
            .from('clients')
            .update({ cleancloud_customer_id: customerId })
            .eq('id', clientId)
            .is('cleancloud_customer_id', null)
            .select('id')

          if (!updated || updated.length === 0) {
            // Race condition: another request wrote first — re-read and return
            // the winner's ID rather than the one we just found in the index.
            const { data: refetched } = await supabaseAdmin
              .from('clients')
              .select('cleancloud_customer_id')
              .eq('id', clientId)
              .single()
            await writeStatus(clientId, 'existing')
            return { status: 'existing', customerId: String(refetched!.cleancloud_customer_id) }
          }

          await writeStatus(clientId, 'linked:phone_and_email')
        }
        return { status: 'linked', customerId, via: 'phone_and_email' }
      }

      if (!dryRun) await writeStatus(clientId, 'needs_review:phone_match_email_mismatch')
      return {
        status: 'needs_review',
        reason: 'phone_match_email_mismatch',
        details: { matchedCustomerId: row.cleancloud_customer_id, matchedEmail: row.email },
      }
    }
    // 0 rows → fall through to CREATE
  } else {
    // Branch B: phone did not resolve — never run a phone lookup on a null key.
    // A null is the absence of a key, not an empty key: the index has active
    // rows with null phone_e164 (the "Retail" walk-in account is one of them),
    // so a null-keyed lookup would match them.
    if (emailKey !== null) {
      const { data: emailMatches, error: emailErr } = await supabaseAdmin
        .from('cleancloud_customers')
        .select('cleancloud_customer_id')
        .eq('email', emailKey)
        .eq('is_active', true)

      if (emailErr) {
        if (!dryRun) await writeStatus(clientId, 'needs_review:index_lookup_failed')
        return {
          status: 'needs_review',
          reason: 'index_lookup_failed',
          details: { stage: 'email_lookup', error: emailErr.message },
        }
      }

      if (emailMatches && emailMatches.length > 1) {
        if (!dryRun) await writeStatus(clientId, 'needs_review:ambiguous_email')
        return {
          status: 'needs_review',
          reason: 'ambiguous_email',
          details: { matchedIds: emailMatches.map(r => r.cleancloud_customer_id) },
        }
      }

      if (emailMatches && emailMatches.length === 1) {
        const customerId = String(emailMatches[0].cleancloud_customer_id)
        if (!dryRun) {
          const { data: updated } = await supabaseAdmin
            .from('clients')
            .update({ cleancloud_customer_id: customerId })
            .eq('id', clientId)
            .is('cleancloud_customer_id', null)
            .select('id')

          if (!updated || updated.length === 0) {
            // Race condition: re-read and return the winner's ID.
            const { data: refetched } = await supabaseAdmin
              .from('clients')
              .select('cleancloud_customer_id')
              .eq('id', clientId)
              .single()
            await writeStatus(clientId, 'existing')
            return { status: 'existing', customerId: String(refetched!.cleancloud_customer_id) }
          }

          await writeStatus(clientId, 'linked:email_only')
        }
        return { status: 'linked', customerId, via: 'email_only' }
      }
      // 0 rows → fall through to CREATE
    } else {
      if (!dryRun) await writeStatus(clientId, 'needs_review:unresolvable_phone')
      return { status: 'needs_review', reason: 'unresolvable_phone' }
    }
  }

  // CREATE — reached only when both branches found zero matches.
  if (dryRun) return { status: 'would_create' }

  const customerName = (client.full_name ?? '').trim() || client.email
  try {
    const response = await callCleanCloud('addCustomer', {
      customerName,
      customerTel:   client.phone.trim(), // raw phone, not phoneKey — proven to work
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
      await writeStatus(clientId, 'existing')
      return { status: 'existing', customerId: String(refetched!.cleancloud_customer_id) }
    }

    await writeStatus(clientId, 'created')
    return { status: 'created', customerId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await writeStatus(clientId, 'needs_review:addcustomer_rejected')
    return {
      status: 'needs_review',
      reason: 'addcustomer_rejected',
      details: { error: message },
    }
  }
}
