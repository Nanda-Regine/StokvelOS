// app/api/cron/risk-analysis/route.ts
// Vercel Cron: 11PM daily — proactive financial risk agent
// One Claude call per stokvel, only WhatsApps chairperson when action is needed.
// The instruction block is prompt-cached — all stokvels share it.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { sendWhatsAppText } from '@/lib/whatsapp/360dialog'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Cached instructions — same for every stokvel, shared cache hit
const RISK_ANALYST_INSTRUCTIONS = `You are a financial risk analyst for South African stokvels.
Given stokvel data, identify risks and produce a brief JSON risk assessment.

Respond ONLY with valid JSON:
{
  "risk_level": "low"|"medium"|"high"|"critical",
  "compliance_trend": "improving"|"stable"|"declining",
  "loan_book_health": "healthy"|"stressed"|"critical",
  "projected_collection": <number — rand amount expected this month>,
  "alerts": [
    {"type": "<alert_type>", "message": "<under 100 chars>", "severity": "low"|"medium"|"high"|"critical"}
  ],
  "ai_summary": "<2 sentence plain-English summary for chairperson>",
  "needs_notification": <true if risk_level is medium or above>
}

Alert types: cashflow_risk | compliance_decline | loan_stress | member_at_risk |
             payout_shortfall | suspicious_pattern | low_engagement`

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  const snapshotDate = today.toISOString().split('T')[0]

  try {
    const { data: stokvels } = await serviceClient
      .from('stokvels')
      .select('id, name, monthly_amount, total_funds, chairperson_phone, whatsapp_number')
      .eq('active', true)

    let analysed = 0
    let notified  = 0
    const snapshots: { stokvelId: string; riskLevel: string }[] = []

    for (const stokvel of stokvels || []) {
      try {
        // Skip if already snapshotted today
        const { data: existing } = await serviceClient
          .from('risk_snapshots')
          .select('id')
          .eq('stokvel_id',    stokvel.id)
          .eq('snapshot_date', snapshotDate)
          .single()
        if (existing) continue

        const data = await gatherStokvelData(stokvel.id, stokvel.monthly_amount)

        // Call Claude — instruction block is cached across all stokvels
        const response = await anthropic.beta.promptCaching.messages.create({
          model:     'claude-sonnet-4-6',
          max_tokens: 400,
          system: [
            {
              type:          'text' as const,
              text:          RISK_ANALYST_INSTRUCTIONS,
              cache_control: { type: 'ephemeral' as const }, // ← shared cache across all stokvels
            },
          ],
          messages: [{
            role:    'user',
            content: buildDataPrompt(stokvel.name, data),
          }],
        })

        const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
        let assessment: any

        try {
          assessment = JSON.parse(raw.replace(/```json|```/g, '').trim())
        } catch {
          assessment = {
            risk_level:           'low',
            compliance_trend:     'stable',
            loan_book_health:     'healthy',
            projected_collection: data.projectedCollection,
            alerts:               [],
            ai_summary:           `${stokvel.name} is operating normally.`,
            needs_notification:   false,
          }
        }

        // Store snapshot
        await serviceClient.from('risk_snapshots').insert({
          stokvel_id:          stokvel.id,
          snapshot_date:       snapshotDate,
          risk_level:          assessment.risk_level,
          compliance_rate:     data.currentCompliance,
          compliance_trend:    assessment.compliance_trend,
          projected_collection: assessment.projected_collection,
          expected_collection:  data.expectedCollection,
          loan_book_percent:   data.loanBookPercent,
          members_at_risk:     data.membersAtRisk,
          alerts:              assessment.alerts || [],
          ai_summary:          assessment.ai_summary,
        })

        // Store high-severity items as fraud_alerts for dashboard visibility
        for (const alert of (assessment.alerts || []) as any[]) {
          if (['high', 'critical'].includes(alert.severity)) {
            await serviceClient.from('fraud_alerts').insert({
              stokvel_id:  stokvel.id,
              alert_type:  alert.type,
              severity:    alert.severity,
              description: alert.message,
              status:      'open',
            })
          }
        }

        // Notify chairperson if action needed
        const chairPhone = stokvel.chairperson_phone || stokvel.whatsapp_number
        if (assessment.needs_notification && chairPhone) {
          const alertSummary = (assessment.alerts || [])
            .filter((a: any) => ['high', 'critical'].includes(a.severity))
            .map((a: any) => `• ${a.message}`)
            .join('\n')

          const message = `[StokvelOS Risk Alert] ${stokvel.name}\n\n${assessment.ai_summary}${alertSummary ? '\n\n' + alertSummary : ''}\n\nView dashboard: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
          await sendWhatsAppText(chairPhone, message)

          await serviceClient
            .from('risk_snapshots')
            .update({ notified_at: new Date().toISOString() })
            .eq('stokvel_id',    stokvel.id)
            .eq('snapshot_date', snapshotDate)

          notified++
        }

        snapshots.push({ stokvelId: stokvel.id, riskLevel: assessment.risk_level })
        analysed++
      } catch (stokvelErr) {
        console.error(`[risk-analysis] failed for ${stokvel.id}:`, stokvelErr)
      }
    }

    return NextResponse.json({
      success:   true,
      date:      snapshotDate,
      analysed,
      notified,
      snapshots,
    })
  } catch (err) {
    console.error('[Cron/risk-analysis]', err)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}

async function gatherStokvelData(stokvelId: string, monthlyAmount: number) {
  const now        = new Date()
  const thisMonth  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0]

  const [
    { data: members },
    { data: thisMonthContribs },
    { data: prev3MonthsContribs },
    { data: activeLoans },
    { data: stokvel },
  ] = await Promise.all([
    serviceClient.from('stokvel_members').select('id, status, compliance_rate, joined_at').eq('stokvel_id', stokvelId).eq('status', 'active'),
    serviceClient.from('contributions').select('member_id, amount').eq('stokvel_id', stokvelId).gte('date', thisMonth).in('status', ['verified', 'confirmed']),
    serviceClient.from('contributions').select('member_id, date, amount').eq('stokvel_id', stokvelId).gte('date', threeMonthsAgo).in('status', ['verified', 'confirmed']),
    serviceClient.from('loans').select('balance_outstanding').eq('stokvel_id', stokvelId).in('status', ['active', 'overdue']),
    serviceClient.from('stokvels').select('total_funds').eq('id', stokvelId).single(),
  ])

  const activeCount      = members?.length || 0
  const paidThisMonth    = new Set(thisMonthContribs?.map(c => c.member_id)).size
  const currentCompliance = activeCount > 0 ? Math.round((paidThisMonth / activeCount) * 100) : 0
  const expectedCollection = activeCount * monthlyAmount
  const projectedCollection = Math.round((currentCompliance / 100) * expectedCollection)

  const totalFunds   = Number(stokvel?.total_funds || 0)
  const loanBook     = (activeLoans || []).reduce((s, l) => s + Number(l.balance_outstanding), 0)
  const loanBookPercent = totalFunds > 0 ? Math.round((loanBook / totalFunds) * 100) : 0

  // Members at risk: compliance < 67% (2/3 months missed)
  const membersAtRisk = (members || []).filter(m => Number(m.compliance_rate) < 67).length

  // Compliance trend: compare last month vs 2 months ago
  const lastMonthStart    = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const twoMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0]

  const lastMonthPaid    = new Set((prev3MonthsContribs || []).filter(c => c.date >= lastMonthStart).map(c => c.member_id)).size
  const twoMonthAgosPaid = new Set((prev3MonthsContribs || []).filter(c => c.date >= twoMonthsAgoStart && c.date < lastMonthStart).map(c => c.member_id)).size

  return {
    activeCount,
    paidThisMonth,
    currentCompliance,
    expectedCollection,
    projectedCollection,
    totalFunds,
    loanBook,
    loanBookPercent,
    membersAtRisk,
    lastMonthPaid,
    twoMonthAgosPaid,
  }
}

function buildDataPrompt(stokvelName: string, d: Awaited<ReturnType<typeof gatherStokvelData>>): string {
  return `STOKVEL: ${stokvelName}
Active members: ${d.activeCount}
This month paid: ${d.paidThisMonth}/${d.activeCount} (${d.currentCompliance}%)
Expected monthly collection: R${d.expectedCollection}
Projected collection: R${d.projectedCollection}
Total funds: R${d.totalFunds}
Loan book outstanding: R${d.loanBook} (${d.loanBookPercent}% of funds)
Members at risk (<67% compliance): ${d.membersAtRisk}
Last month paid: ${d.lastMonthPaid}
Two months ago paid: ${d.twoMonthAgosPaid}`
}
