# La Sirène App — Changelog

A human-readable log of all features and changes built session by session.
For full code-level detail, see the [Git commit history](https://github.com/thibautvandorpe/la-sirene-app/commits/main).

---

## 2026-08-31 — TypeScript build fix: Set spread in customer-probe route

- `[...idFieldsSeen]` (a `Set<string>`) used spread syntax which TypeScript rejects at the default ES5 target; changed to `Array.from(idFieldsSeen)` which works at any target
- `npx tsc --noEmit` confirms the whole project is clean
- Added "run `npx tsc --noEmit` before every push" rule to CLAUDE.md so this class of error is caught locally before Vercel sees it

---

## 2026-08-31 — Next.js caching fix for dev-only diagnostic routes

- `match-preview`, `backfill`, and `test` routes each had `export async function GET()` with no request parameter — Next.js treats parameterless handlers as having no dynamic input and caches them; the Supabase client (which runs over fetch) is also intercepted by the Data Cache, so subsequent calls returned the first response forever regardless of database changes
- Added `export const dynamic = 'force-dynamic'` and `export const fetchCache = 'force-no-store'` to all three; `normalize-test` was confirmed safe to leave alone (pure computation over fixed in-memory data, no external calls)
- Added the rule to CLAUDE.md so future diagnostic routes get the directives from the start

---

## 2026-08-31 — Customer matching Step 4a: matching logic

- Rewrote `src/lib/cleancloudCustomer.ts` with a full index-based matching strategy replacing the old create-only flow
- New result union: `existing` · `linked` (with `via: 'phone_and_email' | 'email_only'`) · `created` · `skipped` (with reason) · `needs_review` (with reason + details) · `would_create` (dry-run only)
- Decision order: no client → existing link → staff account (admin role, checked before any CleanCloud call) → no email → no phone → normalise keys → Branch A (phone lookup) → Branch B (email-only lookup) → create
- Branch A (phone resolves): queries `cleancloud_customers` where `phone_e164 = phoneKey AND is_active = true`; links on a single match with email confirmation (null-safe — `null === null` is never treated as agreement); flags `phone_match_email_mismatch`, `ambiguous_phone`, or falls through to create
- Branch B (phone does not resolve): never runs a phone lookup on a null key (the "Retail" walk-in account is an active row with null `phone_e164`); queries by email instead; links on a single match (`email_only`); flags `ambiguous_email`; or flags `unresolvable_phone` when email is also null
- Both link branches carry a `.is('cleancloud_customer_id', null)` race guard; if a concurrent request wins, re-reads the row and returns `existing` with the winner's ID — same as the create path
- `addCustomer` sends the raw phone string (not the normalised E.164) — proven round-trip; rejection is caught and returned as `needs_review:addcustomer_rejected` rather than thrown
- `dryRun` option: performs all reads, returns identical result objects, but makes zero Supabase writes and zero CleanCloud calls; enforced by a comment at the top of the function
- `cleancloud_link_status` and `cleancloud_link_checked_at` written on every terminal outcome except: `no_client` (no row), `existing` early return (runs on every page load — writing there would be one UPDATE per mount), and any dry-run call
- Two new nullable columns required before this runs: `cleancloud_link_status text` and `cleancloud_link_checked_at timestamptz` on `public.clients` (SQL in step 4a of the customer-matching plan)
- Added `src/app/api/cleancloud/match-preview/route.ts` (dev-only GET): runs `ensureCleanCloudCustomer` in dry-run mode over every client row and returns per-client keys, normalised phone/email, and the decision — incapable of writing anything
- Fixed `src/app/api/cleancloud/backfill/route.ts`: added `linked`, `needs_review`, `would_create` to the summary object so new statuses don't produce NaN

---

## 2026-08-31 — Customer matching Step 2b: historical sweep

- Added `src/app/api/cleancloud/sweep/route.ts` (dev-only GET, 404 in production): walks the full CleanCloud customer history in consecutive 31-day windows and upserts every customer into the `cleancloud_customers` index table
- Accepts optional `dateFrom` (default `2026-08-01`), `dateTo` (default today), `maxWindows` (default 12), and `reset=1` query parameters; re-running continues from where the previous run stopped via the `cleancloud_sweep_state` bookmark table
- Resume overlap: restarts from `swept_through` rather than the day after, so records near a window boundary can never fall through a timezone gap; idempotent upserts make the re-read harmless
- CleanCloud returns `"No Customer With That ID"` (HTTP 200 + Error field) for an empty date window; the sweep treats this as success and advances the bookmark rather than stopping
- Response shape is read explicitly (`response.Customers`, `record.ID`) — no heuristics; a missing or wrong shape stops the sweep and returns the actual top-level keys so the mismatch is visible
- Records with a missing or empty `ID` are skipped and listed in `skippedRecords` rather than passed to the upsert (a null primary key would throw mid-window)
- Upserts are batched once per window, not once per record; `phone_e164` and `email` store SQL `null` when normalisation cannot resolve the value — never an empty string
- Extended `src/app/api/cleancloud/normalize-test/route.ts` to also test `normalizeEmail`; response now separates `phone` and `email` blocks each with their own summary

---

## 2026-08-31 — Customer matching Step 2a: getCustomer probe route

- Added dev-only GET route at `/api/cleancloud/customer-probe` (returns 404 in production)
- Calls CleanCloud's `getCustomer` endpoint twice with an identical date window: once plain (call A) and once with `excludeDeactivated: 1` (call B), then diffs the results
- Accepts optional `dateFrom` / `dateTo` query params (yyyy-mm-dd); defaults to the last 30 days; returns 400 if the window exceeds 31 days (CleanCloud's hard limit)
- Response includes: top-level keys, heuristic-derived record count and customer IDs, and explicit failure flags (`arrayKeyFound: null`, `idExtractionFailedAt`) when the heuristic cannot parse the shape — so an empty result from a parse failure is distinguishable from a genuinely empty dataset
- `firstCustomerRecord` — first complete, unredacted record from call A showing every field name and value type
- `inAButNotInB` — IDs present in call A but absent from call B (expected to be the deactivated set)
- `rawA` / `rawB` — complete, unmodified response bodies; if the record array exceeds 25 entries only the first 3 are included and `_truncated: true` / `_totalCount` are added alongside

---

## 2026-08-31 — Customer matching Step 1: schema and phone normalisation

- Two new Supabase tables for the CleanCloud customer index (SQL run manually in the Supabase editor):
  - `cleancloud_customers` — local mirror of CleanCloud's customer list, with `phone_e164` (normalised matching key), `phone_raw` (as returned by CleanCloud), `email` (lowercased), `full_name`, `is_active`, and sync timestamps. Non-unique indexes on `phone_e164` and `email`. RLS enabled with **no policies** — both tables are written server-side only via the service role key; a `using (true)` policy would expose POS customer data (names, phones, emails) to anyone holding the anon key.
  - `cleancloud_sweep_state` — single-row bookmark table (enforced by a check constraint) that lets the historical customer sweep resume after an interruption. Seeded with `id = 1` so Step 2 needs no "no row yet" branch.
- `src/lib/phone.ts` — new file exporting `normalizePhone(input)` and `normalizeEmail(input)`. `normalizePhone` converts to E.164 or returns `null`; it never guesses, because a wrong match silently links the wrong CleanCloud customer to the wrong Supabase account. Handles US 10-digit, US 11-digit with country code, and international `+` prefixed formats. French national format and any other ambiguous input returns `null`.
- `src/app/api/cleancloud/normalize-test/route.ts` — dev-only test harness (returns 404 in production); open in the browser to run 17 fixed test cases and see pass/fail per case plus a summary count.

---

## 2026-08-31 — Project briefing brought up to date

- `CLAUDE.md` at the repo root has been fully rewritten to reflect the current state of the codebase and Supabase schema as of 2026-08-31
- Added: Light Blush palette documentation with the retired-colours warning and design rules; the Tailwind CSS-variable opacity trap; CleanCloud integration section with the mirror model, API contract, and all known traps; Booking Flow section preserved from the old briefing; complete App Structure tree; verified database schema (including `clients.role`, `cleancloud_customer_id`, `order_status_history`, correct `chat_messages` column names); updated roadmap starting at customer matching; and an expanded Key Decisions list
- Removed: outdated forest-green brand identity, old roadmap items that are now complete, port 3001 reference

---

## 2026-08-31 — CleanCloud customer linking

- Added a `cleancloud_customer_id` column (text, nullable, with a partial unique index) to the `clients` table — this is the bridge between a La Sirène Supabase account and the corresponding customer record in CleanCloud POS
- Built `ensureCleanCloudCustomer()` in `src/lib/cleancloudCustomer.ts`: an idempotent server-side helper that reads the client row, calls CleanCloud's `addCustomer` API if no ID exists yet, and writes the returned ID back; safe to call repeatedly — it exits early if the client is already linked and handles race conditions with a conditional database update
- Built a protected POST route at `/api/cleancloud/customer`: the browser calls this to trigger a sync; the client's identity comes from their Supabase session token (never from the request body), so it cannot be spoofed
- Linking now happens automatically at two points: immediately when a new user clicks their email confirmation link (auth callback), and silently on every app load for anyone the first attempt missed (via the `CleanCloudSync` client component mounted in the app layout)
- Phone number is now required at signup — CleanCloud's `addCustomer` API requires a phone number, so accounts without one cannot be linked
- Built a dev-only backfill route at `/api/cleancloud/backfill` to link all pre-existing clients who signed up before this feature was added; returns a full summary (created / existing / skipped / failed) and a per-client details array

---

## 2026-08-28 — Light Blush design palette

- Replaced the dark forest-green theme with the Light Blush palette across the entire app (client and admin)
- **Palette:** background `#F8F0ED` (blush), ink `#141B45` (navy), brass `#9A7532`, button fill `#DBA69D` (rose), destructive `#B45F52` (brick)
- Client pages (`(app)/`, signup, AppHeader, BottomNav): all backgrounds, text, borders, and badges updated
- Home page: arched photo hero replaces the old logo/text block; `/wordmark.png` overlaid in white at the base of the arch
- App constrained to 430 px max-width on desktop; BottomNav inner tabs centred to match
- Admin pages (dashboard, appointments, orders, conversations): full palette sweep — all dark-green rgba tokens, old champagne `#c4b89a`, and off-white `#f5f0e8` replaced; badge dictionaries updated to new blush-palette values; card backgrounds removed (brass hairline border only); green action buttons (Mark as Ready / In Progress) replaced with brass/rose

---

## 2026-06-05 — Chat timestamps

- Message bubbles in client chat and admin thread view now show a timestamp below each message (e.g. "Jun 4, 2:35 PM")

---

## 2026-06-04 — Chat with Advisor (Phase 1)

- New `chat_messages` table in Supabase with RLS (dev_open_access) and Realtime enabled
- Profile tab now shows a "Messages" section linking to the chat screen
- New client chat screen at `/profile/chat`: real-time message thread with the La Sirène team; messages delivered instantly via Supabase Realtime without page refresh
- New admin Conversations page at `/admin/conversations`: lists all clients who have sent messages, with last message preview and unread count badge
- New admin thread view at `/admin/conversations/[clientId]`: full message history per client; admin can reply; opening the thread marks all client messages as read
- Admin dashboard shows a Conversations card with total unread count (orange when > 0)

---

## 2026-04 — Foundation & Core Features

### Authentication
- Built full authentication flow: signup, email confirmation, login, logout
- Supabase trigger auto-creates a `clients` profile row when a new user signs up
- Branded signup and login pages (dark green background, champagne accents, serif typography)

### App Layout
- Mobile-first PWA setup — app is installable from Safari on iPhone
- 4-tab bottom navigation bar: Home, Orders, Wardrobe, Profile
- Shared `AppHeader` component showing user's name or logo depending on tab
- Protected tabs show a sign-in prompt when the user is logged out

### Home Tab
- Round white logo as hero centerpiece
- Brand name displayed below logo

### Orders Tab
- "Book an Appointment" button fixed above the tab bar, always visible
- "My Appointments" section: lists draft, pending, confirmed, and cancelled appointments with relevant actions
- "My Orders" section: lists business-created orders with status badges

### Booking Flow (4 steps)
- **Step 1 — Delivery Method:** Pick Up / Drop Off / FedEx as tappable cards
- **Step 2 — Date & Time:** date picker + 5 tappable time slot cards (Pick Up only); Drop Off and FedEx skip this step and show boutique address info
- **Step 3 — Items:** add, edit, remove garments; category + subcategory card grids; wardrobe selector; photo upload per item (stored in Supabase `appointment-photos` bucket)
- **Step 4 — Review & Quote:** itemized list, estimated total, price disclaimer, Confirm button
- Draft bookings are saved to Supabase and can be resumed from the Orders tab

### Profile Tab
- Editable full name and phone number
- Read-only email field
- Saves to `clients` table in Supabase

### Digital Wardrobe
- Garments grouped by category with collapsible sections
- Per-garment detail page: brand, color, care notes, photos
- Photo upload, edit, and delete (stored in Supabase `garment-photos` bucket)
- Add garment form with category + subcategory selection
- Delete garment with confirmation (blocked if linked to an active appointment)

### Admin Section (`/admin`)
- Appointment management page
- Order management page
- Order detail page: review items, adjust services and prices, add message to client, advance order status

---

## 2026-05 — Extended Order Flow & Treatment History

### Extended Order Status Flow
- Added `ready` and `completed` as order statuses (previously only `under_review`, `awaiting_confirmation`, `in_progress`, `cancelled`)
- Admin can mark an order as **Ready** from the order detail page (when status is `in_progress`)
- Admin can mark an order as **Completed** from the order detail page (when status is `ready`)
- Both actions require a confirmation step before saving
- All status changes are logged to a new `order_status_history` table
- A **status history timeline** is displayed at the bottom of each order detail page in admin

### Treatment History
- Admin can enter **treatment notes** per item when an order is `in_progress`
- Treatment notes are saved to the `order_items` table
- Clients can view the full **treatment history** for each garment in their wardrobe
- History is displayed on the garment detail page, filtered to completed or ready orders, sorted by most recent first

---

## Next Up

- **Chat with advisor** — chat section in Profile tab; team accesses from admin; notifications on both sides
- **Order change notifications** — team edits trigger client notification; client confirmation triggers team notification
- **Payment method** — add payment info to Profile tab; block appointment confirmation if no payment method on file
