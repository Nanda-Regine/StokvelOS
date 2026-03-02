// ============================================================
// StokvelOS — Global Types
// ============================================================

export type StokvelType = 'general' | 'grocery' | 'burial' | 'investment' | 'christmas' | 'other'
export type PayoutFrequency = 'monthly' | 'quarterly' | 'annually'
export type MemberStatus = 'active' | 'inactive' | 'suspended'
export type ContributionStatus = 'confirmed' | 'pending' | 'rejected'
export type PaymentMethod = 'cash' | 'eft' | 'card' | 'snapscan' | 'ozow'
export type PaymentStatus = 'paid' | 'pending' | 'late' | 'outstanding'
export type UserRole = 'admin' | 'treasurer' | 'secretary' | 'member'

// ── Supabase DB Row Types ─────────────────────────────────────

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export interface Stokvel {
  id: string
  name: string
  type: StokvelType
  province: string | null
  description: string | null
  monthly_amount: number
  payout_frequency: PayoutFrequency
  payout_order: 'draw' | 'rotation' | 'seniority' | 'need'
  start_date: string | null
  admin_id: string
  created_at: string
  updated_at: string
  member_count?: number
  pot_total?: number
}

export interface StokvelMember {
  id: string
  stokvel_id: string
  user_id: string | null
  name: string
  email: string | null
  phone: string | null
  monthly_amount: number | null
  payout_position: number | null
  status: MemberStatus
  role: UserRole
  joined_at: string
  created_at: string
  updated_at: string
  // Computed
  payment_status?: PaymentStatus
  total_paid_year?: number
}

export interface Contribution {
  id: string
  stokvel_id: string
  member_id: string
  amount: number
  date: string
  method: PaymentMethod
  status: ContributionStatus
  notes: string | null
  recorded_by: string
  recorded_at: string
  created_at: string
  // Joined
  member?: StokvelMember
}

export interface Meeting {
  id: string
  stokvel_id: string
  title: string
  date: string
  location: string | null
  attendees: string[] // member IDs
  raw_notes: string | null
  formatted_minutes: string | null
  ai_summary: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface Payout {
  id: string
  stokvel_id: string
  member_id: string
  amount: number
  date: string
  status: 'scheduled' | 'paid' | 'skipped'
  notes: string | null
  created_at: string
  // Joined
  member?: StokvelMember
}

export interface Announcement {
  id: string
  stokvel_id: string
  title: string
  body: string
  type: 'info' | 'warning' | 'success'
  pinned: boolean
  created_by: string
  created_at: string
}

// ── App State Types ───────────────────────────────────────────

export interface DashboardStats {
  potTotal: number
  memberCount: number
  paidThisMonth: number
  totalThisMonth: number
  complianceRate: number
  nextPayout: StokvelMember | null
  outstandingCount: number
  yearlyTarget: number
  yearlyCollected: number
}

export interface HealthReport {
  summary: string
  complianceRate: number
  trend: 'up' | 'down' | 'stable'
  recommendation: string
  generatedAt: string
}

export interface AIReminder {
  memberId: string
  memberName: string
  amount: number
  message: string
  whatsappUrl: string
}

export interface MonthlyData {
  month: string
  confirmed: number
  pending: number
  target: number
}

export interface MemberYearlyData {
  member: StokvelMember
  months: (number | null)[]
  totalPaid: number
  target: number
  complianceRate: number
}

// ── Form Types ────────────────────────────────────────────────

export interface SetupFormData {
  name: string
  type: StokvelType
  province: string
  description: string
  monthly_amount: number
  payout_frequency: PayoutFrequency
  payout_order: string
  start_date: string
  admin_name: string
}

export interface MemberFormData {
  name: string
  email: string
  phone: string
  monthly_amount?: number
  payout_position?: number
  status: MemberStatus
  role: UserRole
}

export interface ContributionFormData {
  member_id: string
  amount: number
  date: string
  method: PaymentMethod
  status: ContributionStatus
  notes?: string
}

export interface MeetingFormData {
  title: string
  date: string
  location: string
  attendees: string[]
  raw_notes: string
}

// ── API Response Types ────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null
  error: string | null
  success: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
}
