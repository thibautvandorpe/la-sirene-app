/**
 * Phone and email normalisation utilities.
 *
 * Why does normalizePhone return null rather than a best-guess string?
 *
 * This value is used to match a Supabase client to a CleanCloud customer.
 * A wrong E.164 string silently links the wrong customer to the wrong account
 * — a data-integrity bug that is invisible until it causes real harm (wrong
 * order history, wrong charges). A null surfaces as an unmatched record that a
 * human can review and correct. Confident silence is worse than a visible gap.
 */

export function normalizePhone(input: string | null | undefined): string | null {
  // Rule 1: null, undefined, or blank after trimming.
  if (input == null) return null
  const trimmed = input.trim()
  if (trimmed === '') return null

  // Detect a leading '+' before stripping non-digits.
  const hasPlus = trimmed.startsWith('+')
  const digits = (hasPlus ? trimmed.slice(1) : trimmed).replace(/\D/g, '')

  if (hasPlus) {
    // Rule 3: had a leading '+' — ITU E.164 allows 8–15 significant digits.
    if (digits.length >= 8 && digits.length <= 15) return '+' + digits
    return null
  }

  // Rule 4: 11 digits starting with '1' — North American number with country code already present.
  if (digits.length === 11 && digits.startsWith('1')) {
    return '+' + digits
  }

  // Rule 5: 10 digits, first digit 2–9 — North American number without country code.
  // Area codes never begin with 0 or 1, so prepending +1 is a safe assumption here.
  if (digits.length === 10 && /^[2-9]/.test(digits)) {
    return '+1' + digits
  }

  // Rule 6: anything else — do not guess.
  // Examples that reach here: French national format (0630292810), short strings,
  // 10-digit numbers starting with 0 or 1, and the internal admin test number 1234567890.
  return null
}

/**
 * Trim and lowercase an email address, or return null if blank.
 */
export function normalizeEmail(input: string | null | undefined): string | null {
  if (input == null) return null
  const trimmed = input.trim().toLowerCase()
  return trimmed === '' ? null : trimmed
}
