'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  formatNepaliFullDate,
  formatNepaliShortDate,
  formatNepaliDay,
  toNepaliDigits,
  NEPALI_DAYS_SHORT,
} from '@/lib/nepali-date'
import { getCategoryLabel } from '@/lib/types'
import {
  Clock,
  CalendarCheck,
  Zap,
  ArrowRight,
  Circle,
  CheckCircle2,
  Target,
  CalendarDays,
  ListChecks,
} from 'lucide-react'
import Link from 'next/link'
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isToday,
} from 'date-fns'

type Props = {
  memberId: string
  firstName: string
  greeting: string
  now: string // ISO string
  myTotalHours: number
  presentDays: number
  attendanceRate: number
  streak: number
  weekTotalHours: number
  weeklyBreakdown: { category: string; hours: number }[]
  recentLogs: any[]
  tasks: any[]
  weeklyGoalTasks: any[]
}

export default function MemberDashboard({
  memberId,
  firstName,
  greeting,
  now: nowISO,
  myTotalHours,
  presentDays,
  attendanceRate,
  streak,
  weekTotalHours,
  weeklyBreakdown,
  recentLogs,
  tasks: initialTasks,
  weeklyGoalTasks: initialGoalTasks,
}: Props) {
  const now = new Date(nowISO)
  const supabase = createClient()

  const [tasks, setTasks] = useState(initialTasks)
  const [goalTasks, setGoalTasks] = useState(initialGoalTasks)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // ── Toggle task done ──
  async function toggleTaskDone(task: any) {
    if (togglingId) return
    setTogglingId(task.id)
    try {
      const newStatus = task.status === 'open' ? 'done' : 'open'
      const completedAt = newStatus === 'done' ? new Date().toISOString() : null

      await supabase
        .from('tasks')
        .update({ status: newStatus, completed_at: completedAt })
        .eq('id', task.id)

      // Insert notification if assigned_by is someone else
      if (newStatus === 'done' && task.assigned_by !== memberId) {
        await supabase.from('notifications').insert({
          recipient_id: task.assigned_by,
          sender_id: memberId,
          type: 'task_done',
          title: 'Task completed',
          body: `Task completed: ${task.title}`,
          task_id: task.id,
          link: '/tasks',
        })
      }

      // Update local state
      const updater = (t: any) =>
        t.id === task.id
          ? { ...t, status: newStatus, completed_at: completedAt }
          : t

      setTasks((prev) => prev.map(updater))
      setGoalTasks((prev) => prev.map(updater))
    } finally {
      setTogglingId(null)
    }
  }

  // ── Weekly goals progress ──
  const goalsDone = goalTasks.filter((t) => t.status === 'done').length
  const goalsTotal = goalTasks.length
  const goalsPercent = goalsTotal > 0 ? Math.round((goalsDone / goalsTotal) * 100) : 0

  // ── Daily schedule: group tasks by day of the current week ──
  const weekStartDate = startOfWeek(now, { weekStartsOn: 1 })
  const weekEndDate = endOfWeek(now, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStartDate, end: weekEndDate })

  function getTasksForDay(day: Date) {
    const dayStr = format(day, 'yyyy-MM-dd')
    return tasks.filter((t: any) => t.due_date === dayStr)
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {greeting}, {firstName}
        </h1>
        <p className="text-gray-500 text-sm mt-1">{formatNepaliFullDate(now)}</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/work-log"
          className="bg-blue-600 text-white rounded-xl p-5 text-center hover:bg-blue-700 transition-colors active:scale-[0.98] flex flex-col items-center gap-2"
        >
          <Clock className="w-7 h-7" />
          <span className="font-semibold">Log Work</span>
        </Link>
        <Link
          href="/attendance"
          className="bg-green-600 text-white rounded-xl p-5 text-center hover:bg-green-700 transition-colors active:scale-[0.98] flex flex-col items-center gap-2"
        >
          <CalendarCheck className="w-7 h-7" />
          <span className="font-semibold">Mark Attendance</span>
        </Link>
      </div>

      {/* Personal Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{myTotalHours}h</div>
          <div className="text-xs text-gray-500 font-medium mt-1">Hours this month</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{presentDays}d</div>
          <div className="text-xs text-gray-500 font-medium mt-1">Days present</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-purple-700">{attendanceRate}%</div>
          <div className="text-xs text-gray-500 font-medium mt-1">Attendance rate</div>
        </div>
      </div>

      {/* Logging Streak */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200/60 p-4 flex items-center gap-4">
        <div className="bg-amber-100 rounded-full p-3">
          <Zap className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <div className="text-2xl font-bold text-amber-800">
            {streak} {streak === 1 ? 'day' : 'days'}
          </div>
          <div className="text-xs text-amber-700 font-medium">
            {streak > 0 ? 'Logging streak! Keep it going.' : 'Log today to start a streak!'}
          </div>
        </div>
      </div>

      {/* ── Assigned Work ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-blue-600" />
            Assigned Work
          </h2>
          <Link
            href="/tasks"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {tasks.filter((t: any) => t.status === 'open').length === 0 ? (
          <p className="text-sm text-gray-400 py-2 text-center">
            No open tasks assigned to you.
          </p>
        ) : (
          <div className="space-y-1.5">
            {tasks
              .filter((t: any) => t.status === 'open')
              .map((task: any) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 py-2.5 px-2 rounded-lg hover:bg-gray-50 border-b border-gray-50 last:border-0"
                >
                  <button
                    onClick={() => toggleTaskDone(task)}
                    disabled={togglingId === task.id}
                    className="mt-0.5 shrink-0 text-gray-300 hover:text-green-500 transition-colors disabled:opacity-50"
                  >
                    {task.status === 'done' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {task.title}
                      </span>
                      {task.priority === 'urgent' && (
                        <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold uppercase shrink-0">
                          Urgent
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {task.client && (
                        <div className="flex items-center gap-1">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              backgroundColor: task.client.color || '#6B7280',
                            }}
                          />
                          <span className="text-xs text-gray-500">
                            {task.client.name}
                          </span>
                        </div>
                      )}
                      {task.due_date && (
                        <span className="text-xs text-gray-400">
                          Due {formatNepaliFullDate(new Date(task.due_date + 'T00:00:00'))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ── Weekly Goals ── */}
      {goalsTotal > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-600" />
              Weekly Goals
            </h2>
            <span className="text-xs text-gray-500 font-medium">
              {toNepaliDigits(goalsDone)}/{toNepaliDigits(goalsTotal)}
            </span>
          </div>
          {/* Progress bar */}
          <div className="mb-3">
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className="bg-indigo-500 rounded-full h-2.5 transition-all"
                style={{ width: `${goalsPercent}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1 text-right">
              {toNepaliDigits(goalsPercent)}%
            </div>
          </div>
          <div className="space-y-1.5">
            {goalTasks.map((task: any) => (
              <div
                key={task.id}
                className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50"
              >
                <button
                  onClick={() => toggleTaskDone(task)}
                  disabled={togglingId === task.id}
                  className="shrink-0 transition-colors disabled:opacity-50"
                >
                  {task.status === 'done' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300 hover:text-green-500" />
                  )}
                </button>
                <span
                  className={`text-sm ${
                    task.status === 'done'
                      ? 'text-gray-400 line-through'
                      : 'text-gray-800 font-medium'
                  }`}
                >
                  {task.title}
                </span>
                {task.priority === 'urgent' && task.status !== 'done' && (
                  <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold uppercase shrink-0">
                    Urgent
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Daily Schedule ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <CalendarDays className="w-4 h-4 text-teal-600" />
          Daily Schedule
        </h2>
        <div className="space-y-1">
          {weekDays.map((day) => {
            const dayTasks = getTasksForDay(day)
            const today = isToday(day)
            return (
              <div
                key={day.toISOString()}
                className={`rounded-lg px-3 py-2.5 ${
                  today
                    ? 'bg-teal-50 border border-teal-200/60'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-semibold ${
                      today ? 'text-teal-700' : 'text-gray-500'
                    }`}
                  >
                    {formatNepaliDay(day)}
                  </span>
                  {today && (
                    <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-semibold">
                      Today
                    </span>
                  )}
                </div>
                {dayTasks.length === 0 ? (
                  <span className="text-xs text-gray-300 ml-1">&mdash;</span>
                ) : (
                  <div className="space-y-1 ml-1">
                    {dayTasks.map((task: any) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        {task.status === 'done' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                        )}
                        <span
                          className={
                            task.status === 'done'
                              ? 'text-gray-400 line-through'
                              : 'text-gray-700'
                          }
                        >
                          {task.title}
                        </span>
                        {task.client && (
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{
                              backgroundColor: task.client.color || '#6B7280',
                            }}
                          />
                        )}
                        {task.priority === 'urgent' && task.status !== 'done' && (
                          <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.5 rounded font-semibold">
                            !
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* My Week */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">My Week</h2>
          <span className="text-xs text-gray-400 font-medium">
            {weekTotalHours}h total
          </span>
        </div>
        {weeklyBreakdown.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">
            No work logged this week yet.
          </p>
        ) : (
          <div className="space-y-2.5">
            {weeklyBreakdown.map(({ category, hours }) => {
              const pct =
                weekTotalHours > 0
                  ? Math.round((hours / weekTotalHours) * 100)
                  : 0
              return (
                <div key={category}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">
                      {getCategoryLabel(category)}
                    </span>
                    <span className="text-gray-500">
                      {hours}h{' '}
                      <span className="text-gray-400">({pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-blue-500 rounded-full h-2 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent Work */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Recent Work</h2>
          <Link
            href="/work-log"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {(recentLogs || []).length === 0 ? (
          <p className="text-sm text-gray-400 py-2">
            No work logged yet. Start by logging your first entry!
          </p>
        ) : (
          <div className="space-y-2">
            {(recentLogs || []).map((log: any) => (
              <div
                key={log.id}
                className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                    {log.client?.color && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: log.client.color }}
                      />
                    )}
                    <span className="truncate">
                      {log.client?.name || 'Internal'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {getCategoryLabel(log.service_category)} &middot;{' '}
                    {formatNepaliShortDate(new Date(log.date))}
                  </div>
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium shrink-0 ml-3">
                  {log.hours}h
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
