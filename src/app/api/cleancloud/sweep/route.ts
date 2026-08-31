import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callCleanCloud } from '@/lib/cleancloud'
import { normalizePhone, normalizeEmail } from '@/lib/phone'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Calendar-date helpers. UTC throughout: a yyyy-mm-dd string parses as
// UTC midnight, so it must be read back with the UTC getters or the date
// shifts by a day in any negative-offset timezone (e.g. America/New_York).
function toYMD(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

// CleanCloud signals an empty date window with HTTP 200 + Error field.
// The message is misleading (no ID was sent) but it is SUCCESS, not failure.
function isEmptyWindowError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.toLowerCase().includes('no customer with that id')
}

interface CleanCloudRecord {
  ID?: unknown
  Name?: unknown
  Email?: unknown
  Tel?: unknown
  [key: string]: unknown
}

interface WindowResult {
  from: string
  to: string
  found: number
  active: number
  deactivated: number
  skippedRecords?: CleanCloudRecord[]
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse(null, { status: 404 })
  }

  const { searchParams } = req.nextUrl
  const today = new Date()

  const dateFrom = searchParams.get('dateFrom') ?? '2026-08-01'
  const dateTo = searchParams.get('dateTo') ?? toYMD(today)
  const maxWindows = Math.max(1, parseInt(searchParams.get('maxWindows') ?? '12', 10) || 12)
  const reset = searchParams.get('reset') === '1'

  // Read sweep bookmark
  const { data: stateRow, error: stateErr } = await supabaseAdmin
    .from('cleancloud_sweep_state')
    .select('*')
    .eq('id', 1)
    .single()

  if (stateErr) {
    return NextResponse.json({ error: `Could not read sweep state: ${stateErr.message}` }, { status: 500 })
  }

  // Resume from swept_through (overlap by one day — upserts are idempotent).
  // On reset or first run, start from dateFrom.
  const startDate =
    !reset && stateRow?.swept_through
      ? stateRow.swept_through   // already a yyyy-mm-dd string
      : dateFrom

  // Already done?
  if (startDate >= dateTo && !reset) {
    return NextResponse.json({
      status: 'already_complete',
      resolvedRange: { dateFrom, dateTo },
      sweepState: stateRow,
    })
  }

  // Build window list capped to maxWindows
  const windows: Array<{ from: string; to: string }> = []
  let cursor = new Date(startDate)
  const end = new Date(dateTo)
  while (cursor <= end && windows.length < maxWindows) {
    const winFrom = toYMD(cursor)
    const winEnd = addDays(cursor, 30)
    const winTo = toYMD(winEnd <= end ? winEnd : end)
    windows.push({ from: winFrom, to: winTo })
    cursor = addDays(new Date(winTo), 1)
  }

  const windowResults: WindowResult[] = []
  const totals = { found: 0, upserted: 0, active: 0, deactivated: 0 }
  let stoppedBecause: 'maxWindows' | 'rangeComplete' | 'error' = 'rangeComplete'
  let errorMessage: string | undefined
  let isFirstWindow = true

  for (const win of windows) {
    // ── Call A: all customers in window ─────────────────────────────────
    let responseA: unknown
    try {
      responseA = await callCleanCloud('getCustomer', { dateFrom: win.from, dateTo: win.to })
    } catch (err) {
      if (isEmptyWindowError(err)) {
        // Case 1: no customers in this window — advance bookmark and continue
        await advanceBookmark(win.to, isFirstWindow ? dateFrom : undefined)
        windowResults.push({ from: win.from, to: win.to, found: 0, active: 0, deactivated: 0 })
        isFirstWindow = false
        continue
      }
      // Case 4: real failure — stop, do not advance bookmark
      stoppedBecause = 'error'
      errorMessage = err instanceof Error ? err.message : String(err)
      break
    }

    // Validate shape — no guessing
    const recordsA = extractCustomers(responseA)
    if (recordsA === null) {
      stoppedBecause = 'error'
      const topKeys = responseA !== null && typeof responseA === 'object'
        ? Object.keys(responseA as object)
        : []
      errorMessage = `getCustomer response missing 'Customers' array. Top-level keys: [${topKeys.join(', ')}]`
      break
    }

    // ── Call B: active-only customers in window ──────────────────────────
    let activeIdSet = new Set<string>()
    try {
      const responseB = await callCleanCloud('getCustomer', {
        dateFrom: win.from,
        dateTo: win.to,
        excludeDeactivated: 1,
      })
      const recordsB = extractCustomers(responseB)
      if (recordsB === null) {
        stoppedBecause = 'error'
        const topKeys = responseB !== null && typeof responseB === 'object'
          ? Object.keys(responseB as object)
          : []
        errorMessage = `getCustomer (excludeDeactivated) response missing 'Customers' array. Top-level keys: [${topKeys.join(', ')}]`
        break
      }
      activeIdSet = buildIdSet(recordsB)
    } catch (err) {
      if (!isEmptyWindowError(err)) {
        // Case 4: real failure on call B
        stoppedBecause = 'error'
        errorMessage = err instanceof Error ? err.message : String(err)
        break
      }
      // Case 2: all customers in this window are deactivated — activeIdSet stays empty
    }

    // ── Build upsert batch ───────────────────────────────────────────────
    const batch: Record<string, unknown>[] = []
    const skippedRecords: CleanCloudRecord[] = []
    let windowActive = 0
    let windowDeactivated = 0

    for (const rec of recordsA) {
      const id = typeof rec.ID === 'string' ? rec.ID.trim() : String(rec.ID ?? '').trim()
      if (!id) {
        skippedRecords.push(rec)
        continue
      }
      const isActive = activeIdSet.has(id)
      if (isActive) windowActive++; else windowDeactivated++

      batch.push({
        cleancloud_customer_id: id,
        full_name: rec.Name ?? null,
        phone_raw: rec.Tel ?? null,
        phone_e164: normalizePhone(typeof rec.Tel === 'string' ? rec.Tel : null),
        email: normalizeEmail(typeof rec.Email === 'string' ? rec.Email : null),
        is_active: isActive,
        last_synced_at: new Date().toISOString(),
      })
    }

    // ── Upsert entire window in one call ─────────────────────────────────
    if (batch.length > 0) {
      const { error: upsertErr } = await supabaseAdmin
        .from('cleancloud_customers')
        .upsert(batch, { onConflict: 'cleancloud_customer_id' })

      if (upsertErr) {
        stoppedBecause = 'error'
        errorMessage = `Upsert failed for window ${win.from}→${win.to}: ${upsertErr.message}`
        break
      }
    }

    // ── Advance bookmark ─────────────────────────────────────────────────
    await advanceBookmark(win.to, isFirstWindow ? dateFrom : undefined)

    totals.found += recordsA.length
    totals.upserted += batch.length
    totals.active += windowActive
    totals.deactivated += windowDeactivated

    const winResult: WindowResult = {
      from: win.from,
      to: win.to,
      found: recordsA.length,
      active: windowActive,
      deactivated: windowDeactivated,
    }
    if (skippedRecords.length > 0) winResult.skippedRecords = skippedRecords
    windowResults.push(winResult)
    isFirstWindow = false
  }

  // Determine stop reason if not already set to 'error'
  if (stoppedBecause !== 'error') {
    const lastProcessed = windowResults.at(-1)?.to
    stoppedBecause = lastProcessed && lastProcessed >= dateTo ? 'rangeComplete' : 'maxWindows'
  }

  // Fetch final sweep state
  const { data: finalState } = await supabaseAdmin
    .from('cleancloud_sweep_state')
    .select('*')
    .eq('id', 1)
    .single()

  return NextResponse.json({
    resolvedRange: { dateFrom, dateTo },
    startedAt: startDate,
    windows: windowResults,
    totals,
    stoppedBecause,
    ...(errorMessage ? { error: errorMessage } : {}),
    sweepState: finalState,
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractCustomers(response: unknown): CleanCloudRecord[] | null {
  if (response === null || typeof response !== 'object') return null
  const obj = response as Record<string, unknown>
  if (!Array.isArray(obj.Customers)) return null
  return obj.Customers as CleanCloudRecord[]
}

function buildIdSet(records: CleanCloudRecord[]): Set<string> {
  const set = new Set<string>()
  for (const rec of records) {
    const id = typeof rec.ID === 'string' ? rec.ID.trim() : String(rec.ID ?? '').trim()
    if (id) set.add(id)
  }
  return set
}

async function advanceBookmark(sweptThrough: string, sweptFrom?: string) {
  const update: Record<string, unknown> = {
    swept_through: sweptThrough,
    last_run_at: new Date().toISOString(),
  }
  if (sweptFrom !== undefined) update.swept_from = sweptFrom
  await supabaseAdmin
    .from('cleancloud_sweep_state')
    .update(update)
    .eq('id', 1)
}
