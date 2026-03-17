// app/api/cron/loan-overdue-check/route.ts
// Vercel Cron: 8AM every Monday — mark overdue loans, notify chairperson

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppText } from '@/lib/whatsapp/360dialog'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date().toISOString().split('T')[0]

    // Find active loans past their end_date
    const { data: overdueLoans } = await serviceClient
      .from('loans')
      .select(`
        id,
        stokvel_id,
        member_id,
        balance_outstanding,
        end_date,
        stokvel_members!inner(name, phone),
        stokvels!inner(name, chairperson_phone, whatsapp_number)
      `)
      .eq('status', 'active')
      .lt('end_date', today)

    let markedOverdue = 0
    const grouped: Record<string, typeof overdueLoans> = {}

    for (const loan of overdueLoans || []) {
      // Mark as overdue
      await serviceClient
        .from('loans')
        .update({ status: 'overdue' })
        .eq('id', loan.id)

      markedOverdue++

      // Group by stokvel for chairperson notification
      const stokvelId = loan.stokvel_id
      if (!grouped[stokvelId]) grouped[stokvelId] = []
      grouped[stokvelId]!.push(loan)

      // Also update fraud_alerts
      await serviceClient.from('fraud_alerts').insert({
        stokvel_id:  loan.stokvel_id,
        member_id:   loan.member_id,
        alert_type:  'overdue_loan',
        severity:    'medium',
        description: `Loan overdue: ${(loan as any).stokvel_members?.name} — R${loan.balance_outstanding} outstanding (due ${loan.end_date})`,
        evidence:    { loanId: loan.id, balanceOutstanding: loan.balance_outstanding, endDate: loan.end_date },
        status:      'open',
      })
    }

    // Notify chairperson per stokvel
    for (const [stokvelId, loans] of Object.entries(grouped)) {
      const firstLoan     = loans![0] as any
      const chairPhone    = firstLoan.stokvels?.chairperson_phone || firstLoan.stokvels?.whatsapp_number
      const stokvelName   = firstLoan.stokvels?.name || 'your stokvel'

      if (!chairPhone) continue

      const loanSummary = loans!.map((l: any) =>
        `- ${l.stokvel_members?.name}: R${l.balance_outstanding} (due ${l.end_date})`
      ).join('\n')

      const message = `[StokvelOS] Overdue Loan Alert for ${stokvelName}:\n\n${loans!.length} overdue loan(s):\n${loanSummary}\n\nPlease follow up with these members. View details: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard`

      await sendWhatsAppText(chairPhone, message)
    }

    return NextResponse.json({
      success:      true,
      markedOverdue,
      stokvelsAlerted: Object.keys(grouped).length,
    })
  } catch (err) {
    console.error('[Cron/loan-overdue-check]', err)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
