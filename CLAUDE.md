# La Sirène App — Claude Code Briefing

> Read automatically at the start of every Claude Code session.
> Last verified against the codebase and the live Supabase schema: 2026-10-09.

---

## About the Business

**La Sirène** is a luxury, eco-friendly garment care service launching in
**Beverly Hills in 2026**. The app serves clients directly: they book
appointments, track orders, chat with an advisor, and manage a digital
wardrobe.

This is an MVP. Features are built one at a time so Thibaut can understand
each step before moving to the next.

---

## Token Efficiency

For any read-only or investigative task — reading logs, searching the
codebase, exploring unfamiliar files, debugging — delegate to a sub-agent
rather than working in the main context. Bring back findings, not raw file
contents.

---

## How to Work with Thibaut

- **Always show a plan before touching any file.** Say what will change,
  which files, and why — then wait for explicit approval. No exceptions.
- **Explain in plain language.** Thibaut is building an app for the first
  time. He knows Excel, VBA, Power BI and basic SQL — use analogies to
  those when it helps.
- **One step at a time.** Do not batch multiple features into one go
  unless asked.
- **Mark assumptions.** Write `[ASSUMPTION]` rather than guessing silently.
- **Validate on ONE small file before sweeping the codebase.** A 25-file
  mechanical colour sweep broke the app in August 2026. Doing one
  representative file first surfaces the exceptions before they multiply.
- **Never overwrite files without asking** if the change is destructive.
- **Use `sudo npm install -g`** for global npm installs — required on this
  Mac due to permissions.
- **Comment every terminal command** with a plain-language `#` note, and
  say what the expected result looks like.
- **Run `npx tsc --noEmit` before every push.** `npm run dev` type-checks
  lazily, file by file, as routes are visited — so a type error can sit in
  a file that was never reloaded in the browser and only surface as a
  failed Vercel build. `npx tsc --noEmit` runs the same full check that
  `next build` does, in a few seconds.
- **Planning-side prompts are bug reports or specs.** They describe the
  problem, where it is, and the constraints — Claude owns the
  investigation and the fix design, and always proposes before editing.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 14.2 (App Router, TypeScript) |
| Styling | Tailwind CSS 3.4 |
| Database & Auth | Supabase (PostgreSQL + Row Level Security) |
| File Storage | Supabase Storage |
| Transactional email | Resend (`src/lib/sendEmail.ts`) |
| POS / source of truth | CleanCloud (US sandbox, Grow plan) |
| PWA | `@ducanh2912/next-pwa` |
| Hosting | Vercel (auto-deploys on push to main) |
| Repo | https://github.com/thibautvandorpe/la-sirene-app |
| Live URL | https://la-sirene-app.vercel.app |
| Local dev | `npm run dev` → http://localhost:3000 |

**Environment variables** live in `.env.local` (never committed):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`CLEANCLOUD_API_TOKEN` (server-side only — no `NEXT_PUBLIC_` prefix; it is
a master key with no permission model), `RESEND_API_KEY`.

---

## Brand Identity — "Light Blush"

The earlier forest-green / champagne palette is **retired**. Do not
reintroduce `#1c2b1e`, `#f5f0e8` or `#c4b89a` anywhere.

| Element | Value | Use |
|---|---|---|
| Blush paper | `#F8F0ED` | Page background. Never a dark ground. |
| Ink navy | `#141B45` | Body type |
| Blush | `#DBA69D` | The single action colour — every filled/tappable surface |
| Lapis | `#2F45A8` | Links and the active tab label. **Type only, never a fill.** |
| Brass | `#9A7532` | Hairlines, kickers, prices, the logo tint |

Design rules that generalise to every screen:

1. **The arch.** Top-arched rectangle wherever an image appears. Radius is
   `9999px 9999px 4px 4px` — CSS clamps it to exactly half the width at any
   size.
