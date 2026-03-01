import { z } from 'zod'

// ── Stokvel ───────────────────────────────────────────────────
export const stokvelSchema = z.object({
  name:             z.string().min(2).max(100).trim(),
  type:             z.enum(['general', 'grocery', 'burial', 'investment', 'christmas', 'other']),
  province:         z.string().max(50).optional(),
  description:      z.string().max(500).optional(),
  monthly_amount:   z.number().positive().max(1_000_000),
  payout_frequency: z.enum(['monthly', 'quarterly', 'annually']),
  payout_order:     z.enum(['draw', 'rotation', 'seniority', 'need']),
  start_date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

// ── Member ────────────────────────────────────────────────────
export const memberSchema = z.object({
  name:            z.string().min(2).max(100).trim(),
  email:           z.string().email().optional().or(z.literal('')),
  phone:           z.string().max(20).optional(),
  monthly_amount:  z.number().positive().max(1_000_000).optional(),
  payout_position: z.number().int().positive().optional(),
  status:          z.enum(['active', 'inactive', 'suspended']).default('active'),
  role:            z.enum(['admin', 'treasurer', 'secretary', 'member']).default('member'),
})

// ── Contribution ──────────────────────────────────────────────
export const contributionSchema = z.object({
  member_id: z.string().uuid(),
  amount:    z.number().positive().max(1_000_000),
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method:    z.enum(['cash', 'eft', 'card', 'snapscan', 'ozow']),
  status:    z.enum(['confirmed', 'pending', 'rejected']).default('pending'),
  notes:     z.string().max(500).optional(),
})

// ── Meeting ───────────────────────────────────────────────────
export const meetingSchema = z.object({
  title:     z.string().min(2).max(200).trim(),
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  location:  z.string().max(200).optional(),
  attendees: z.array(z.string().uuid()).default([]),
  raw_notes: z.string().max(10_000).optional(),
})

// ── Auth ──────────────────────────────────────────────────────
export const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

export const signupSchema = z.object({
  full_name: z.string().min(2).max(100).trim(),
  email:     z.string().email(),
  password:  z.string().min(8).max(128),
})

// ── Helper ────────────────────────────────────────────────────
export type StokvelInput      = z.infer<typeof stokvelSchema>
export type MemberInput       = z.infer<typeof memberSchema>
export type ContributionInput = z.infer<typeof contributionSchema>
export type MeetingInput      = z.infer<typeof meetingSchema>
