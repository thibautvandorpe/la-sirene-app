import { NextResponse } from 'next/server'
import { normalizePhone, normalizeEmail } from '@/lib/phone'

const phoneCases: Array<{ input: string | null; expected: string | null; note?: string }> = [
  { input: '9175743840',       expected: '+19175743840' },
  { input: '917-574-3840',     expected: '+19175743840' },
  { input: '(917) 574-3840',   expected: '+19175743840' },
  { input: '917.574.3840',     expected: '+19175743840' },
  { input: ' 917 574 3840 ',   expected: '+19175743840' },
  { input: '+1 917 574 3840',  expected: '+19175743840' },
  { input: '19175743840',      expected: '+19175743840' },
  { input: '718-715-6716',     expected: '+17187156716' },
  { input: '+33630292810',     expected: '+33630292810' },
  { input: '0630292810',       expected: null, note: 'French national format — ambiguous' },
  { input: '1175743840',       expected: null, note: '10 digits starting with 1 — not a valid US area code' },
  { input: '0175743840',       expected: null, note: '10 digits starting with 0 — not a valid US area code' },
  { input: '1234567890',       expected: null, note: 'internal admin account, deliberately inert' },
  { input: '12345',            expected: null },
  { input: 'not a phone',      expected: null },
  { input: '',                 expected: null },
  { input: null,               expected: null },
]

const emailCases: Array<{ input: string | null; expected: string | null }> = [
  { input: '  Thibaut@Gmail.COM  ', expected: 'thibaut@gmail.com' },
  { input: 'already@lower.com',     expected: 'already@lower.com' },
  { input: '',                      expected: null },
  { input: '   ',                   expected: null },
  { input: null,                    expected: null },
]

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse(null, { status: 404 })
  }

  const phoneResults = phoneCases.map(({ input, expected, note }) => {
    const actual = normalizePhone(input)
    return { input, expected, actual, pass: actual === expected, ...(note ? { note } : {}) }
  })
  const phonePassed = phoneResults.filter(r => r.pass).length

  const emailResults = emailCases.map(({ input, expected }) => {
    const actual = normalizeEmail(input)
    return { input, expected, actual, pass: actual === expected }
  })
  const emailPassed = emailResults.filter(r => r.pass).length

  return NextResponse.json({
    phone: {
      summary: { total: phoneResults.length, passed: phonePassed, failed: phoneResults.length - phonePassed },
      cases: phoneResults,
    },
    email: {
      summary: { total: emailResults.length, passed: emailPassed, failed: emailResults.length - emailPassed },
      cases: emailResults,
    },
  })
}