2. **Hairlines, not cards.** No shadows, no rounded cards. Square corners
   except arches and 2px pills.
3. **No traffic-light status badges.**
4. **Generous whitespace**, 22px gutters.
5. **Fonts: Geist** (the typography swap to Bodoni Moda / Archivo was
   considered and dropped — do not re-propose it).
6. **Kickers**: 9px, `.38em` letter-spacing, uppercase, brass.

**Deliberate exception — do not "fix" it:** in `AppHeader.tsx` the client's
name renders in brass, matching the kicker above it. Thibaut compared this
against ink navy and chose brass.

**Logo:** `public/logo.png` is pure white on transparent, so it is tinted
brass with a CSS mask rather than a recoloured asset:

```jsx
<div style={{
  width: '96px', height: '96px',
  backgroundColor: '#9A7532',
  WebkitMask: 'url(/logo.png) center / contain no-repeat',
  mask: 'url(/logo.png) center / contain no-repeat',
}} />
```

Sizes: home 140, login 96, signup 100, AppHeader 36. `public/wordmark.png`
gets the same treatment on login at 180×49. **Exception:** in the home hero
the wordmark sits on a dark photo, so it is a plain white `<img>` at 206px,
not masked.

---

## Known Traps

1. **Tailwind cannot apply opacity to a CSS variable.** `text-[#9A7532]/60`
   compiles correctly. `text-[var(--brass)]/60` compiles to **nothing at
   all** — no error, no warning, the class is silently dropped. Tailwind
   needs raw colour channels to compute the alpha and cannot decompose a
   `var()`. **Therefore this codebase uses plain hex literals, not CSS
   variables, for colour.** Do not "improve" it by converting to tokens.
   If tokens ever become necessary, store space-separated channels
   (`--ink-rgb: 20 27 69`) and register them in `tailwind.config.ts` with
   `<alpha-value>`, then use named classes only.
2. **An absence is not always an absence.** `null === null` is `true` in
   JS, so a null key must never match another null, both in lookups and
   when joining results (use keyed Maps filled only from non-null keys).
   Distinguish "returned nothing" from "failed": destructure `{ error }`
   as well as `{ data }`, and on failure stop and flag, never proceed to
   create. Some CleanCloud endpoints report zero results as an `Error`
   field (`getCustomer`: "No Customer With That ID").
3. **Dates: `new Date('yyyy-mm-dd')` is UTC midnight**, but `getDate()`
   and the other local getters read local time, which shifts the date by
   one day in New York and LA. Keep calendar-date arithmetic and
   formatting in UTC (`toISOString().slice(0,10)`, `setUTCDate`). Test
   date logic under `TZ=America/New_York` and `TZ=America/Los_Angeles`.
4. **Drop Off and FedEx appointments have `scheduled_at = null`** (no
   slot). Any screen reading `scheduled_at` must check it first. Fixed in
   `orders/[id]` on 2026-10-09; every other screen already checks.
5. **RLS: `cleancloud_customers` and `cleancloud_sweep_state` have RLS
   ENABLED WITH NO POLICIES on purpose** (a full copy of the POS customer
   list must not be readable with the anon key). A browser read returns
   an empty array, not an error. Read them only from server routes using
   the service role key. Do not "fix" them to match the `dev_open_access`
   tables.
6. **PWA:** if the app suddenly renders as unstyled text on localhost, a
   stale service worker from an old `npm run build && npm start` is
   serving cached HTML. Check in Incognito first. Fix: DevTools →
   Application → Service Workers → Unregister, then Clear site data.

---

## App Structure

