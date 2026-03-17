import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { stokvelId } = await request.json()
    if (!stokvelId) return NextResponse.json({ error: 'stokvelId required' }, { status: 400 })

    // Verify ownership
    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('*')
      .eq('id', stokvelId)
      .eq('admin_id', user.id)
      .single()

    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Check cache (1 report per month)
    const month = new Date().toISOString().slice(0, 7)
    const { data: cached } = await supabase
      .from('ai_cache')
      .select('report')
      .eq('stokvel_id', stokvelId)
      .eq('month', month)
      .single()

    if (cached) return NextResponse.json({ report: cached.report, cached: true })

    // Fetch data for analysis
    const currentYear = new Date().getFullYear()
    const [{ data: members }, { data: contributions }] = await Promise.all([
      supabase
        .from('stokvel_members')
        .select('name, monthly_amount, status')
        .eq('stokvel_id', stokvelId),
      supabase
        .from('contributions')
        .select('amount, date, status, member_id')
        .eq('stokvel_id', stokvelId)
        .gte('date', `${currentYear}-01-01`),
    ])

    const prompt = `You are a financial advisor for South African stokvels. Analyse this stokvel data and provide a brief health report.

Stokvel: ${stokvel.name} (${stokvel.type})
Monthly target: R${stokvel.monthly_amount}
Members: ${members?.length ?? 0} active
Total contributions this year: R${contributions?.reduce((s, c) => s + (c.amount || 0), 0) ?? 0}
Confirmed contributions: ${contributions?.filter(c => c.status === 'confirmed').length ?? 0}/${contributions?.length ?? 0}

Respond in JSON: { "summary": "2-3 sentence summary", "complianceRate": number (0-100), "trend": "up"|"down"|"stable", "recommendation": "1 actionable recommendation" }`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: 'You are a financial advisor for South African stokvels. Respond ONLY with valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const report = JSON.parse(raw)

    // Cache the report
    await supabase.from('ai_cache').upsert({
      stokvel_id: stokvelId,
      month,
      report,
    })

    return NextResponse.json({ report, cached: false })
  } catch (err) {
    console.error('[AI health]', err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
