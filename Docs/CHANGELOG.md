# La Sirène App — Changelog

A human-readable log of all features and changes built session by session.
For full code-level detail, see the [Git commit history](https://github.com/thibautvandorpe/la-sirene-app/commits/main).

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