```
src/
  app/
    layout.tsx              # Root layout, fonts, PWA metadata
    (app)/                  # Route group — everything with the bottom nav
      layout.tsx            # Server Component; constrains app to 430px centred
      page.tsx              # HOME tab (there is no /home folder)
      orders/
        page.tsx            # My Appointments + My Orders
        [id]/page.tsx       # Appointment detail
        order/[id]/page.tsx # Order detail + status timeline
      book/page.tsx         # Booking flow (4 steps)
      wardrobe/
        page.tsx
        [category]/page.tsx
        [category]/[subcategory]/page.tsx
        [category]/[subcategory]/[garmentId]/page.tsx
      profile/
        page.tsx            # Profile, settings, email toggle
        chat/page.tsx       # Chat with advisor (Supabase Realtime)
      notifications/page.tsx # Notification centre (bell icon)
    admin/                  # OUTSIDE (app) — full width, no tab bar
      page.tsx
      appointments/page.tsx + [id]/page.tsx
      orders/page.tsx + [id]/page.tsx
      conversations/page.tsx + [clientId]/page.tsx
      matching/page.tsx     # Raw JSON probe for the matching queue, not yet a designed UI
    api/
      cleancloud/customer/route.ts   # POST — links a client to a CleanCloud customer
      cleancloud/backfill/route.ts   # dev-only, sequential backfill
      cleancloud/test/route.ts       # dev-only diagnostics
      cleancloud/customer-probe/route.ts  # dev-only, getCustomer diagnostics
      cleancloud/match-preview/route.ts   # dev-only dry-run of matching for every client
      cleancloud/normalize-test/route.ts  # dev-only, tests lib/phone.ts
      cleancloud/sweep/route.ts           # dev-only, builds the cleancloud_customers index
      admin/matching-queue/route.ts       # Bearer + role==='admin', production — serves /admin/matching
      notify/route.ts                # Resend email dispatch
    login/  signup/  auth/callback/  # Outside (app) — no tab bar
  components/
    AppHeader.tsx           # "Hi [name]" / logo / sign in-out
    BottomNav.tsx           # 4 tabs; position:fixed, so it carries its own
                            #   430px constraint separately from the layout
    CleanCloudSync.tsx      # Renders null; retries customer linking on app
                            #   load, swallows all errors
  lib/
    supabase.ts             # Supabase client singleton
    cleancloud.ts           # CleanCloud API helper (rate-limited to 3/sec)
    cleancloudCustomer.ts   # ensureCleanCloudCustomer(clientId) — 5-branch
                            #   match/create logic, dry-run mode
    phone.ts                # normalizePhone / normalizeEmail — ambiguous
                            #   input always returns null, never guessed
    sendEmail.ts            # Resend wrapper
```

Routes under `api/admin/` serve admin screens: Bearer token +
`role === 'admin'` check, server-side, always production — not dev-only
like the diagnostic routes under `api/cleancloud/` (`customer/` and
`notify/` excepted), which are guarded by `NODE_ENV`.

`src/app/dashboard/page.tsx` is leftover early-tutorial code, unstyled and
unreachable from the app. Ignore it; do not extend it.

---

## Booking Flow (`src/app/(app)/book/page.tsx`)

Four steps:

1. **Delivery Method** — Pick Up / Drop Off / FedEx, as tappable cards.
2. **Date & Time** — **Pick Up only.** Date picker plus 5 tappable time-slot
   cards. Drop Off and FedEx skip this step entirely and show boutique
   address information instead.
3. **Items** — add / edit / remove garments; category and subcategory card
   grids; wardrobe selector; photo upload per item.
4. **Review & Quote** — itemised list, estimated total, price disclaimer,
   Confirm button.

**POC, not final.** Step 2's 5 hardcoded slots and Step 4's estimated
prices are invented locally — this whole flow is placeholder behaviour.
The MVP rework (real CleanCloud slots, a ZIP-allowlist serviceability
check, no client-facing prices) is scoped under Roadmap item 2, because
`addOrder` is where the pickup slot is actually sent. See Product & Scope
Decisions below for why prices are leaving Step 4 entirely.

Key helpers: `slotToISO()` and `isoToSlot()` convert between time-slot
labels and ISO datetimes.

