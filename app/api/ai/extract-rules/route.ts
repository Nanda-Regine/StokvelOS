// app/api/ai/extract-rules/route.ts
// Trigger constitution rule extraction for a stokvel.
// Called once on setup, or when the chairperson updates their constitution.
// After this call, ALL compliance enforcement is free (no Claude).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractRulesFromConstitution } from '@/lib/compliance/extractor'
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { stokvelId } = await request.json()
    if (!stokvelId) return NextResponse.json({ error: 'stokvelId required' }, { status: 400 })

    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('constitution, constitution_text, name, admin_id')
      .eq('id', stokvelId)
      .single()

    if (!stokvel || stokvel.admin_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const constitutionText = stokvel.constitution || stokvel.constitution_text || ''
    const rules = await extractRulesFromConstitution(constitutionText, stokvelId)

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    await writeAuditLog({
      stokvelId,
      actorId:   user.id,
      actorName: profile?.full_name || user.email || 'Admin',
      action:    AUDIT_ACTIONS.AI_CONSTITUTION,
      details:   { source: rules.source, rulesExtracted: Object.keys(rules).length },
    } as any)

    return NextResponse.json({
      rules,
      source:  rules.source,
      message: rules.source === 'constitution'
        ? `Rules extracted from your constitution. Compliance enforcement is now active.`
        : `No constitution found — default rules applied. Upload your constitution to customise enforcement.`,
    })
  } catch (err) {
    console.error('[extract-rules]', err)
    return NextResponse.json({ error: 'Failed to extract rules' }, { status: 500 })
  }
}
