// app/api/payfast/checkout/route.ts
// Generates the PayFast payment form data for subscription checkout

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildSubscriptionData, PLANS, type PlanId } from '@/lib/payfast'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { planId } = await request.json() as { planId: PlanId }

    if (!PLANS[planId]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    // Get user profile + stokvel name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('name')
      .eq('admin_id', user.id)
      .single()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!

    const paymentData = buildSubscriptionData({
      userId:      user.id,
      userEmail:   profile?.email || user.email!,
      userName:    profile?.full_name || 'StokvelOS User',
      planId,
      stokvelName: stokvel?.name || 'My Stokvel',
      returnUrl:   `${appUrl}/pricing?payment=success&plan=${planId}`,
      cancelUrl:   `${appUrl}/pricing?payment=cancelled`,
      notifyUrl:   `${appUrl}/api/payfast/notify`,
    })

    return NextResponse.json({ paymentData, planId })
  } catch (err) {
    console.error('[PayFast checkout]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