**Draft restore:** on load the page reads `?appointmentId` from the URL,
fetches the draft appointment from Supabase, restores all state, and jumps
directly to Step 3. This is how the "resume booking" action in the Orders
tab works.

---

## Database Schema (Supabase) — verified against the live database

| Table | Columns |
|---|---|
| `clients` | id (uuid, FK → auth.users), full_name, email, phone (nullable), **role** (text, NOT NULL), email_notifications_enabled, cleancloud_customer_id, cleancloud_link_status, cleancloud_link_checked_at, created_at |
| `appointments` | id, client_id, scheduled_at, status, delivery_method, notes, created_at |
| `appointment_items` | id, appointment_id, garment_id, service_id, special_instructions, estimated_price, created_at |
| `appointment_item_photos` | id, appointment_item_id, url, label, created_at |
| `orders` | id, appointment_id, client_id, status, total_price, delivery_method, scheduled_at, notes, **admin_message**, created_at |
| `order_items` | id, order_id, garment_id, service_id, special_instructions, final_price, reviewed_service_id, reviewed_price, treatment_notes, created_at |
| `order_item_photos` | id, order_item_id, url, label, created_at |
| `order_status_history` | id, order_id, status, changed_at |
| `garments` | id, client_id, brand, color, notes, service_id, created_at |
| `garment_photos` | id, garment_id, url, label, created_at |
| `services` | id, category, sub_category, price |
| `chat_messages` | id, client_id, sender ('client' \| 'team'), **content**, read_at, created_at |
| `notifications` | id, client_id, type, title, body, order_id, read_at, created_at |
| `cleancloud_customers` | cleancloud_customer_id (text, PK), full_name, phone_raw, phone_e164, email, is_active (bool, NOT NULL), last_synced_at (NOT NULL), created_at (NOT NULL) |
| `cleancloud_sweep_state` | id (int), swept_from, swept_through (date bookmark), last_run_at, notes |

**Storage buckets:** `appointment-photos`, `garment-photos`

**`clients.role` is the authorisation gate.** Every `/admin` page reads it
and redirects unless it is `'admin'`; `login/page.tsx` uses it to route
admins to `/admin`. It is also the correct flag for excluding staff
accounts from any CleanCloud sync — **no separate `is_staff` column is
needed or should be added.** Always target the admin row by role, never
by email or phone.

**Note the column names** — chat messages use `content` (not `body`) while
notifications use `body`. Order line items carry both `final_price` and
`reviewed_price`. `clients.cleancloud_link_status` is free text, not an
enum (e.g. `linked:phone_and_email`, `needs_review:ambiguous_phone`,
`created`) — see Customer Matching below.

**RLS:** enabled on all tables with `dev_open_access` policies.
These are permissive development policies and must be replaced with real
per-user policies before launch. Treat this as an open launch item.
**Exception:** `cleancloud_customers` and `cleancloud_sweep_state` have
RLS enabled with no policies at all — see Known Traps.

**Delivery methods:** `'pick_up' | 'drop_off' | 'fedex'`

**Appointment statuses:** `draft | pending | confirmed | cancelled`

**Order statuses:** `under_review | awaiting_confirmation | in_progress |
ready | completed | cancelled`

`clients.cleancloud_customer_id` is text, nullable, with a partial unique
index where not null. It is the single link between Supabase and the POS.
`services` has no CleanCloud product mapping yet — that arrives with the
catalogue sync (for `addOrder` line items, not client-facing quotes).

---

## CleanCloud Integration — the "mirror model"

CleanCloud is the **source of truth** for customers, catalogue, prices,
orders and payments. Supabase is a **synced mirror** plus the home of
everything CleanCloud cannot hold (auth, wardrobe photos, chat,
notifications, and now a local phone/email index for customer matching —
see below).

