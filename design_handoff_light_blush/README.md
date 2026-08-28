# Handoff: La Sirène — Light Blush redesign (Home, Orders, Order detail)

## Overview
A visual redesign of the La Sirène client app (`thibautvandorpe/la-sirene-app`, Next.js 14 + Tailwind + Supabase), derived from the Beverly Drive boutique renderings. It replaces the current forest-green / champagne identity with the boutique's real materials: blush terrazzo ground, ink-blue type, brass hairlines, and the arched niche as a recurring frame.

Scope of this bundle: **Home tab, Orders tab, Order detail**. Booking, Wardrobe, Profile, auth and admin are not yet redesigned — apply the tokens below when you get to them, but do not invent new layouts for them in this pass.

## About the design files
`design/La Sirene Redesign - Light Blush.html` is a **design reference created in HTML** — a static, hi-fi mockup of three screens laid out side by side on a canvas. It is not production code. Do not copy its markup or class names into the app. Recreate the designs inside the existing Next.js App Router + Tailwind codebase, using its current components (`AppHeader`, `BottomNav`), routes and Supabase data wiring. All real data fetching, auth guards and state logic already exist in the repo and must be preserved; only presentation changes.

## Fidelity
**High fidelity.** Colors, type sizes, letterspacing, radii and spacing are final and should be matched. Copy is final where it appears; sample order data (order numbers, garment names, prices) is placeholder — keep the app's real Supabase data.

---

## Design tokens

Replace the current tokens in `src/app/globals.css`.

| Token | Value | Use |
|---|---|---|
| `--ground` | `#F8F0ED` | page background (was `#1c2b1e`) |
| `--ground-2` | `#F1E5E1` | bottom tab bar background |
| `--surface` | `#FFFFFF` | raised surfaces / boards |
| `--ink` | `#141B45` | primary text |
| `--ink-60` | `rgba(20,27,69,.60)` | body copy |
| `--ink-40` | `rgba(20,27,69,.40)` | meta / tertiary text |
| `--hairline` | `rgba(23,29,63,.13)` | list row dividers |
| `--brass` | `#9A7532` | kickers, prices, rules |
| `--brass-soft` | `rgba(154,117,50,.30)` | borders, rules, timeline spine |
| `--action` | `#DBA69D` | every filled interactive surface |
| `--action-line` | `#CF9489` | 1px border on filled buttons |
| `--action-wash` | `rgba(230,190,183,.42)` | tinted info cards |
| `--mark` | `#B97A6C` | logo mark tint |
| `--lapis` | `#2F45A8` | **text only** — links, active tab label |
| `--lapis-text` | `#2C3F9E` | "Confirmed" badge text |
| `--blush-text` | `#B45F52` | inline emphasis links on blush cards |

Retired: `#1c2b1e` (forest green), `#c4b89a` (champagne), `#f5f0e8` (off-white). No green anywhere.

**Colour rule (important):** blush `#DBA69D` carries every filled/tappable surface. Lapis appears **only as type** — never as a fill, badge background or button. Brass is line-weight, kickers and prices only.

### Radii — the arch
The recurring motif is a top-arched rectangle: `border-radius: <half-width>px <half-width>px 4px 4px`.

| Element | Size | Radius |
|---|---|---|
| Home hero | full width minus 22px gutters, height 392px | `170px 170px 4px 4px` |
| Hero inner hairline | `inset: 9px` | `158px 158px 3px 3px`, `1px solid rgba(255,255,255,.5)` |
| Service thumbnail | 84 × 112 | `42px 42px 2px 2px` |
| Order item photo | 58 × 76 | `29px 29px 2px 2px` |
| Pills / badges | — | `2px` |
| Buttons, cards, rows | — | `0` (square) |

### Typography
- **Bodoni Moda** (Google Fonts, weights 400/500) — headings, prices.
- **Archivo** (Google Fonts, weights 300/400/500) — body, labels, all uppercase micro-type.
- Replace the Geist local fonts in `src/app/layout.tsx`.

