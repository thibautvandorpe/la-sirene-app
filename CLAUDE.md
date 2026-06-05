# La Sirène App — Claude Code Briefing

> This file is read automatically by Claude Code at the start of every session.
> It contains everything Claude needs to understand the project, the codebase, and how to work with Thibaut.

---

## About the Business

**La Sirène** is a luxury, eco-friendly garment care service launching in **Beverly Hills in 2026**.
The app serves clients directly: they can book appointments, track orders, and manage their digital wardrobe.

This is an MVP — features are built one at a time so the developer (Thibaut) can understand each step before moving to the next.

---

## Token Efficiency

For any read-only or investigative task — including reading logs, searching the codebase, exploring unfamiliar files, or debugging an issue — delegate to a sub-agent rather than doing it in the main context. Only bring the relevant findings back into the main session, not the raw content.

---

## How to Work with Thibaut

- **Always show a plan before touching any file.** Describe what you will change, which files are affected, and why — then wait for explicit approval. No exceptions.
- **Explain what you're doing in plain language.** Thibaut is building an app for the first time. He understands Excel, VBA, Power BI, and basic SQL — use analogies to those tools when helpful.
- **Go one step at a time.** Do not batch multiple features or changes into one go unless explicitly asked.
- **Mark assumptions clearly.** If you're unsure about something, say `[ASSUMPTION]` rather than guessing silently.
- **Never overwrite files without asking** if the change is destructive or hard to reverse.
- **Use `sudo npm install -g`** for any global npm package installs — required on this Mac due to permissions.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Database & Auth | Supabase (PostgreSQL + Row Level Security) |
| File Storage | Supabase Storage |
| Hosting | Vercel (auto-deploys on push to main) |
| Repo | https://github.com/thibautvandorpe/la-sirene-app |
| Live URL | https://la-sirene-app.vercel.app |
| Local dev | `npm run dev` → http://localhost:3001 |

---

## Brand Identity

| Element | Value |
|---|---|
| Background | `#1c2b1e` (deep forest green) |
| Accent | `#c4b89a` (warm champagne) |
| Text | `#f5f0e8` (off-white) |
| Typography | Serif for headings, clean sans-serif for body |
| Tone | Luxury, minimal, understated |

---

## App Structure

```
src/
  app/
    (app)/              # Route group — all tabs with bottom nav
      home/             # Home tab
      orders/           # My Appointments + My Orders
      book/             # Booking flow (4 steps)
      wardrobe/         # Digital Wardrobe
      profile/          # Profile + settings
      admin/            # Admin dashboard (internal use)
    login/              # Outside (app) group — no tab bar
    signup/             # Outside (app) group — no tab bar
    auth/callback/      # Supabase email confirmation redirect
  components/
    AppHeader.tsx       # Shared header ("Hi [name]" / logo / sign in-out)
    BottomNav.tsx       # 4-tab bottom navigation bar
  lib/
    supabase.ts         # Supabase client singleton
```

---

## Database Schema (Supabase)

| Table | Key Columns |
|---|---|
| `clients` | id (FK → auth.users), full_name, email, phone, created_at |
| `appointments` | id, client_id, scheduled_at, status, delivery_method, notes, created_at |
| `orders` | id, appointment_id, client_id, status, total_price, created_at |
| `garments` | id, client_id, brand, color, notes, service_id |
| `appointment_items` | id, appointment_id, garment_id, service_id, special_instructions, estimated_price |
| `appointment_item_photos` | id, appointment_item_id (FK), url, label |
| `garment_photos` | id, garment_id (FK), url, label |
| `services` | id, category, sub_category, price |

**Storage buckets:** `appointment-photos`, `garment-photos`

**RLS:** Enabled on all tables with `dev_open_access` policies.

**Trigger:** `on_auth_user_created` — auto-inserts into `clients` when a new auth user signs up.

**Delivery method values:** `'pick_up' | 'drop_off' | 'fedex'`

---

## Booking Flow (book/page.tsx)

4 steps:
1. **Delivery Method** — Pick Up / Drop Off / FedEx (tappable cards)
2. **Date & Time** — Pick Up only; date picker + 5 tappable time slot cards. Drop Off and FedEx skip this step and show boutique address info.
3. **Items** — Add/edit/remove garments; category + subcategory card grids; wardrobe selector; photo upload
4. **Review & Quote** — Itemized list, estimated total, price disclaimer, Confirm button

Key functions: `slotToISO()` / `isoToSlot()` convert between time slot labels and ISO datetimes.

On load: reads `?appointmentId` from URL, fetches draft from Supabase, restores all state, and jumps to Step 3.

---

## Completed Features

- ✅ Full authentication flow (signup, email confirmation, login, logout)
- ✅ Supabase trigger auto-creates client profile on signup
- ✅ PWA support — installable on iPhone from Safari
- ✅ 4-tab mobile-first layout with bottom navigation
- ✅ Home tab: round white logo as hero, brand name below
- ✅ Orders tab: "Book an Appointment" button fixed above tab bar
- ✅ Protected tabs show sign-in prompt when logged out
- ✅ Branded signup/login pages (dark green, champagne, serif)
- ✅ Orders tab: My Appointments (draft/pending/confirmed/cancelled + actions)
- ✅ Orders tab: My Orders (business-created, status badges)
- ✅ Full booking flow (Steps 1–4) including photo upload per item
- ✅ Draft booking saved to Supabase and restored from Orders tab
- ✅ Profile tab: editable full name and phone; read-only email
- ✅ Digital Wardrobe: garments by category, collapsible, photo upload/edit/delete
- ✅ Admin section: /admin with appointment and order management

---

## Next Features to Build (in order)

Work through these **one at a time**. Do not start the next until Thibaut confirms the current one is complete and understood.

1. ✅ **Treatment history** — Past treatments displayed per garment in the wardrobe. Team enters treatment notes in admin when order is in progress. Visible in garment detail page.
2. ✅ **Chat with advisor** — Chat section in Profile tab (Phase 1). Real-time messaging via Supabase Realtime. Team accesses from admin Conversations section. Push notifications deferred to Phase 2.
3. ✅ **Order change notifications** — Team advances order to "awaiting confirmation" + client receives in-app notification. Client reviews order details, confirms (returns to "under review") or chats with team. Notification center (bell icon) and email toggle built. Email sending deferred to Phase 2.
4. ✅ **Extended order status flow** — "Ready" and "Completed" statuses added. Team sets from admin order detail page. Status history timeline shown on each order.
5. **Payment method** — Pending CleanCloud API investigation. If no API, use Stripe: card on file in Profile tab, automatic charge when order is marked Completed, order marked Paid via webhook.
6. **Push notifications (Phase 2)** — PWA Web Push for chat messages and order status changes. Requires user to install app from Safari first. Will be replaced by full native push when app is wrapped with Capacitor.
7. **Capacitor wrap** — Convert PWA to native iOS + Android app for App Store and Google Play submission. Unlocks full native push notifications without caveats.

---

## Changelog

A human-readable log of all changes is maintained at `docs/CHANGELOG.md`.

**After completing any feature or set of changes, append a dated entry to `docs/CHANGELOG.md`** describing in plain English what was built or modified. Use the existing format: date as a heading, short bullet points per change. Do this before pushing to GitHub.

---

## Key Decisions Already Made

- Mobile-first design (PWA, not native app)
- Supabase for database + auth (not Firebase or custom backend)
- Next.js App Router (not Pages Router)
- Vercel for hosting (connected to GitHub, auto-deploy on push)
- No third-party booking widget — custom-built booking flow
- Bottom tab bar with 4 tabs: Home, Orders, Wardrobe, Profile