API contract, identical for every endpoint: POST to
`https://cleancloudapp.com/api/<endpoint>`, `Content-Type: application/json`,
body containing `api_token` plus endpoint fields. Docs are at
`https://cleancloudapp.com/api`.

Traps, all found the hard way:

1. **Errors arrive with HTTP 200** and an `Error` field in the body. The
   helper in `cleancloud.ts` treats an `Error` field as a failure. Some
   lookups report zero results the same way instead of an empty array
   (`getCustomer`: "No Customer With That ID").
2. **Every value is a string**, including numeric IDs and prices
   (`"price":"360.00"`). Parse before arithmetic.
3. **IDs can be `0`.** The Default price list is `id: 0`, so a truthiness
   check (`if (id)`) silently skips it. Use `!= null`. This bug is still
   live in the diagnostic route — `extractedPriceListIds` returns `[]`.
4. **Never send `priceListID: ""`** — it filters to a non-existent list and
   returns `count: 0` with `Success: True`, indistinguishable from an empty
   catalogue. Omit the parameter to get everything.
5. **3 requests/second** is enforced. The helper spaces requests.
6. **Email is unique in CleanCloud, including across deactivated
   customers.** `addCustomer` rejects duplicates. Phone is unique only
   among *active* customers. Never use a real email address for a test
   signup — it is consumed permanently.
7. **Products are read-only via the API.** The catalogue was loaded via an
   undocumented CSV import at `https://cleancloudapp.com/import`.
8. **`addCustomer` is sent the raw phone, not the normalized E.164 form.**
   Normalization is only for our own matching index — CleanCloud keeps
   whatever formatting the client typed.

**Route handlers that read live state must opt out of caching.** A GET
handler with no `request` parameter has no dynamic input, so Next caches
it — and the Supabase client runs over fetch, which the Data Cache also
intercepts. A diagnostic route that reports history instead of live state
is worse than no diagnostic. Any handler reading Supabase or CleanCloud
needs:

    export const dynamic = 'force-dynamic'
    export const fetchCache = 'force-no-store'

Routes taking `req: NextRequest` are already dynamic. Pure-computation
routes (e.g. normalize-test) do not need it.

Catalogue: 42 products across 4 sections. Section IDs are **not
alphabetical**: `1 = Full Body`, `2 = Lower Body`, `3 = Upper Body`,
`4 = Handbags and Shoes`, `5 = Alterations and Repairs` (empty).

### Customer Matching

Phone (not email) is the identity key; email only confirms a match. Both
normalize through `src/lib/phone.ts`: a number with a leading `+` and
8–15 digits is accepted as international; an 11-digit number starting
with `1`, or a 10-digit number whose first digit is 2–9, is treated as
US; anything else becomes `null` and is reviewed, never guessed, because
a wrong E.164 guess would silently mislink a customer.

`ensureCleanCloudCustomer` (`src/lib/cleancloudCustomer.ts`) resolves one
of `existing` / `linked` / `created` / `skipped` / `needs_review`, by
looking up the `cleancloud_customers` mirror by phone, then by email if
phone doesn't resolve. A lookup error always becomes `needs_review`,
never a fallback to create; a phone match whose email differs also
becomes `needs_review`, never an auto-create. `dryRun` (used by
`match-preview`) never writes anywhere. `role === 'admin'` clients are
always skipped — staff never reach the POS.

Matcher lookups only consider active customers (`is_active = true`) — it
must never link to a deactivated one. The review queue's suggestions
ignoring `is_active` is the deliberate opposite; do not "align" the two.

The mirror (`cleancloud_customers` + `cleancloud_sweep_state`) is built by
**sweeping** `getCustomer` on a date bookmark (`sweep/route.ts`), not by a
webhook — a webhook needs a public URL the app doesn't have yet.
**Interim rule: until that webhook exists, re-run the sweep after adding
any customer directly in CleanCloud**, or the matcher can't see them and
may create a duplicate.

