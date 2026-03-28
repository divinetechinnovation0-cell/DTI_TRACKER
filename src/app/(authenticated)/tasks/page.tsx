'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  format,
  parseISO,
  isAfter,
  isBefore,
  startOfWeek,
  endOfWeek,
  addWeeks,
  startOfDay,
  isWithinInterval,
} from 'date-fns'
import {
  Plus,
  Circle,
  CheckCircle2,
  Check,
  X,
  Target,
  ListTodo,
  Users,
  Pencil,
  Trash2,
} from 'lucide-react'
import type { Task, Client, TeamMember } from '@/lib/types'

type Tab = 'my' | 'all' | 'weekly'

type TaskWithJoins = Task & {
  assignee?: { name: string }
  assigner?: { name: string }
  client?: { name: string; color?: string }
}

export default function TasksPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('my')
  const [tasks, setTasks] = useState<TaskWithJoins[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [memberId, setMemberId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formAssignedTo, setFormAssignedTo] = useState('')
  const [formDueDate, setFormDueDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [formClientId, setFormClientId] = useState('')
  const [formPriority, setFormPriority] = useState<'normal' | 'urgent'>('normal')
  const [formIsWeeklyGoal, setFormIsWeeklyGoal] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from('team_members')
        .select('id, is_admin')
        .eq('auth_user_id', user.id)
        .single()

      if (member) {
        setMemberId(member.id)
        setIsAdmin(member.is_admin)
        setFormAssignedTo(member.id)
      }

      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('status', 'active')
        .order('name')

      if (clientData) setClients(clientData)

      const { data: teamData } = await supabase
        .from('team_members')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (teamData) setTeamMembers(teamData)
    }
    init()
  }, [])

  const fetchTasks = useCallback(async () => {
    if (!memberId) return
    setLoading(true)

    let query = supabase
      .from('tasks')
      .select('*, assignee:team_members!assigned_to(name), assigner:team_members!assigned_by(name), client:clients(name, color)')
      .order('due_date', { ascending: true, nullsFirst: false })

    if (tab === 'my') {
      query = query.eq('assigned_to', memberId)
    } else if (tab === 'weekly') {
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      query = query
        .eq('is_weekly_goal', true)
        .gte('due_date', weekStart)
        .lte('due_date', weekEnd)
    }

    const { data } = await query

    if (data) setTasks(data as unknown as TaskWithJoins[])
    setLoading(false)
  }, [memberId, tab])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const toggleTask = async (task: TaskWithJoins) => {
    setTogglingId(task.id)
    const newStatus = task.status === 'done' ? 'open' : 'done'
    const updates: Record<string, unknown> = {
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null,
    }

    await supabase
      .from('tasks')
      .update(updates)
      .eq('id', task.id)

    setTasks(prev =>
      prev.map(t =>
        t.id === task.id
          ? { ...t, status: newStatus, completed_at: updates.completed_at as string | null }
          : t
      )
    )
    setTogglingId(null)
  }

  const resetForm = () => {
    setFormTitle('')
    setFormAssignedTo(memberId || '')
    setFormDueDate(format(new Date(), 'yyyy-MM-dd'))
    setFormClientId('')
    setFormPriority('normal')
    setFormIsWeeklyGoal(false)
    setEditingTaskId(null)
    setShowForm(false)
  }

  const startEditTask = (task: TaskWithJoins) => {
    setFormTitle(task.title)
    setFormAssignedTo(task.assigned_to || memberId || '')
    setFormDueDate(task.due_date || format(new Date(), 'yyyy-MM-dd'))
    setFormClientId(task.client_id || '')
    setFormPriority(task.priority as 'normal' | 'urgent')
    setFormIsWeeklyGoal(task.is_weekly_goal || false)
    setEditingTaskId(task.id)
    setShowForm(true)
    setDeleteConfirmId(null)
  }

  const handleDeleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id)
    setDeleteConfirmId(null)
    fetchTasks()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberId || !formTitle.trim()) return
    setSubmitting(true)

    const weekStart = formIsWeeklyGoal
      ? format(startOfWeek(parseISO(formDueDate), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      : null

    const entry: Record<string, unknown> = {
      title: formTitle.trim(),
      assigned_to: formAssignedTo,
      due_date: formDueDate || null,
      client_id: formClientId || null,
      priority: formPriority,
      is_weekly_goal: formIsWeeklyGoal,
      week_start: weekStart,
    }

    if (editingTaskId) {
      const { error } = await supabase.from('tasks').update(entry).eq('id', editingTaskId)
      if (!error) { resetForm(); fetchTasks() }
    } else {
      const { error } = await supabase.from('tasks').insert({ ...entry, assigned_by: memberId, status: 'open' })
      if (!error) { resetForm(); fetchTasks() }
    }
    setSubmitting(false)
  }

  // Group tasks by time bucket
  const now = startOfDay(new Date())
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 })
  const nextWeekStart = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), 1)
  const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 })

  const grouped = useMemo(() => {
    const overdue: TaskWithJoins[] = []
    const thisWeek: TaskWithJoins[] = []
    const nextWeek: TaskWithJoins[] = []
    const later: TaskWithJoins[] = []
    const noDue: TaskWithJoins[] = []

    for (const task of tasks) {
      if (!task.due_date) {
        noDue.push(task)
        continue
      }

      const dueDate = startOfDay(parseISO(task.due_date))

      if (task.status !== 'done' && isBefore(dueDate, now)) {
        overdue.push(task)
      } else if (isWithinInterval(dueDate, { start: now, end: thisWeekEnd })) {
        thisWeek.push(task)
      } else if (isWithinInterval(dueDate, { start: nextWeekStart, end: nextWeekEnd })) {
        nextWeek.push(task)
      } else {
        later.push(task)
      }
    }

    return { overdue, thisWeek, nextWeek, later, noDue }
  }, [tasks, now, thisWeekEnd, nextWeekStart, nextWeekEnd])

  // Weekly goals stats
  const weeklyGoalTasks = tasks.filter(t => t.is_weekly_goal)
  const weeklyDone = weeklyGoalTasks.filter(t => t.status === 'done').length
  const weeklyTotal = weeklyGoalTasks.length

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'my', label: 'My Tasks', icon: <ListTodo className="w-4 h-4" /> },
    { key: 'all', label: 'All Tasks', icon: <Users className="w-4 h-4" /> },
    { key: 'weekly', label: 'Weekly Goals', icon: <Target className="w-4 h-4" /> },
  ]

  function TaskCard({ task }: { task: TaskWithJoins }) {
    const isDone = task.status === 'done'
    const isUrgent = task.priority === 'urgent' && !isDone
    const isToggling = togglingId === task.id

    return (
      <div
        className={`bg-white rounded-xl border border-gray-200 p-3 flex items-start gap-3 transition-all ${
          isUrgent ? 'border-l-4 border-l-red-500' : ''
        } ${isDone ? 'opacity-60' : ''}`}
      >
        <button
          onClick={() => toggleTask(task)}
          disabled={isToggling}
          className={`mt-0.5 flex-shrink-0 transition-all duration-200 ${
            isToggling ? 'scale-90 opacity-50' : ''
          }`}
        >
          {isDone ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <Circle className="w-5 h-5 text-gray-300 hover:text-blue-400 transition-colors" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {task.assignee && tab !== 'my' && (
              <span className="text-xs text-gray-500">{task.assignee.name}</span>
            )}
            {task.due_date && (
              <span className={`text-xs ${
                !isDone && isBefore(parseISO(task.due_date), now) ? 'text-red-500 font-medium' : 'text-gray-400'
              }`}>
                {format(parseISO(task.due_date), 'MMM d')}
              </span>
            )}
            {task.client && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <span
                  className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                  style={{ backgroundColor: task.client.color || '#9ca3af' }}
                />
                {task.client.name}
              </span>
            )}
            {task.is_weekly_goal && (
              <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">Goal</span>
            )}
            {task.priority === 'urgent' && !isDone && (
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Urgent</span>
            )}
          </div>
        </div>

        {/* Edit / Delete actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
          {deleteConfirmId === task.id ? (
            <>
              <button
                onClick={() => handleDeleteTask(task.id)}
                className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition text-xs font-medium"
                title="Confirm delete"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => startEditTask(task)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-blue-500 transition"
                title="Edit task"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDeleteConfirmId(task.id)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-red-500 transition"
                title="Delete task"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  function TaskGroup({ title, tasks: groupTasks, color }: { title: string; tasks: TaskWithJoins[]; color: string }) {
    if (groupTasks.length === 0) return null
    return (
      <div className="mb-5">
        <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${color}`}>
          {title} <span className="text-gray-400 font-normal">({groupTasks.length})</span>
        </h3>
        <div className="space-y-2">
          {groupTasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Tasks</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          New Task
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-5">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Weekly Goals Progress */}
      {tab === 'weekly' && weeklyTotal > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-purple-900">This Week&apos;s Goals</span>
            <span className="text-sm font-bold text-purple-700">{weeklyDone}/{weeklyTotal} done</span>
          </div>
          <div className="w-full bg-purple-200 rounded-full h-2.5">
            <div
              className="bg-purple-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${weeklyTotal > 0 ? (weeklyDone / weeklyTotal) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* New Task Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{editingTaskId ? 'Edit Task' : 'New Task'}</h2>
            <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg transition">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <input
                type="text"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="What needs to be done?"
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            {/* Assigned To */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Assign to</label>
              <div className="flex flex-wrap gap-2">
                {teamMembers.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setFormAssignedTo(m.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                      formAssignedTo === m.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Due date</label>
              <input
                type="date"
                value={formDueDate}
                onChange={e => setFormDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Client */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Client (optional)</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFormClientId('')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    formClientId === ''
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  None
                </button>
                {clients.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setFormClientId(c.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1.5 ${
                      formClientId === c.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority Toggle */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Priority</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormPriority('normal')}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                    formPriority === 'normal'
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setFormPriority('urgent')}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                    formPriority === 'urgent'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Urgent
                </button>
              </div>
            </div>

            {/* Weekly Goal Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formIsWeeklyGoal}
                onChange={e => setFormIsWeeklyGoal(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">This is a weekly goal</span>
            </label>

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !formTitle.trim()}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {submitting ? 'Saving...' : editingTaskId ? 'Update Task' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Task List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12">
          <ListTodo className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {tab === 'weekly' ? 'No weekly goals set for this week' : 'No tasks yet'}
          </p>
        </div>
      ) : tab === 'weekly' ? (
        <div className="space-y-2">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      ) : (
        <>
          <TaskGroup title="Overdue" tasks={grouped.overdue} color="text-red-600" />
          <TaskGroup title="This Week" tasks={grouped.thisWeek} color="text-blue-600" />
          <TaskGroup title="Next Week" tasks={grouped.nextWeek} color="text-gray-600" />
          <TaskGroup title="Later" tasks={grouped.later} color="text-gray-500" />
          <TaskGroup title="No Due Date" tasks={grouped.noDue} color="text-gray-400" />
        </>
      )}
    </div>
  )
}
