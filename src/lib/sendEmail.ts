import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  try {
    await resend.emails.send({
      from: 'La Sirène <onboarding@resend.dev>',
      to,
      subject,
      html,
    })
  } catch (err) {
    console.error('Email send failed:', err)
    // Never throw — email failure must never block the main flow
  }
}