The admin review queue (`/api/admin/matching-queue`, rendered for now as a
raw JSON dump at `/admin/matching`) splits clients into two sections:
"needs action" and "informational". Informational rows must never offer a
link action — suggestions there are context only — and suggestions
deliberately do not filter `is_active`, so staff can see a match against
a deactivated customer too.

**Status:** index + sweep done (Step 1/2a/2b), matching logic + dry-run
preview done (4a, verified), admin matching-queue API done and verified
live (4b-i; the UI at `/admin/matching` is still a temporary JSON dump).
Next, in order: 4b-ii a real queue UI → 4b-iii link / re-check actions →
4c a proper US-default phone input (remove the French placeholder) →
Step 3, the customer webhook, last (it needs a public URL).

---

## Completed Features

- ✅ Auth: signup, email confirmation, login, logout; Supabase trigger
  auto-creates the client profile
- ✅ PWA — installable on iPhone from Safari
- ✅ 4-tab mobile-first layout, 430px centred, bottom navigation
- ✅ Home tab with arched photo hero and white wordmark
- ✅ Orders tab: My Appointments and My Orders
- ✅ Full booking flow (Steps 1–4) with photo upload per item
- ✅ Draft booking saved to Supabase and restored from the Orders tab
- ✅ Profile tab: editable name and phone, read-only email
- ✅ Digital Wardrobe: garments by category, collapsible, photo CRUD
- ✅ Admin: appointment, order and conversation management, gated on
  `clients.role`
- ✅ Treatment history per garment
- ✅ Chat with advisor (Supabase Realtime), admin Conversations view
- ✅ Order change notifications: bell icon, notification centre, Resend email
- ✅ Extended order status flow with a status-history timeline
- ✅ Light Blush palette applied to every screen, PWA manifest and email
  template
- ✅ CleanCloud connected; 42-product catalogue live in the sandbox
- ✅ CleanCloud customer linking — `cleancloud_customer_id` populated for
  all existing clients
- ✅ CleanCloud customer matching — phone/email index + sweep, 5-branch
  matching logic with dry-run preview, and an admin matching-queue API
  (role-gated; the review UI is still a JSON probe)

---

## Product & Scope Decisions (Sept–Oct 2026 planning)

- **MVP filter:** a feature is MUST HAVE only if (a) it removes a major
  operational burden for the team, or (b) its absence stops the client
  from using the service. Everything else is nice-to-have.
- **~80% of volume is expected from Pick Up & delivery.** That is the
  spine of the app; Drop Off is the variant.
- **POC vs MVP:** what exists today is a POC. Its slots, prices and
  statuses are invented locally. The MVP is the same app wired to
  CleanCloud. Two existing features need REWORK, not extension: the
  booking Date & Time step and the Step 4 quote screen (Roadmap item 2).
- **NO PRICES IN THE CLIENT JOURNEY.** The workshop prices after seeing
  the garment. The brief's "pre-intake and instant quotation" is now
  "pre-intake only". The current Step 4 "Review & Quote" with estimated
  prices is POC behaviour to be removed, not extended. The client never
  chooses a service level. The pricing mechanism is otherwise PARKED.
- **Pre-intake is OPTIONAL:** one free-text field plus an optional photo,
  never a structured form. Capture only what the workshop cannot see
  (the cause or age of a stain, what was already tried) — item type,
  count and the stain's existence are already captured at intake anyway.
- **CleanCloud owns logistics:** routes, zones, slots, capacity, and the
  driver's day (CleanCloud Driver app). Never build our own slot picker;
  slots come from `getDates` / `getSlots`. Serviceability for MVP = a
  hardcoded ZIP allowlist (no geocoder yet). Out of zone → invite
  boutique drop-off and capture the address on a waitlist.
- **Addresses and access instructions must live in CleanCloud**, because
  the driver only sees CleanCloud. Whether `addOrder` can carry a
  per-order address is UNVERIFIED (open question to CleanCloud) — do not
  design anything that depends on it.