| Style | Spec |
|---|---|
| `h1` (screen title) | Bodoni Moda 400, 40px, line-height 1.02, letter-spacing .005em |
| `h2` (name / subtitle) | Bodoni Moda 400, 25px, line-height 1.12 |
| Kicker (section label) | Archivo 400, 9px, letter-spacing .38em, uppercase, brass |
| Body | Archivo 300, 13px, line-height 1.62, `--ink-60` |
| Row title | Archivo 400, 14px, `--ink` |
| Row meta | Archivo 300, 11px, `--ink-40` |
| Badge / pill | Archivo 400, 8.5px, letter-spacing .24em, uppercase, padding 5px 10px |
| Button label | Archivo 400, 10px, letter-spacing .34em, uppercase, padding 17px |
| Price | Bodoni Moda 400, 17px (24px for totals), brass |
| Tab label | Archivo 400, 8.5px, letter-spacing .22em, uppercase |

### Spacing
- Screen gutters: **22px**.
- Vertical gap between sections: **20–24px** (flex column + gap; do not use per-element margins).
- List row padding: **16px 0**, divider `1px solid var(--hairline)`.
- Tab bar: `padding: 11px 0 16px`, `border-top: 1px solid var(--brass-soft)`, plus `env(safe-area-inset-bottom)`.

---

## Screens

### 1. Home — `src/app/(app)/page.tsx`
Purpose: brand arrival, next appointment at a glance, entry to booking.

Order top to bottom:
1. **Header** (`AppHeader`) — logo mark left (34 × 34, tinted `--mark`, no circle background), right side chat + bell icons in brass `1.4px` stroke, unread counter as a 15px blush circle with ink numerals. Sign-in/out link keeps its current behaviour but restyled brass.
2. **Hero** — arched photo, 22px gutters, 392px tall. Photo `object-fit: cover`, `object-position: 52% 46%`, `filter: saturate(.92)`. Over it: a downward veil `linear-gradient(180deg, rgba(20,27,69,0) 0%, rgba(20,27,69,.06) 44%, rgba(20,27,69,.62) 100%)`, the inner white hairline arch, and bottom-aligned (30px from bottom, centred) the **white wordmark PNG at 206px wide** with the tagline "The Spa for your Clothes" below it (10px, .3em, uppercase, `rgba(255,255,255,.82)`).
3. **Greeting** — kicker "Welcome back" + `h2` with the client's `full_name` (first name).
4. **Next appointment card** — 1px `--brass-soft` border, `--action-wash` background, padding 16px 18px. Left: delivery method + date (13px), then time slot + item count (11px, `--ink-40`). Right: status badge.
5. **Primary button** — "Book an appointment", full width, `--action` fill, `--action-line` border, ink label. Links to `/book`.
6. Brass rule.
7. **Our Services** — kicker, then two rows: 84 × 112 arched thumbnail + title (12px, .2em, uppercase) + body copy. Copy is the existing repo copy, shortened:
   - "Expert Garment Care" — *Meticulous cleaning, restoration, and alteration by artisans who treat each piece as a singular creation.*
   - "Digital Wardrobe" — *Your personal inventory, enriched with a complete care history for every garment you own.*
8. Brass rule.
9. **The Boutique** — muted kicker + Bodoni 16px address: "401 N. Beverly Drive / Beverly Hills, California".
10. Bottom tab bar.

### 2. Orders — `src/app/(app)/orders/page.tsx`
Purpose: appointments and orders in one list; entry to booking.

1. Header, then `h1` "Orders".
2. **Segmented control** — two equal cells inside a 1px `--brass-soft` box; labels 9px, .26em, uppercase. Active cell: `--action` fill, ink label, weight 500. Inactive: `--ink-40`. (Replaces the current two stacked sections; keep both data queries, filter by segment.)
3. **My Appointments** — kicker, then rows. Each row: title = delivery method (`Pick Up` / `Drop Off` / `FedEx`), meta = date + time slot (pick-up only) or boutique address (drop-off) / label state (FedEx), status badge, item count. Right side actions, 11px: `View` for pending/confirmed, `Continue` + `Delete` for drafts (`Delete` in `--ink-40`). Keep the existing inline confirm-before-delete/cancel flow.
4. **My Orders** — kicker, then rows: title = delivery method + created date, status badge, meta = `Order No. <id>` + item count, right side price in brass Bodoni 17px. Completed orders show the price in `--ink-40`. Orders needing attention (`awaiting_confirmation`) get a **2px `--action` left border** and 14px left padding; all others 16px left padding to stay aligned.
5. **Sticky "Book an appointment"** button above the tab bar, with a `linear-gradient(180deg, rgba(248,240,237,0), var(--ground) 40%)` fade behind it. Position: `bottom: calc(59px + env(safe-area-inset-bottom))`.
6. Bottom tab bar.

