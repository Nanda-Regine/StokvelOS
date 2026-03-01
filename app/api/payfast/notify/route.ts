import { type NextRequest, NextResponse } from 'next/server'
import { validateITN } from '@/lib/payfast'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const rawBody  = await request.text()
    const formData = new URLSearchParams(rawBody)
    const data: Record<string, string> = {}
    formData.forEach((val, key) => { data[key] = val })

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'

    // Validate ITN authenticity (IP + signature + merchant ID)
    const result = await validateITN(data as Parameters<typeof validateITN>[0], rawBody, ip)
    if (!result.valid) {
      console.warn('[PayFast ITN] Rejected:', result.reason, { ip })
      return new NextResponse('INVALID', { status: 400 })
    }

    const supabase   = await createClient()
    const userId     = data.custom_str1
    const planId     = data.custom_str2
    const pfPayId    = data.pf_payment_id
    const status     = data.payment_status // COMPLETE | CANCELLED | FAILED

    if (status === 'COMPLETE') {
      await supabase.from('subscriptions').upsert({
        user_id:       userId,
        plan_id:       planId,
        status:        'active',
        pf_payment_id: pfPayId,
        started_at:    new Date().toISOString(),
      }, { onConflict: 'user_id' })

      await supabase.from('payment_history').insert({
        user_id:       userId,
        plan_id:       planId,
        amount:        parseFloat(data.amount_gross ?? '0'),
        pf_payment_id: pfPayId,
        status:        'complete',
      })
    } else if (status === 'CANCELLED' || status === 'FAILED') {
      await supabase.from('subscriptions').upsert(
        { user_id: userId, status: 'cancelled' },
        { onConflict: 'user_id' }
      )
    }

    return new NextResponse('OK', { status: 200 })
  } catch (err) {
    console.error('[PayFast ITN]', err)
    return new NextResponse('ERROR', { status: 500 })
  }
}