- **Never design a step that assumes the client is present at pickup**
  (housekeeper, doorman, or nobody).
- **Repeat bookings:** prefill from the last order is MUST HAVE; a
  separate express flow is nice-to-have.
- **Mail-in is NOT MVP.**

---

## Open Questions Blocking Work

For CleanCloud (Ric):
- Can our app capture a card via CleanCloud Pay?
- Can webhooks be signed?
- Is there a customer lookup by phone or email?
- Can an order carry its own pickup/delivery address, and does the
  Driver app show it?
- Can access instructions be set per order?
- Does a heat-seal ID persist across orders? (It would solve permanent
  garment identity for the wardrobe.)

Other:
- The approval threshold for expert-set prices is not set.
- Which CleanCloud price list is authoritative: Default (`id 0`) or
  "La Sirene Test" (`id 21448`)?

---

## Roadmap — work through these one at a time

**0. Finish customer matching.** See Customer Matching above for the
exact next steps (4b-ii queue UI → 4b-iii link/re-check actions → 4c
phone input → Step 3 webhook, last). A reliable customer ID is a
dependency for orders and payments, so this stays first.

1. **Catalogue sync** — pull `getProducts` / `getPriceLists` into the
   `services` table for `addOrder` line items, not client quotes (prices
   are never shown to the client — see Product & Scope Decisions).
2. **Orders + webhooks, including the booking rework** — booking confirm
   → `addOrder` → store `cleancloud_order_id`. This is also where the
   Step 2 / Step 4 POC behaviour gets replaced, because `addOrder` is
   where the pickup slot is actually sent: real slots from `getDates` /
   `getSlots` instead of the hardcoded 5, a ZIP-allowlist serviceability
   check (out of zone → boutique drop-off + waitlist), and the Step 4
   price screen removed entirely. Webhook receiver at
   `/api/cleancloud/webhook` for order.created / order.status_changed /
   order.deleted. The existing notification and Resend code fires off
   webhook events instead of admin actions. Reconciliation sweep via
   `getOrders` with `updatedSecondsAgoFrom`.
3. **Payments — CleanCloud Pay via the API.** Stripe was evaluated and
   dropped. Card saved in Profile via `addCard`; charge on completion via
   `cardCharge`. A `payment_type` field (`'online' | 'in_boutique'`)
   prevents double-charging. **Currently blocked** — see Open Questions.
4. **RLS hardening** — replace the `dev_open_access` policies with real
   per-user policies. Required before launch.
5. **Push notifications (PWA Web Push)** — post-MVP.
6. **Capacitor wrap** → native iOS + Android — post-MVP.

---

## Changelog

A human-readable log lives at `Docs/CHANGELOG.md`.

**After completing any feature or set of changes, append a dated entry**
describing in plain English what was built. Use the existing format: date
as a heading, short bullets. Do this before pushing to GitHub.

---

## Key Decisions Already Made — do not re-propose

- Mobile-first PWA, not a native app (Capacitor comes later)
- Supabase for database + auth (not Firebase, not a custom backend)
- Next.js App Router (not Pages Router)
- Vercel hosting, auto-deploy from GitHub
- Custom-built booking flow, no third-party booking widget
- Bottom tab bar with 4 tabs: Home, Orders, Wardrobe, Profile
- CleanCloud is the source of truth; Supabase mirrors it
- CleanCloud Pay for payments; **Stripe is dropped**
- **Phone, not email, is the CleanCloud customer matching key**
- `clients.role` is the staff/admin flag — do not add `is_staff`
- Plain hex colours, **not** CSS variables (see Known Traps above)
- **Geist** typography — the Bodoni Moda / Archivo swap was rejected
- MVP scope rules (no client-facing prices, CleanCloud owns slots/zones,
  mail-in out) — see Product & Scope Decisions above
