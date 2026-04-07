import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, isAfter } from 'date-fns'
import { Clock, Receipt, Building2, Users, ArrowRight, AlertTriangle, Zap, CalendarCheck } from 'lucide-react'
import Link from 'next/link'
import { fmtNPR, getCategoryLabel } from '@/lib/types'
import {
  formatNepaliFullDate,
  formatNepaliMonthYear,
  formatNepaliTime,
} from '@/lib/nepali-date'
import MemberDashboard from '@/components/member-dashboard'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'शुभ बिहानी'
  if (hour < 17) return 'शुभ दिउँसो'
  return 'शुभ साँझ'
}

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
  const greeting = getGreeting()
  const firstName = member.name.split(' ')[0]

  // ─── ADMIN DASHBOARD ────────────────────────────────────────
  if (member.is_admin) {
    const [
      { data: workLogs },
      { data: expenses },
      { data: clients },
      { data: teamMembers },
      { data: todayLogs },
      { data: todayAttendance },
      { data: overdueTasks },
    ] = await Promise.all([
      supabase
        .from('work_logs')
        .select('hours, client_id, team_member_id, work_type, service_category, team_member:team_members(name, monthly_salary), client:clients(name, color)')
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
        .select('hours, created_at, team_member_id, team_member:team_members(name), client:clients(name, color), service_category')
        .eq('date', today)
        .order('created_at', { ascending: false }),
      supabase
        .from('attendance')
        .select('team_member_id')
        .eq('date', today),
      supabase
        .from('tasks')
        .select('id, title, due_date, assigned_to, assignee:team_members!tasks_assigned_to_fkey(name), client:clients(name)')
        .eq('status', 'open')
        .lt('due_date', today),
    ])

    // Check for overdue urgent tasks and create notifications
    const { data: overdueUrgent } = await supabase
      .from('tasks')
      .select('id, title, assigned_to, deadline_time')
      .eq('priority', 'urgent')
      .eq('status', 'open')
      .not('deadline_time', 'is', null)
      .lt('deadline_time', new Date().toISOString())

    if (overdueUrgent && overdueUrgent.length > 0) {
      for (const task of overdueUrgent) {
        const { data: existingNotif } = await supabase
          .from('notifications')
          .select('id')
          .eq('task_id', task.id)
          .eq('type', 'reminder')
          .gte('created_at', task.deadline_time!)
          .limit(1)

        if (!existingNotif || existingNotif.length === 0) {
          await supabase.from('notifications').insert({
            recipient_id: task.assigned_to,
            type: 'reminder',
            title: 'Urgent task overdue!',
            body: `"${task.title}" is past its deadline`,
            task_id: task.id,
            link: '/tasks',
            is_read: false,
          })
        }
      }
    }

    const allMembers = teamMembers || []
    const totalTeam = allMembers.length

    // Today's pulse calculations
    const todayLogMemberIds = new Set((todayLogs || []).map(l => l.team_member_id))
    const loggedCount = todayLogMemberIds.size
    const todayAttendanceIds = new Set((todayAttendance || []).map(a => a.team_member_id))
    const presentCount = todayAttendanceIds.size
    const overdueCount = (overdueTasks || []).length

    // Who hasn't logged today
    const notLoggedMembers = allMembers.filter(m => !todayLogMemberIds.has(m.id))

    // Overview calculations
    const totalHours = (workLogs || []).reduce((s, l) => s + Number(l.hours), 0)
    const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0)

    // Client cost breakdown
    type ClientCost = {
      name: string
      color: string
      hours: number
      laborCost: number
      expenses: number
      total: number
    }
    const clientCosts: Record<string, ClientCost> = {}
    for (const c of clients || []) {
      clientCosts[c.id] = { name: c.name, color: c.color || '#6B7280', hours: 0, laborCost: 0, expenses: 0, total: 0 }
    }

    for (const log of workLogs || []) {
      if (log.client_id && log.work_type === 'serving' && clientCosts[log.client_id]) {
        const salary = Number((log.team_member as unknown as { monthly_salary: number })?.monthly_salary || 0)
        const hourlyRate = salary / 176
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

    const clientCostList = Object.values(clientCosts).filter(cc => cc.hours > 0 || cc.expenses > 0)

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {greeting}, {firstName}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{formatNepaliFullDate(now)}</p>
        </div>

        {/* Today's Pulse */}
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 border border-blue-200/60 p-5">
          <h2 className="text-sm font-semibold text-indigo-800 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            आजको स्थिति
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/80 backdrop-blur rounded-xl p-4 text-center">
              <div className="text-2xl md:text-3xl font-bold text-indigo-700">
                {loggedCount}/{totalTeam}
              </div>
              <div className="text-xs text-indigo-600 font-medium mt-1">Logged</div>
            </div>
            <div className="bg-white/80 backdrop-blur rounded-xl p-4 text-center">
              <div className="text-2xl md:text-3xl font-bold text-indigo-700">
                {presentCount}/{totalTeam}
              </div>
              <div className="text-xs text-indigo-600 font-medium mt-1">Present</div>
            </div>
            <div className="bg-white/80 backdrop-blur rounded-xl p-4 text-center">
              <div className={`text-2xl md:text-3xl font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-indigo-700'}`}>
                {overdueCount}
              </div>
              <div className={`text-xs font-medium mt-1 ${overdueCount > 0 ? 'text-red-500' : 'text-indigo-600'}`}>
                {overdueCount === 1 ? 'task overdue' : 'tasks overdue'}
              </div>
            </div>
          </div>
          {notLoggedMembers.length > 0 && (
            <div className="mt-3 flex items-start gap-2 text-sm text-orange-700 bg-orange-50/80 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                <span className="font-medium">Haven&apos;t logged today:</span>{' '}
                {notLoggedMembers.map(m => m.name.split(' ')[0]).join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-gray-500 font-medium">Team Hours</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{totalHours}h</div>
            <div className="text-xs text-gray-400 mt-1">{formatNepaliMonthYear(now)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="w-4 h-4 text-green-600" />
              <span className="text-xs text-gray-500 font-medium">Total Expenses</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{fmtNPR(totalExpenses)}</div>
            <div className="text-xs text-gray-400 mt-1">{formatNepaliMonthYear(now)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-purple-600" />
              <span className="text-xs text-gray-500 font-medium">Active Clients</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{clients?.length || 0}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-orange-600" />
              <span className="text-xs text-gray-500 font-medium">Team Size</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{totalTeam}</div>
          </div>
        </div>

        {/* Client Costs Table */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">क्लाइन्ट लागत &mdash; {formatNepaliMonthYear(now)}</h2>
            <Link href="/clients" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {clientCostList.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No client activity this month yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 md:-mx-5">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="pb-3 pl-4 md:pl-5 font-medium">Client</th>
                    <th className="pb-3 font-medium text-right">Hours</th>
                    <th className="pb-3 font-medium text-right">Labor Cost</th>
                    <th className="pb-3 font-medium text-right">Direct Expenses</th>
                    <th className="pb-3 font-medium text-right">Total Cost</th>
                    <th className="pb-3 font-medium text-right">Min Price (1.3x)</th>
                    <th className="pb-3 pr-4 md:pr-5 font-medium text-right">Price (1.8x)</th>
                  </tr>
                </thead>
                <tbody>
                  {clientCostList.map((cc) => (
                    <tr key={cc.name} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="py-3 pl-4 md:pl-5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cc.color }}
                          />
                          <span className="font-medium text-gray-900">{cc.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-gray-700">{cc.hours}h</td>
                      <td className="py-3 text-right text-gray-700">{fmtNPR(cc.laborCost)}</td>
                      <td className="py-3 text-right text-gray-700">{fmtNPR(cc.expenses)}</td>
                      <td className="py-3 text-right font-semibold text-gray-900">{fmtNPR(cc.total)}</td>
                      <td className="py-3 text-right text-green-600 font-medium">{fmtNPR(cc.total * 1.3)}</td>
                      <td className="py-3 pr-4 md:pr-5 text-right text-emerald-700 font-semibold">{fmtNPR(cc.total * 1.8)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Today's Activity Feed */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Today&apos;s Activity</h2>
          {(todayLogs || []).length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No work logged today yet.</p>
          ) : (
            <div className="space-y-2">
              {(todayLogs || []).map((log, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 text-sm py-2.5 px-3 rounded-lg hover:bg-gray-50 border-b border-gray-50 last:border-0"
                >
                  <span className="font-medium text-gray-900 w-28 truncate">
                    {(log.team_member as unknown as { name: string })?.name}
                  </span>
                  <span className="text-gray-300">&rarr;</span>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {(log.client as unknown as { name: string; color?: string })?.name ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: (log.client as unknown as { color: string })?.color || '#6B7280' }}
                        />
                        <span className="text-gray-700 truncate">
                          {(log.client as unknown as { name: string })?.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">Internal</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {getCategoryLabel(log.service_category)}
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                    {log.hours}h
                  </span>
                  <span className="text-xs text-gray-400 shrink-0 hidden md:inline">
                    {formatNepaliTime(new Date(log.created_at))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── MEMBER DASHBOARD ──────────────────────────────────────
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const [
    { data: myLogs },
    { data: myAttendance },
    { data: recentLogs },
    { data: weekLogs },
    { data: streakLogs },
    { data: tasks },
    { data: weeklyGoalTasks },
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
      .select('*, client:clients(name, color)')
      .eq('team_member_id', member.id)
      .order('date', { ascending: false })
      .limit(5),
    supabase
      .from('work_logs')
      .select('hours, service_category')
      .eq('team_member_id', member.id)
      .gte('date', weekStart)
      .lte('date', weekEnd),
    supabase
      .from('work_logs')
      .select('date')
      .eq('team_member_id', member.id)
      .order('date', { ascending: false })
      .limit(90),
    supabase
      .from('tasks')
      .select('*, assignee:team_members!assigned_to(name), assigner:team_members!assigned_by(name), client:clients(name, color)')
      .eq('assigned_to', member.id)
      .eq('status', 'open'),
    supabase
      .from('tasks')
      .select('*, assignee:team_members!assigned_to(name), assigner:team_members!assigned_by(name), client:clients(name, color)')
      .eq('assigned_to', member.id)
      .eq('is_weekly_goal', true)
      .gte('due_date', weekStart)
      .lte('due_date', weekEnd),
  ])

  // Personal stats
  const myTotalHours = (myLogs || []).reduce((s, l) => s + Number(l.hours), 0)
  const presentDays = (myAttendance || []).filter(a => a.status === 'present').length
  const halfDays = (myAttendance || []).filter(a => a.status === 'half_day').length
  const totalDays = (myAttendance || []).length
  const attendanceRate = totalDays > 0 ? Math.round(((presentDays + halfDays * 0.5) / totalDays) * 100) : 0

  // Weekly skills breakdown
  const weeklyByCategory: Record<string, number> = {}
  for (const log of weekLogs || []) {
    const cat = log.service_category
    weeklyByCategory[cat] = (weeklyByCategory[cat] || 0) + Number(log.hours)
  }
  const weeklyBreakdown = Object.entries(weeklyByCategory)
    .map(([cat, hours]) => ({ category: cat, hours }))
    .sort((a, b) => b.hours - a.hours)

  // Logging streak: count consecutive days with at least one work_log
  let streak = 0
  if (streakLogs && streakLogs.length > 0) {
    const uniqueDates = [...new Set(streakLogs.map(l => l.date))].sort().reverse()
    const mostRecent = uniqueDates[0]
    const yesterday = format(subDays(now, 1), 'yyyy-MM-dd')
    if (mostRecent === today || mostRecent === yesterday) {
      streak = 1
      for (let i = 1; i < uniqueDates.length; i++) {
        const expected = format(subDays(new Date(uniqueDates[i - 1]), 1), 'yyyy-MM-dd')
        if (uniqueDates[i] === expected) {
          streak++
        } else {
          break
        }
      }
    }
  }

  const weekTotalHours = (weekLogs || []).reduce((s, l) => s + Number(l.hours), 0)

  return (
    <MemberDashboard
      memberId={member.id}
      firstName={firstName}
      greeting={greeting}
      now={now.toISOString()}
      myTotalHours={myTotalHours}
      presentDays={presentDays}
      attendanceRate={attendanceRate}
      streak={streak}
      weekTotalHours={weekTotalHours}
      weeklyBreakdown={weeklyBreakdown}
      recentLogs={recentLogs || []}
      tasks={tasks || []}
      weeklyGoalTasks={weeklyGoalTasks || []}
    />
  )
}
