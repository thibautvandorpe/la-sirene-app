import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { ensureCleanCloudCustomer } from '@/lib/cleancloudCustomer'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await supabase.auth.exchangeCodeForSession(code)
    if (data?.user) {
      try {
        await ensureCleanCloudCustomer(data.user.id)
      } catch (err) {
        console.error('CleanCloud sync failed in auth callback:', err)
      }
    }
  }

  return NextResponse.redirect(`${origin}/`)
}