### 3. Order detail — `src/app/(app)/orders/order/[id]/page.tsx` (and the appointment variant at `orders/[id]`)
Purpose: review the quote, confirm or ask a question. **No tab bar** (matches current behaviour).

1. Header: brass back arrow left, 28px logo mark right.
2. **Title block** — kicker "Order No. 1042", `h1` two lines (delivery method / date), status badge below.
3. **Message card** — `--action-wash` on brass hairline, column layout: revision note (12.5px, weight 300, line-height 1.6) then a link "Chat with your advisor →" (`--lapis`). Show only when the order is `awaiting_confirmation`; source the text from the team's note.
4. **Progress timeline** — kicker "Progress", then a 22px marker column + content column, 14px gap. Completed steps: 7px brass dot; future steps: 7px circle outlined `rgba(23,29,63,.28)`, label in `--ink-40`. A 1px `--brass-soft` spine connects markers (suppressed on the last item). Step label 12.5px, timestamp 10px `--ink-40`. Steps map to the repo's status history: received → under review → awaiting confirmation → in progress → ready.
5. **Items** — kicker, then rows: 58 × 76 arched photo (first `appointment_item_photos` / `garment_photos` url; when absent, an `--ink`-tinted 6% block reading "PHOTO"), garment name 13.5px, `brand · color` 11px `--ink-40`, `special_instructions` in 11px italic quotes, price right in brass Bodoni 15px or `TBD` when 0.
6. **Revised Total** — kicker + Bodoni 24px brass, divided above and below by `--brass-soft`.
7. **Disclaimer**, verbatim: *Prices shown are estimates based on your selections. The final invoice will be confirmed by our team after inspection of your garments.*
8. **Actions** — "Confirm the quote" (`--action` filled) and "Ask a question" (ghost: transparent, 1px `--brass-soft`, brass label), 10px gap.

### Bottom tab bar — `src/components/BottomNav.tsx`
Four tabs, existing icons and routes unchanged (Home / Orders / Wardrobe / Profile). Background `--ground-2`, top border `--brass-soft`. Inactive `rgba(23,29,63,.34)`; active label and icon `--lapis` (`#2F45A8`) — this is the one place lapis appears in the navigation, as type/stroke, not fill.

---

## Status badges
All pills: 8.5px, .24em, uppercase, 2px radius, padding 5px 10px.

| Status | Background | Text |
|---|---|---|
| Draft | `rgba(23,29,63,.07)` | `--ink-60` |
| Pending / Awaiting Confirmation | `rgba(219,166,157,.45)` | `#8A4239` |
| Confirmed | `rgba(20,27,69,.07)` | `#2C3F9E` |
| In Progress | `rgba(154,117,50,.16)` | `#7D5E1F` |
| Ready | `#DBA69D` | `#141B45` |
| Completed | `rgba(23,29,63,.06)` | `--ink-40` |
| Cancelled | `rgba(23,29,63,.06)` | `--ink-40` |

The old traffic-light palette (green/orange/red badges) is retired.

## Interactions & behaviour
No new behaviour is introduced. Preserve everything currently in the repo: auth guards and the signed-out prompts, draft restore via `?appointmentId`, inline confirm-before-cancel/delete, realtime unread counters in `AppHeader`, the notification and chat routes. Only visual state changes are new:
- Buttons: on press, darken `--action` to `#CF9489`.
- List rows are whole-row links (existing `Link` wrappers); no hover states needed on mobile.
- Segmented control switches which list renders; no data refetch.

## Assets
In `design/`:
- `mark.png` — round La Sirène mark, white on transparent. Rendered via CSS mask so it can be tinted: `-webkit-mask:url(mark.png) center/contain no-repeat; mask:…; background: var(--mark)`. Supplied by the client (`public/logo.png` in the repo is the same mark).
- `wordmark.png` — "LA SIRÈNE" wordmark, white on transparent, used at 206px in the hero. Supplied by the client.
- `renders/*.png` — frames extracted from the boutique rendering PDF, used as placeholder photography (reception, seating area, facade). **Replace with real photography before launch**; they are architectural renders, not product images.

## Files in this bundle
- `design/La Sirene Redesign - Light Blush.html` — the three screens plus a direction board documenting palette and type.
- `design/` assets as listed above.
- `tokens/globals.css` — drop-in replacement for `src/app/globals.css`.
- `tokens/layout-fonts.tsx` — the font block for `src/app/layout.tsx`.

Open the HTML file in a browser to see the screens side by side; the leftmost panel is the direction rationale, not a screen.
