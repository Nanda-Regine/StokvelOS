// lib/audit.ts
// Write audit log entries to Supabase
// Call from any API route after mutating data

import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { AuditEntry } from './validation'

// Use service role so audit logs can always be written
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const supabase = getServiceClient()
    await supabase.from('audit_log').insert({
      stokvel_id:  entry.stokvelId,
      actor_id:    entry.actorId,
      actor_name:  entry.actorName,
      action:      entry.action,
      target_type: entry.targetType || null,
      target_id:   entry.targetId   || null,
      details:     entry.details    || {},
    })
  } catch (err) {
    // Audit log failure should never break the main flow
    console.error('[AuditLog] Failed to write:', err)
  }
}

// ── Action constants ──────────────────────────────────────────
export const AUDIT_ACTIONS = {
  // Members
  MEMBER_CREATE:  'member.create',
  MEMBER_UPDATE:  'member.update',
  MEMBER_REMOVE:  'member.remove',

  // Contributions
  CONTRIBUTION_CREATE: 'contribution.create',
  CONTRIBUTION_UPDATE: 'contribution.update',
  CONTRIBUTION_DELETE: 'contribution.delete',
  CONTRIBUTION_BULK:   'contribution.bulk',

  // Payouts
  PAYOUT_CREATE: 'payout.create',
  PAYOUT_UPDATE: 'payout.update',

  // Meetings
  MEETING_CREATE:   'meeting.create',
  MEETING_UPDATE:   'meeting.update',
  MEETING_DELETE:   'meeting.delete',
  MEETING_MINUTES:  'meeting.minutes_generated',

  // AI
  AI_HEALTH_REPORT: 'ai.health_report',
  AI_REMINDERS:     'ai.reminders_generated',
  AI_CONSTITUTION:  'ai.constitution_generated',

  // Settings
  STOKVEL_UPDATE:   'stokvel.update',
  SUBSCRIPTION_ACTIVATE: 'subscription.activate',
  SUBSCRIPTION_CANCEL:   'subscription.cancel',

  // Announcements
  ANNOUNCEMENT_CREATE: 'announcement.create',
  ANNOUNCEMENT_DELETE: 'announcement.delete',
} as const
