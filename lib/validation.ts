// lib/validation.ts
// Zod schemas for all API request bodies
// Used in every POST/PATCH route

import { z } from 'zod'

// ── Helpers ───────────────────────────────────────────────────
const uuid    = z.string().uuid()
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
const money   = z.coerce.number().positive('Must be greater than 0').max(1_000_000)

// ── Members ───────────────────────────────────────────────────
export const CreateMemberSchema = z.object({
  stokvelId:       uuid,
  name:            z.string().min(2, 'Name must be at least 2 characters').max(100),
  email:           z.string().email('Invalid email').optional().nullable(),
  phone:           z.string().max(20).optional().nullable(),
  monthly_amount:  money.optional().nullable(),
  payout_position: z.coerce.number().int().positive().max(999).optional().nullable(),
  status:          z.enum(['active', 'inactive', 'suspended']).default('active'),
  role:            z.enum(['admin', 'treasurer', 'secretary', 'member']).default('member'),
})

export const UpdateMemberSchema = CreateMemberSchema.omit({ stokvelId: true }).partial()

// ── Contributions ─────────────────────────────────────────────
export const CreateContributionSchema = z.object({
  stokvelId:  uuid,
  member_id:  uuid,
  amount:     money,
  date:       dateStr,
  method:     z.enum(['cash', 'eft', 'card', 'snapscan', 'ozow']).default('cash'),
  status:     z.enum(['confirmed', 'pending', 'rejected']).default('confirmed'),
  notes:      z.string().max(500).optional().nullable(),
})

export const UpdateContributionSchema = z.object({
  status:  z.enum(['confirmed', 'pending', 'rejected']).optional(),
  amount:  money.optional(),
  date:    dateStr.optional(),
  method:  z.enum(['cash', 'eft', 'card', 'snapscan', 'ozow']).optional(),
  notes:   z.string().max(500).optional().nullable(),
})

// ── Bulk payment ──────────────────────────────────────────────
export const BulkPaymentSchema = z.object({
  stokvelId:  uuid,
  memberIds:  z.array(uuid).min(1, 'Select at least one member').max(200),
  amount:     money.optional(),
  date:       dateStr,
  method:     z.enum(['cash', 'eft', 'card', 'snapscan', 'ozow']).default('cash'),
  status:     z.enum(['confirmed', 'pending']).default('confirmed'),
  notes:      z.string().max(500).optional().nullable(),
})

// ── Meetings ──────────────────────────────────────────────────
export const CreateMeetingSchema = z.object({
  stokvelId:  uuid,
  title:      z.string().min(3).max(200),
  date:       dateStr,
  location:   z.string().max(200).optional().nullable(),
  attendees:  z.array(uuid).default([]),
  raw_notes:  z.string().max(10_000).optional().nullable(),
})

export const UpdateMeetingSchema = CreateMeetingSchema.omit({ stokvelId: true })
  .partial()
  .extend({
    formatted_minutes: z.string().max(20_000).optional().nullable(),
    ai_summary:        z.string().max(500).optional().nullable(),
  })

// ── Payouts ───────────────────────────────────────────────────
export const CreatePayoutSchema = z.object({
  stokvelId:  uuid,
  member_id:  uuid,
  amount:     money,
  date:       dateStr,
  status:     z.enum(['scheduled', 'paid', 'skipped']).default('paid'),
  notes:      z.string().max(500).optional().nullable(),
})

export const UpdatePayoutSchema = CreatePayoutSchema.omit({ stokvelId: true }).partial()

// ── Announcements ─────────────────────────────────────────────
export const CreateAnnouncementSchema = z.object({
  stokvelId:  uuid,
  title:      z.string().min(3).max(200),
  body:       z.string().min(10).max(5000),
  type:       z.enum(['info', 'warning', 'success']).default('info'),
  pinned:     z.boolean().default(false),
  expires_at: z.string().datetime().optional().nullable(),
})

// ── PayFast ───────────────────────────────────────────────────
export const CheckoutSchema = z.object({
  planId: z.enum(['basic', 'premium']),
})

// ── AI requests ───────────────────────────────────────────────
export const HealthReportSchema = z.object({
  stokvelId: uuid,
  force:     z.boolean().default(false),
})

export const RemindersSchema = z.object({
  stokvelId: uuid,
  memberIds: z.array(uuid).min(1).max(100),
})

export const MeetingMinutesSchema = z.object({
  meetingId:      uuid.optional(),
  stokvelName:    z.string().max(200),
  meetingTitle:   z.string().max(200),
  date:           z.string().max(50),
  location:       z.string().max(200).optional().nullable(),
  attendeeNames:  z.array(z.string()).optional(),
  rawNotes:       z.string().min(10, 'Notes are too short').max(10_000),
})

export const ConstitutionSchema = z.object({
  stokvelId: uuid,
})

// ── Stokvel settings ──────────────────────────────────────────
export const UpdateStokvelSchema = z.object({
  name:             z.string().min(2).max(200).optional(),
  type:             z.enum(['general', 'grocery', 'burial', 'investment', 'christmas', 'other']).optional(),
  province:         z.string().max(100).optional().nullable(),
  description:      z.string().max(1000).optional().nullable(),
  monthly_amount:   money.optional(),
  payout_frequency: z.enum(['monthly', 'quarterly', 'annually']).optional(),
  payout_order:     z.enum(['rotation', 'draw', 'seniority', 'need']).optional(),
  bank_name:        z.string().max(100).optional().nullable(),
  bank_account:     z.string().max(50).optional().nullable(),
  bank_branch:      z.string().max(20).optional().nullable(),
})

// ── Audit log write (server-side only) ───────────────────────
export interface AuditEntry {
  stokvelId:   string
  actorId:     string
  actorName:   string
  action:      string
  targetType?: string
  targetId?:   string
  details?:    Record<string, unknown>
}

// ── Response helpers ──────────────────────────────────────────
export function validationError(error: z.ZodError) {
  const first = error.errors[0]
  return { error: `${first.path.join('.')}: ${first.message}` }
}
