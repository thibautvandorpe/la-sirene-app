import { NextRequest, NextResponse } from 'next/server'
import { callCleanCloud } from '@/lib/cleancloud'

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

// Find the first array-valued top-level key in a response object.
function findRecordArray(response: unknown): [string | null, unknown[]] {
  if (response === null || typeof response !== 'object') return [null, []]
  for (const [key, value] of Object.entries(response as Record<string, unknown>)) {
    if (Array.isArray(value)) return [key, value]
  }
  return [null, []]
}

// Try known ID field names in priority order.
function extractId(record: unknown): { id: unknown; field: string | null } {
  if (record === null || typeof record !== 'object') return { id: null, field: null }
  const r = record as Record<string, unknown>
  for (const f of ['id', 'Id', 'ID', 'customerId', 'CustomerID', 'customerID']) {
    if (f in r) return { id: r[f], field: f }
  }
  return { id: null, field: null }
}

// Return the response verbatim, but if the record array exceeds 25 entries
// truncate it to 3 and add metadata fields so the truncation is visible.
function buildRawOutput(response: unknown): unknown {
  const [arrayKey, records] = findRecordArray(response)
  if (arrayKey === null || records.length <= 25) return response
  const obj = response as Record<string, unknown>
  return {
    ...obj,
    [arrayKey]: records.slice(0, 3),
    _truncated: true,
    _totalCount: records.length,
  }
}

function buildSummary(response: unknown) {
  const topLevelKeys =
    response !== null && typeof response === 'object'
      ? Object.keys(response as object)
      : []

  const [arrayKey, records] = findRecordArray(response)

  if (arrayKey === null) {
    return {
      topLevelKeys,
      arrayKeyFound: null,
      count: 0,
      idFieldsUsed: null,
      idExtractionFailedAt: null,
      customerIds: null,
    }
  }

  const idFieldsSeen = new Set<string>()
  const failedAt: number[] = []
  const customerIds: unknown[] = []

  records.forEach((rec, i) => {
    const { id, field } = extractId(rec)
    if (field !== null) {
      idFieldsSeen.add(field)
      customerIds.push(id)
    } else {
      failedAt.push(i)
    }
  })

  return {
    topLevelKeys,
    arrayKeyFound: arrayKey,
    count: records.length,
    idFieldsUsed: idFieldsSeen.size > 0 ? Array.from(idFieldsSeen) : null,
    idExtractionFailedAt: failedAt.length > 0 ? failedAt : null,
    customerIds,
  }
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse(null, { status: 404 })
  }

  const { searchParams } = req.nextUrl
  const today = new Date()
  const dateFrom = searchParams.get('dateFrom') ?? toYMD(addDays(today, -30))
  const dateTo = searchParams.get('dateTo') ?? toYMD(today)

  const fromMs = new Date(dateFrom).getTime()
  const toMs = new Date(dateTo).getTime()

  if (isNaN(fromMs) || isNaN(toMs)) {
    return NextResponse.json(
      { error: 'Invalid date format — use yyyy-mm-dd.' },
      { status: 400 },
    )
  }

  const diffDays = (toMs - fromMs) / (1000 * 60 * 60 * 24)
  if (diffDays > 31) {
    return NextResponse.json(
      {
        error: `Window is ${Math.round(diffDays)} days wide — CleanCloud rejects windows wider than 31 days. Narrow it.`,
      },
      { status: 400 },
    )
  }

  let responseA: unknown = null
  let callAError: string | null = null
  let responseB: unknown = null
  let callBError: string | null = null

  try {
    responseA = await callCleanCloud('getCustomer', { dateFrom, dateTo })
  } catch (err) {
    callAError = err instanceof Error ? err.message : String(err)
  }

  try {
    responseB = await callCleanCloud('getCustomer', { dateFrom, dateTo, excludeDeactivated: 1 })
  } catch (err) {
    callBError = err instanceof Error ? err.message : String(err)
  }

  const summaryA = callAError ? null : buildSummary(responseA)
  const summaryB = callBError ? null : buildSummary(responseB)

  const [, recordsA] = findRecordArray(responseA)
  const firstCustomerRecord = recordsA[0] ?? null

  let inAButNotInB: unknown[] | null = null
  if (
    summaryA?.customerIds != null &&
    summaryB?.customerIds != null
  ) {
    const idSetB = new Set(summaryB.customerIds.map(id => String(id)))
    inAButNotInB = summaryA.customerIds.filter(id => !idSetB.has(String(id)))
  }

  return NextResponse.json({
    dateFrom,
    dateTo,
    callA: callAError ? { error: callAError } : summaryA,
    callB: callBError ? { error: callBError } : summaryB,
    firstCustomerRecord,
    inAButNotInB,
    rawA: callAError ? { error: callAError } : buildRawOutput(responseA),
    rawB: callBError ? { error: callBError } : buildRawOutput(responseB),
  })
}
