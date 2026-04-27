# Claude Code Prompt — Book Page: Restore Draft on Load

Paste this into Claude Code (in the `~/la-sirene-app` directory):

---

Update `src/app/(app)/book/page.tsx` to restore an existing draft booking when the page loads.

Here is exactly what needs to happen:

1. At the top of the `useEffect` that runs on mount (or create a new one that runs once on mount), after getting the logged-in user, query Supabase for any appointment with `status = 'draft'` belonging to that user:

```ts
const { data: draft } = await supabase
  .from('appointments')
  .select('id, scheduled_at, appointment_items(id, garment_id, garments(category, subcategory, description, price))')
  .eq('client_id', user.id)
  .eq('status', 'draft')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
```

2. If a draft is found (`draft !== null`):
   - Set `appointmentId` state to `draft.id`
   - Parse `draft.scheduled_at` (it's an ISO string like "2026-05-15T09:00:00") back into the date string ("2026-05-15") and the time slot label (like "9:00 AM – 11:00 AM"). The slots are: 9:00 AM – 11:00 AM, 11:00 AM – 1:00 PM, 1:00 PM – 3:00 PM, 3:00 PM – 5:00 PM, 5:00 PM – 7:00 PM. Match the hour from the ISO string to figure out which slot was selected.
   - Set `selectedDate` to the date string
   - Set `selectedSlot` to the matching slot label
   - Restore `items` from `draft.appointment_items` — each item should be mapped to the same shape as the existing items array (which has fields like: `id` (appointment_items.id), `garmentId`, `category`, `subcategory`, `description`, `price`)
   - Set `step` to `2` so the user lands directly on Step 2

3. If no draft is found, leave everything as-is (user starts fresh at Step 1).

4. Show a brief loading state while this check happens (a spinner is fine — the same one already used when `saving` is true).

Make sure the TypeScript types are correct. The `garments` join in the select may need to be cast. Keep all existing logic for Steps 1, 2, and 3 exactly as-is — this change only adds logic to the initial mount effect.
