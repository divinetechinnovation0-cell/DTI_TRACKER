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
  color: string
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
  team_member?: { name: string; monthly_salary?: number }
  client?: { name: string; color?: string }
}

export type Attendance = {
  id: string
  team_member_id: string
  date: string
  status: 'present' | 'absent' | 'half_day' | 'leave'
  note: string | null
  check_in_time: string | null
  created_at: string
  team_member?: { name: string }
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
  client?: { name: string }
  recorder?: { name: string }
}

export type Task = {
  id: string
  title: string
  description: string
  client_id: string | null
  assigned_to: string
  assigned_by: string
  status: 'open' | 'done'
  priority: 'normal' | 'urgent'
  due_date: string | null
  is_weekly_goal: boolean
  week_start: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  assignee?: { name: string }
  assigner?: { name: string }
  client?: { name: string; color?: string }
}

export type Notification = {
  id: string
  recipient_id: string
  sender_id: string | null
  type: 'task_assigned' | 'task_done' | 'ping' | 'reminder' | 'system'
  title: string
  body: string
  task_id: string | null
  link: string
  is_read: boolean
  created_at: string
  sender?: { name: string }
}

export type ClientPackage = {
  id: string
  client_id: string
  service_category: string
  quantity_promised: number
  unit: string
  hours_budgeted: number
  price_npr: number
  billing_cycle: 'monthly' | 'quarterly' | 'one_time'
  start_date: string
  end_date: string | null
  is_active: boolean
  notes: string
  created_at: string
  updated_at: string
}

export type ClientDeliverable = {
  id: string
  package_id: string | null
  client_id: string
  title: string
  status: 'pending' | 'in_progress' | 'review' | 'delivered' | 'cancelled'
  assigned_to: string | null
  due_date: string | null
  delivery_date: string | null
  month: string | null
  notes: string
  created_at: string
  updated_at: string
  assignee?: { name: string }
}

export type ContentCalendar = {
  id: string
  client_id: string
  title: string
  content_type: string
  platform: string | null
  scheduled_date: string
  scheduled_time: string | null
  status: 'idea' | 'planned' | 'in_production' | 'ready' | 'published' | 'cancelled'
  assigned_to: string | null
  description: string
  created_by: string | null
  created_at: string
  updated_at: string
  client?: { name: string; color?: string }
  assignee?: { name: string }
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
  { value: 'photo_shoot', label: 'Photoshoot' },
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

export const CONTENT_TYPES = [
  { value: 'social_post', label: 'Social Post' },
  { value: 'reel', label: 'Reel' },
  { value: 'story', label: 'Story' },
  { value: 'blog', label: 'Blog' },
  { value: 'email_campaign', label: 'Email Campaign' },
  { value: 'ad_creative', label: 'Ad Creative' },
  { value: 'video', label: 'Video' },
  { value: 'shoot', label: 'Shoot' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'other', label: 'Other' },
] as const

export const PLATFORMS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'website', label: 'Website' },
  { value: 'email', label: 'Email' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'other', label: 'Other' },
] as const

export const DELIVERABLE_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
] as const

export const getCategoryLabel = (val: string) =>
  SERVICE_CATEGORIES.find(c => c.value === val)?.label || val

export const fmtNPR = (n: number) => `रू ${Math.round(n).toLocaleString()}`
