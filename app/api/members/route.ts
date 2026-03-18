// app/api/members/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CreateMemberSchema, validationError } from '@/lib/validation'
import { checkApiRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit'
import { sendWhatsAppText } from '@/lib/whatsapp/360dialog'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = checkApiRateLimit(user.id)
    if (!rl.success) return rateLimitResponse(rl)

    const { searchParams } = new URL(request.url)
    const stokvelId = searchParams.get('stokvelId')
    if (!stokvelId) return NextResponse.json({ error: 'stokvelId required' }, { status: 400 })

    const { data, error } = await supabase
      .from('stokvel_members')
      .select('*')
      .eq('stokvel_id', stokvelId)
      .order('payout_position', { ascending: true, nullsFirst: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ members: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = checkApiRateLimit(user.id)
    if (!rl.success) return rateLimitResponse(rl)

    const body   = await request.json()
    const parsed = CreateMemberSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 })

    const { stokvelId, name, email, phone, monthly_amount, payout_position, status, role } = parsed.data

    // Verify ownership
    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('id, monthly_amount, name, whatsapp_number')
      .eq('id', stokvelId)
      .eq('admin_id', user.id)
      .single()

    if (!stokvel) return NextResponse.json({ error: 'Stokvel not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('stokvel_members')
      .insert({
        stokvel_id:      stokvelId,
        name:            name.trim(),
        email:           email?.trim() || null,
        phone:           phone?.trim() || null,
        monthly_amount:  monthly_amount ?? stokvel.monthly_amount,
        payout_position: payout_position ?? null,
        status,
        role,
        joined_at:       new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Send WhatsApp welcome message (non-blocking)
    if (phone?.trim() && stokvel.whatsapp_number) {
      const firstName = name.trim().split(' ')[0]
      const amount    = monthly_amount ?? stokvel.monthly_amount
      const welcome   = `Welcome to ${stokvel.name}, ${firstName}! 🎉\n\nYour monthly contribution is R${amount}. Reply "BALANCE" to check your account, or "HELP" for all commands.\n\n— StokvelOS`
      void sendWhatsAppText(phone.trim(), welcome).catch(err =>
        console.error('[Members] welcome WhatsApp failed:', err)
      )
    }

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    await writeAuditLog({
      stokvelId,
      actorId:    user.id,
      actorName:  profile?.full_name || user.email || 'Admin',
      action:     AUDIT_ACTIONS.MEMBER_CREATE,
      targetType: 'member',
      targetId:   data.id,
      details:    { name, role },
    })

    return NextResponse.json({ member: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
