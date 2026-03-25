import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { Clock, Receipt, Building2, Users, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('team_members')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!member) redirect('/login')

  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')
  const today = format(now, 'yyyy-MM-dd')

  if (member.is_admin) {
    // Admin dashboard data
    const [
      { data: workLogs },
      { data: expenses },
      { data: clients },
      { data: teamMembers },
      { data: todayLogs },
    ] = await Promise.all([
      supabase
        .from('work_logs')
        .select('hours, client_id, team_member_id, work_type, team_member:team_members(name, monthly_salary), client:clients(name)')
        .gte('date', monthStart)
        .lte('date', monthEnd),
      supabase
        .from('expenses')
        .select('amount, cost_type, client_id, category, client:clients(name)')
        .gte('date', monthStart)
        .lte('date', monthEnd),
      supabase.from('clients').select('*').eq('status', 'active'),
      supabase.from('team_members').select('*').eq('is_active', true),
      supabase
        .from('work_logs')
        .select('hours, team_member:team_members(name), client:clients(name), service_category')
        .eq('date', today),
    ])

    const totalHours = (workLogs || []).reduce((s, l) => s + Number(l.hours), 0)
    const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0)

    // Client cost breakdown
    type ClientCost = { name: string; hours: number; laborCost: number; expenses: number; total: number }
    const clientCosts: Record<string, ClientCost> = {}
    for (const c of clients || []) {
      clientCosts[c.id] = { name: c.name, hours: 0, laborCost: 0, expenses: 0, total: 0 }
    }

    for (const log of workLogs || []) {
      if (log.client_id && log.work_type === 'serving' && clientCosts[log.client_id]) {
        const hourlyRate = Number((log.team_member as unknown as { monthly_salary: number })?.monthly_salary || 0) / 176
        clientCosts[log.client_id].hours += Number(log.hours)
        clientCosts[log.client_id].laborCost += Number(log.hours) * hourlyRate
      }
    }

    for (const exp of expenses || []) {
      if (exp.client_id && exp.cost_type === 'serving' && clientCosts[exp.client_id]) {
        clientCosts[exp.client_id].expenses += Number(exp.amount)
      }
    }

    for (const id of Object.keys(clientCosts)) {
      clientCosts[id].total = clientCosts[id].laborCost + clientCosts[id].expenses
    }

    const fmtNPR = (n: number) => `रू ${Math.round(n).toLocaleString()}`

    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Welcome, {member.name.split(' ')[0]}</h1>
          <p className="text-gray-500 text-sm">{format(now, 'EEEE, MMMM d, yyyy')}</p>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-gray-500">Team Hours</span>
            </div>
            <div className="text-2xl font-bold">{totalHours}h</div>
            <div className="text-xs text-gray-400">{format(now, 'MMM yyyy')}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="w-4 h-4 text-green-600" />
              <span className="text-xs text-gray-500">Expenses</span>
            </div>
            <div className="text-2xl font-bold">{fmtNPR(totalExpenses)}</div>
            <div className="text-xs text-gray-400">{format(now, 'MMM yyyy')}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-purple-600" />
              <span className="text-xs text-gray-500">Active Clients</span>
            </div>
            <div className="text-2xl font-bold">{clients?.length || 0}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-orange-600" />
              <span className="text-xs text-gray-500">Team Size</span>
            </div>
            <div className="text-2xl font-bold">{teamMembers?.length || 0}</div>
          </div>
        </div>

        {/* Client costs */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Client Costs — {format(now, 'MMM yyyy')}</h2>
            <Link href="/clients" className="text-sm text-blue-600 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {Object.values(clientCosts).length === 0 ? (
            <p className="text-sm text-gray-400">No active clients</p>
          ) : (
            <div className="space-y-3">
              {Object.values(clientCosts).map((cc) => (
                <div key={cc.name} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="font-medium text-sm">{cc.name}</div>
                    <div className="text-xs text-gray-400">{cc.hours}h logged · Labor: {fmtNPR(cc.laborCost)} · Expenses: {fmtNPR(cc.expenses)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{fmtNPR(cc.total)}</div>
                    <div className="text-xs text-green-600">Min price: {fmtNPR(cc.total * 1.3)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold mb-3">Today&apos;s Activity</h2>
          {(todayLogs || []).length === 0 ? (
            <p className="text-sm text-gray-400">No work logged today yet</p>
          ) : (
            <div className="space-y-2">
              {(todayLogs || []).map((log, i) => (
                <div key={i} className="flex items-center gap-3 text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <span className="font-medium w-24 truncate">{(log.team_member as unknown as { name: string })?.name}</span>
                  <span className="text-gray-400">&rarr;</span>
                  <span className="text-gray-600 truncate">
                    {(log.client as unknown as { name: string })?.name || 'Internal'}
                  </span>
                  <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{log.hours}h</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Regular member dashboard
  const [
    { data: myLogs },
    { data: myAttendance },
    { data: recentLogs },
  ] = await Promise.all([
    supabase
      .from('work_logs')
      .select('hours')
      .eq('team_member_id', member.id)
      .gte('date', monthStart)
      .lte('date', monthEnd),
    supabase
      .from('attendance')
      .select('status')
      .eq('team_member_id', member.id)
      .gte('date', monthStart)
      .lte('date', monthEnd),
    supabase
      .from('work_logs')
      .select('*, client:clients(name)')
      .eq('team_member_id', member.id)
      .order('date', { ascending: false })
      .limit(5),
  ])

  const myTotalHours = (myLogs || []).reduce((s, l) => s + Number(l.hours), 0)
  const presentDays = (myAttendance || []).filter(a => a.status === 'present').length
  const halfDays = (myAttendance || []).filter(a => a.status === 'half_day').length
  const totalDays = (myAttendance || []).length
  const attendanceRate = totalDays > 0 ? Math.round(((presentDays + halfDays * 0.5) / totalDays) * 100) : 0

  const getCategoryLabel = (val: string) => {
    const cats: Record<string, string> = {
      meta_ads: 'Meta Ads', google_ads: 'Google Ads', seo: 'SEO',
      email_marketing: 'Email Marketing', social_media: 'Social Media',
      graphics: 'Graphics', video_shooting: 'Video Shooting',
      video_editing: 'Video Editing', web_dev: 'Web Dev',
      app_dev: 'App Dev', client_management: 'Client Mgmt',
      research: 'Research', admin: 'Admin', other: 'Other',
    }
    return cats[val] || val
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Welcome, {member.name.split(' ')[0]}</h1>
        <p className="text-gray-500 text-sm">{format(now, 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{myTotalHours}h</div>
          <div className="text-xs text-blue-600">Hours</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{presentDays}d</div>
          <div className="text-xs text-green-600">Present</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-purple-700">{attendanceRate}%</div>
          <div className="text-xs text-purple-600">Attendance</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link
          href="/work-log"
          className="bg-blue-600 text-white rounded-xl p-4 text-center hover:bg-blue-700 transition"
        >
          <Clock className="w-6 h-6 mx-auto mb-1" />
          <span className="text-sm font-medium">Log Work</span>
        </Link>
        <Link
          href="/attendance"
          className="bg-green-600 text-white rounded-xl p-4 text-center hover:bg-green-700 transition"
        >
          <Users className="w-6 h-6 mx-auto mb-1" />
          <span className="text-sm font-medium">Mark Attendance</span>
        </Link>
      </div>

      {/* Recent logs */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recent Work</h2>
          <Link href="/work-log" className="text-sm text-blue-600 flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {(recentLogs || []).length === 0 ? (
          <p className="text-sm text-gray-400">No work logged yet. Start by logging your first entry!</p>
        ) : (
          <div className="space-y-2">
            {(recentLogs || []).map((log) => (
              <div key={log.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <div className="text-sm font-medium">
                    {(log.client as unknown as { name: string })?.name || 'Internal'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {getCategoryLabel(log.service_category)} · {format(new Date(log.date), 'MMM d')}
                  </div>
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{log.hours}h</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
