// app/api/cron/monthly-reports/route.ts
// Vercel Cron: 7AM on the 1st of each month — generate monthly reports + sync to Notion

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { Client as NotionClient } from '@notionhq/client'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now       = new Date()
  // Report covers the previous month
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthStr  = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`
  const monthStart = `${monthStr}-01`
  const monthEnd   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthLabel = prevMonth.toLocaleString('en-ZA', { month: 'long', year: 'numeric' })

  try {
    const { data: stokvels } = await serviceClient
      .from('stokvels')
      .select('id, name, type, monthly_amount, notion_payouts_db_id')
      .eq('active', true)

    const processed: { stokvelId: string; month: string }[] = []

    for (const stokvel of stokvels || []) {
      try {
        const [
          { data: members },
          { data: contributions },
          { data: payouts },
          { data: fraudAlerts },
        ] = await Promise.all([
          serviceClient.from('stokvel_members').select('id').eq('stokvel_id', stokvel.id).eq('status', 'active'),
          serviceClient.from('contributions').select('amount, member_id').eq('stokvel_id', stokvel.id).gte('payment_date', monthStart).lt('payment_date', monthEnd).in('status', ['verified', 'confirmed']),
          serviceClient.from('payouts').select('amount').eq('stokvel_id', stokvel.id).gte('payout_date', monthStart).lt('payout_date', monthEnd),
          serviceClient.from('fraud_alerts').select('id').eq('stokvel_id', stokvel.id).gte('created_at', monthStart).lt('created_at', monthEnd),
        ])

        const totalCollected   = (contributions || []).reduce((s, c) => s + Number(c.amount), 0)
        const totalPaidOut     = (payouts || []).reduce((s, p) => s + Number(p.amount), 0)
        const activeMembers    = members?.length || 0
        const paidMemberIds    = new Set((contributions || []).map(c => c.member_id))
        const complianceRate   = activeMembers > 0 ? Math.round((paidMemberIds.size / activeMembers) * 100) : 0

        // Generate AI summary
        let aiSummary = ''
        try {
          const response = await anthropic.messages.create({
            model:     'claude-sonnet-4-6',
            max_tokens: 150,
            system:    'Write a 2-sentence monthly summary for a South African stokvel. Warm, professional tone. Plain English.',
            messages:  [{ role: 'user', content: `${stokvel.name} — ${monthLabel}: R${totalCollected} collected from ${paidMemberIds.size}/${activeMembers} members (${complianceRate}% compliance). R${totalPaidOut} paid out. ${fraudAlerts?.length || 0} fraud alerts.` }],
          })
          aiSummary = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
        } catch {
          aiSummary = `${stokvel.name} collected R${totalCollected} in ${monthLabel} with ${complianceRate}% member compliance.`
        }

        // Sync to Notion if workspace is connected
        if (stokvel.notion_payouts_db_id && process.env.NOTION_API_KEY) {
          try {
            const notion = new NotionClient({ auth: process.env.NOTION_API_KEY })
            await notion.pages.create({
              parent: { database_id: stokvel.notion_payouts_db_id },
              properties: {
                'Month':             { title: [{ text: { content: monthLabel } }] },
                'Total Collected':   { number: totalCollected },
                'Total Paid Out':    { number: totalPaidOut },
                'Compliance Rate %': { number: complianceRate / 100 },
                'Active Members':    { number: activeMembers },
                'Fraud Alerts':      { number: fraudAlerts?.length || 0 },
                'AI Summary':        { rich_text: [{ text: { content: aiSummary } }] },
              },
            })
          } catch (notionErr) {
            console.error(`[Cron/monthly-reports] Notion sync failed for ${stokvel.id}:`, notionErr)
          }
        }

        processed.push({ stokvelId: stokvel.id, month: monthStr })
      } catch (stokvelErr) {
        console.error(`[Cron/monthly-reports] failed for stokvel ${stokvel.id}:`, stokvelErr)
      }
    }

    return NextResponse.json({
      success:   true,
      month:     monthStr,
      processed: processed.length,
    })
  } catch (err) {
    console.error('[Cron/monthly-reports]', err)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
