// app/api/ai/health-report/route.ts  (REPLACE Batch 2 version)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAiRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = checkAiRateLimit(user.id, 'health-report')
    if (!rl.success) return rateLimitResponse(rl)

    const { stokvelId, force } = await request.json()
    if (!stokvelId) return NextResponse.json({ error: 'stokvelId required' }, { status: 400 })

    const cacheKey = `health_${new Date().getFullYear()}_${new Date().getMonth()}`
    if (!force) {
      const { data: cached } = await supabase
        .from('ai_cache')
        .select('content, created_at')
        .eq('stokvel_id', stokvelId)
        .eq('cache_key', cacheKey)
        .single()
      if (cached) return NextResponse.json({ report: cached.content, cached: true })
    }

    const { data: stokvel } = await supabase.from('stokvels').select('*').eq('id', stokvelId).single()
    const { data: members } = await supabase.from('stokvel_members').select('*').eq('stokvel_id', stokvelId).eq('status', 'active')
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    const { data: thisMonthContribs } = await supabase
      .from('contributions').select('member_id, amount, status').eq('stokvel_id', stokvelId).eq('status', 'confirmed').gte('date', monthStart)

    const paidCount    = new Set(thisMonthContribs?.map(c => c.member_id) || []).size
    const compliance   = members?.length ? Math.round((paidCount / members.length) * 100) : 0
    const potTotal     = (thisMonthContribs || []).reduce((s, c) => s + Number(c.amount), 0)
    const outstanding  = (members || []).filter(m => !thisMonthContribs?.some(c => c.member_id === m.id))

    const prompt = `Stokvel: "${stokvel?.name}" | Type: ${stokvel?.type} | Members: ${members?.length} | Monthly target: R${stokvel?.monthly_amount * (members?.length || 0)} | Paid this month: ${paidCount}/${members?.length} (${compliance}%) | Amount collected: R${potTotal} | Outstanding: ${outstanding.map(m => m.name).join(', ') || 'none'}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [
        { role: 'system', content: 'You are a friendly stokvel advisor for South African community savings groups. Write a 3-4 sentence health report — warm, encouraging, in plain English. Mention compliance rate, any concerning patterns, and a specific actionable recommendation. Never be harsh about late members by name.' },
        { role: 'user', content: prompt },
      ],
    })

    const report = completion.choices[0]?.message?.content?.trim() || ''
    await supabase.from('ai_cache').upsert({ stokvel_id: stokvelId, cache_key: cacheKey, content: report }, { onConflict: 'stokvel_id,cache_key' })

    return NextResponse.json({ report, cached: false })
  } catch (err) {
    console.error('[AI Health Report]', err)
    return NextResponse.json({ error: 'AI unavailable' }, { status: 500 })
  }
}
