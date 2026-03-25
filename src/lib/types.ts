export type TeamMember = {
  id: string
  auth_user_id: string | null
  name: string
  email: string
  role: string
  primary_work: string
  is_admin: boolean
  monthly_salary: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Client = {
  id: string
  name: string
  status: 'active' | 'inactive' | 'prospect'
  services: string[]
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type WorkLog = {
  id: string
  team_member_id: string
  client_id: string | null
  date: string
  hours: number
  work_type: 'serving' | 'acquisition' | 'internal'
  service_category: string
  description: string
  created_at: string
  // Joined fields
  team_member?: TeamMember
  client?: Client
}

export type Attendance = {
  id: string
  team_member_id: string
  date: string
  status: 'present' | 'absent' | 'half_day' | 'leave'
  note: string | null
  created_at: string
  team_member?: TeamMember
}

export type Expense = {
  id: string
  client_id: string | null
  recorded_by: string
  category: 'ad_spend' | 'tools' | 'travel' | 'freelance' | 'salary' | 'rent' | 'other'
  cost_type: 'serving' | 'acquisition' | 'overhead'
  amount: number
  description: string
  date: string
  created_at: string
  client?: Client
  recorder?: TeamMember
}

export const SERVICE_CATEGORIES = [
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'seo', label: 'SEO' },
  { value: 'email_marketing', label: 'Email Marketing' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'graphics', label: 'Graphics Design' },
  { value: 'video_shooting', label: 'Video Shooting' },
  { value: 'video_editing', label: 'Video Editing' },
  { value: 'web_dev', label: 'Web Development' },
  { value: 'app_dev', label: 'App Development' },
  { value: 'client_management', label: 'Client Management' },
  { value: 'research', label: 'Research' },
  { value: 'admin', label: 'Admin' },
  { value: 'other', label: 'Other' },
] as const

export const EXPENSE_CATEGORIES = [
  { value: 'ad_spend', label: 'Ad Spend' },
  { value: 'tools', label: 'Tools & Subscriptions' },
  { value: 'travel', label: 'Travel' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'salary', label: 'Salary' },
  { value: 'rent', label: 'Rent' },
  { value: 'other', label: 'Other' },
] as const

export const WORK_TYPES = [
  { value: 'serving', label: 'Serving Client' },
  { value: 'acquisition', label: 'Client Acquisition' },
  { value: 'internal', label: 'Internal Work' },
] as const

export const COST_TYPES = [
  { value: 'serving', label: 'Serving' },
  { value: 'acquisition', label: 'Acquisition' },
  { value: 'overhead', label: 'Overhead' },
] as const
