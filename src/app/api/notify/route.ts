import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/sendEmail'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function baseLayout(content: string, ctaLabel: string, ctaUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#1c2b1e;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1c2b1e;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#1c2b1e;">

        <!-- Header -->
        <tr><td style="padding-bottom:32px;border-bottom:1px solid rgba(196,184,154,0.15);">
          <p style="margin:0;font-family:Georgia,serif;font-size:22px;color:#c4b89a;letter-spacing:0.05em;">
            La Sirène
          </p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;font-size:14px;font-weight:300;color:#f5f0e8;line-height:1.7;">
          ${content}
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding-bottom:40px;">
          <a href="${ctaUrl}"
             style="display:inline-block;background:#c4b89a;color:#1c2b1e;padding:12px 32px;
                    font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;
                    font-size:11px;font-weight:500;text-transform:uppercase;
                    letter-spacing:0.15em;text-decoration:none;">
            ${ctaLabel}
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="border-top:1px solid rgba(196,184,154,0.1);padding-top:24px;">
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;
                    font-size:11px;font-weight:300;color:rgba(245,240,232,0.3);">
            © La Sirène Beverly Hills
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function buildOrderStatusEmail(firstName: string, body: string): string {
  const content = `
    <p style="margin:0 0 16px;">Dear ${firstName},</p>
    <p style="margin:0;">${body}</p>
  `
  return baseLayout(content, 'View My Order', 'https://la-sirene-app.vercel.app')
}

function buildChatMessageEmail(firstName: string, preview: string): string {
  const content = `
    <p style="margin:0 0 16px;">Dear ${firstName},</p>
    <p style="margin:0 0 24px;">You have a new message from the La Sirène team.</p>
    <p style="margin:0;padding:16px;background:rgba(196,184,154,0.06);
              border-left:2px solid rgba(196,184,154,0.3);
              font-style:italic;color:rgba(245,240,232,0.7);">
      ${preview.slice(0, 120)}${preview.length > 120 ? '…' : ''}
    </p>
  `
  return baseLayout(content, 'Open Chat', 'https://la-sirene-app.vercel.app')
}

export async function POST(req: NextRequest) {
  try {
    const { clientId, type, title, body } = await req.json()

    if (!clientId || !type || !title || !body) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('email, full_name, email_notifications_enabled')
      .eq('id', clientId)
      .single()

    if (!client?.email || client.email_notifications_enabled === false) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const firstName = client.full_name?.split(' ')[0] ?? 'there'

    const html = type === 'chat_message'
      ? buildChatMessageEmail(firstName, body)
      : buildOrderStatusEmail(firstName, body)

    await sendEmail({ to: client.email, subject: title, html })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Notify route error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
