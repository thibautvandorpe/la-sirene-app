// Server-only — never import in a Client Component; CLEANCLOUD_API_TOKEN would be exposed.

const BASE_URL = 'https://cleancloudapp.com/api'

// CleanCloud allows 3 requests/second. We enforce a 350 ms gap between sends.
// lastFiredAt starts at 0 (epoch) so the first call is always immediate.
let lastFiredAt = 0

async function acquireSlot(): Promise<void> {
  const now = Date.now()
  const wait = Math.max(0, 350 - (now - lastFiredAt))
  // Reserve the slot synchronously (before any await) so concurrent callers
  // each see the updated lastFiredAt and queue behind one another correctly.
  lastFiredAt = now + wait
  if (wait > 0) await new Promise<void>(r => setTimeout(r, wait))
}

export async function callCleanCloud(
  endpoint: string,
  params: Record<string, unknown> = {},
): Promise<unknown> {
  const token = process.env.CLEANCLOUD_API_TOKEN
  if (!token) throw new Error('CLEANCLOUD_API_TOKEN is not set')

  await acquireSlot()

  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_token: token, ...params }),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`CleanCloud ${endpoint} failed: ${res.status} ${res.statusText}`)
  }

  const json = await res.json()

  // CleanCloud returns HTTP 200 with {"Error":"..."} on failures such as rate limiting.
  if (json !== null && typeof json === 'object' && 'Error' in json) {
    throw new Error(`CleanCloud ${endpoint} error: ${(json as Record<string, unknown>).Error}`)
  }

  return json
}
