# La Sirène App — Claude Code Briefing

> Read automatically at the start of every Claude Code session.
> Last verified against the codebase and the live Supabase schema: 2026-08-31.

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

## ⚠️ Known Trap — Tailwind cannot apply opacity to a CSS variable

`text-[#9A7532]/60` compiles correctly. `text-[var(--brass)]/60` compiles
to **nothing at all** — no error, no warning, the class is silently
dropped. Tailwind needs raw colour channels to compute the alpha and cannot
decompose a `var()`.

**Therefore this codebase uses plain hex literals, not CSS variables, for
colour.** Do not "improve" it by converting to tokens. If tokens ever
become necessary, store space-separated channels (`--ink-rgb: 20 27 69`)
and register them in `tailwind.config.ts` with `<alpha-value>`, then use
named classes only.

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
    api/
      cleancloud/customer/route.ts   # POST — links a client to a CleanCloud customer
      cleancloud/backfill/route.ts   # dev-only, sequential backfill
      cleancloud/test/route.ts       # dev-only diagnostics
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
    cleancloudCustomer.ts   # ensureCleanCloudCustomer(clientId), idempotent
    sendEmail.ts            # Resend wrapper
```

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
| `clients` | id (uuid, FK → auth.users), full_name, email, phone (nullable), **role** (text, NOT NULL), email_notifications_enabled, cleancloud_customer_id, created_at |
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

**Storage buckets:** `appointment-photos`, `garment-photos`

**`clients.role` is the authorisation gate.** Every `/admin` page reads it
and redirects unless it is `'admin'`; `login/page.tsx` uses it to route
admins to `/admin`. It is also the correct flag for excluding staff
accounts from any CleanCloud sync — **no separate `is_staff` column is
needed or should be added.**

**Note the column names** — chat messages use `content` (not `body`) while
notifications use `body`. Order line items carry both `final_price` and
`reviewed_price`.

**RLS:** enabled on all tables with `dev_open_access` policies.
These are permissive development policies and must be replaced with real
per-user policies before launch. Treat this as an open launch item.

**Delivery methods:** `'pick_up' | 'drop_off' | 'fedex'`

**Appointment statuses:** `draft | pending | confirmed | cancelled`

**Order statuses:** `under_review | awaiting_confirmation | in_progress |
ready | completed | cancelled`

`clients.cleancloud_customer_id` is text, nullable, with a partial unique
index where not null. It is the single link between Supabase and the POS.
`services` has no CleanCloud product mapping yet — that arrives with the
catalogue sync.

---

## CleanCloud Integration — the "mirror model"

CleanCloud is the **source of truth** for customers, catalogue, prices,
orders and payments. Supabase is a **synced mirror** plus the home of
everything CleanCloud cannot hold (auth, wardrobe photos, chat,
notifications).

API contract, identical for every endpoint: POST to
`https://cleancloudapp.com/api/<endpoint>`, `Content-Type: application/json`,
body containing `api_token` plus endpoint fields. Docs are at
`https://cleancloudapp.com/api`.

Traps, all found the hard way:

1. **Errors arrive with HTTP 200** and an `Error` field in the body. The
   helper in `cleancloud.ts` treats an `Error` field as a failure.
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
   among *active* customers.
7. **Products are read-only via the API.** The catalogue was loaded via an
   undocumented CSV import at `https://cleancloudapp.com/import`.

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

---

## Roadmap — work through these one at a time

**NEXT: customer matching.** Phone (not email) is the identity key. Needs a
webhook-fed Supabase index of CleanCloud customers, canonical E.164 phone
normalisation, and `ensureCleanCloudCustomer` skipping `role = 'admin'` so
staff accounts stop reaching the POS. Phase 3 depends on a reliable
customerID, so this comes first.

1. **Catalogue sync** — pull `getProducts` / `getPriceLists` into the
   `services` table so booking quotes use real POS prices.
2. **Orders + webhooks** — booking confirm → `addOrder` → store
   `cleancloud_order_id`. Webhook receiver at `/api/cleancloud/webhook` for
   order.created / order.status_changed / order.deleted. The existing
   notification and Resend code fires off webhook events instead of admin
   actions. Reconciliation sweep via `getOrders` with
   `updatedSecondsAgoFrom`.
3. **Payments — CleanCloud Pay via the API.** Stripe was evaluated and
   dropped. Card saved in Profile via `addCard`; charge on completion via
   `cardCharge`. A `payment_type` field (`'online' | 'in_boutique'`)
   prevents double-charging. **Currently blocked** on a question to
   CleanCloud about whether our own app can capture a new card.
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
- Plain hex colours, **not** CSS variables (see the Tailwind trap above)
- **Geist** typography — the Bodoni Moda / Archivo swap was rejected
