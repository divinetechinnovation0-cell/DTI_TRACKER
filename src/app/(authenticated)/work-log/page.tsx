'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO, subDays } from 'date-fns'
import { Plus, Trash2, Clock, ChevronLeft, ChevronRight, Copy, Check, MessageSquare, CheckCircle2 } from 'lucide-react'
import { SERVICE_CATEGORIES, WORK_TYPES, getCategoryLabel } from '@/lib/types'
import type { WorkLog, Client } from '@/lib/types'
import { formatNepaliDayMonth, formatNepaliShortDate, formatNepaliTime } from '@/lib/nepali-date'

type QuickTemplate = {
  client_id: string | null
  client_name: string | null
  client_color: string | null
  service_category: string
  hours: number
  count: number
}

const HOUR_OPTIONS = [0.5, 1, 1.5, 2, 3, 4, 6, 8]

export default function WorkLogPage() {
  const supabase = createClient()
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [logs, setLogs] = useState<WorkLog[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [memberId, setMemberId] = useState<string | null>(null)
  const [memberPrimaryWork, setMemberPrimaryWork] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [completedTasks, setCompletedTasks] = useState<any[]>([])

  // Form state
  const [clientId, setClientId] = useState<string | null>(null)
  const [hours, setHours] = useState<number>(1)
  const [customHours, setCustomHours] = useState('')
  const [workType, setWorkType] = useState<string>('serving')
  const [serviceCategory, setServiceCategory] = useState('meta_ads')
  const [description, setDescription] = useState('')

  // Quick features
  const [quickTemplates, setQuickTemplates] = useState<QuickTemplate[]>([])
  const [yesterdayEntries, setYesterdayEntries] = useState<WorkLog[]>([])
  const [copyingYesterday, setCopyingYesterday] = useState(false)

  // Toast
  const [toast, setToast] = useState<string | null>(null)

  // Sort service categories: user's primary_work first
  const sortedCategories = useCallback(() => {
    if (!memberPrimaryWork) return SERVICE_CATEGORIES
    const primary = SERVICE_CATEGORIES.filter(c => c.value === memberPrimaryWork)
    const rest = SERVICE_CATEGORIES.filter(c => c.value !== memberPrimaryWork)
    return [...primary, ...rest]
  }, [memberPrimaryWork])

  // Init: get user, clients
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from('team_members')
        .select('id, primary_work')
        .eq('auth_user_id', user.id)
        .single()

      if (member) {
        setMemberId(member.id)
        setMemberPrimaryWork(member.primary_work)
        if (member.primary_work) {
          setServiceCategory(member.primary_work)
        }
      }

      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('status', 'active')
        .order('name')

      if (clientData) setClients(clientData)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch logs for selected date
  const fetchLogs = useCallback(async () => {
    if (!memberId) return
    setLoading(true)
    const { data } = await supabase
      .from('work_logs')
      .select('*, client:clients(name, color)')
      .eq('team_member_id', memberId)
      .eq('date', date)
      .order('created_at', { ascending: false })

    if (data) setLogs(data as unknown as WorkLog[])

    const { data: doneTaskData } = await supabase
      .from('tasks')
      .select('*, client:clients(name, color)')
      .eq('assigned_to', memberId)
      .eq('status', 'done')
      .gte('completed_at', `${date}T00:00:00`)
      .lte('completed_at', `${date}T23:59:59`)
    if (doneTaskData) setCompletedTasks(doneTaskData)

    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, date])

  // Fetch yesterday's entries for "repeat yesterday"
  const fetchYesterdayEntries = useCallback(async () => {
    if (!memberId) return
    const yesterday = format(subDays(parseISO(date), 1), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('work_logs')
      .select('*, client:clients(name, color)')
      .eq('team_member_id', memberId)
      .eq('date', yesterday)
      .order('created_at', { ascending: false })

    if (data) setYesterdayEntries(data as unknown as WorkLog[])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, date])

  // Fetch quick templates: top 3 recent combos from last 14 days
  const fetchQuickTemplates = useCallback(async () => {
    if (!memberId) return
    const twoWeeksAgo = format(subDays(new Date(), 14), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('work_logs')
      .select('client_id, service_category, hours, client:clients(name, color)')
      .eq('team_member_id', memberId)
      .gte('date', twoWeeksAgo)
      .order('created_at', { ascending: false })

    if (!data || data.length === 0) return

    // Group by client_id + service_category + hours combo
    const combos = new Map<string, QuickTemplate>()
    for (const row of data as unknown as Array<{
      client_id: string | null
      service_category: string
      hours: number
      client: { name: string; color: string } | null
    }>) {
      const key = `${row.client_id || 'none'}-${row.service_category}-${row.hours}`
      if (combos.has(key)) {
        combos.get(key)!.count++
      } else {
        combos.set(key, {
          client_id: row.client_id,
          client_name: row.client?.name || null,
          client_color: row.client?.color || null,
          service_category: row.service_category,
          hours: row.hours,
          count: 1,
        })
      }
    }

    // Sort by frequency, take top 3
    const sorted = Array.from(combos.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)

    setQuickTemplates(sorted)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId])

  useEffect(() => {
    fetchLogs()
    fetchYesterdayEntries()
  }, [fetchLogs, fetchYesterdayEntries])

  useEffect(() => {
    fetchQuickTemplates()
  }, [fetchQuickTemplates])

  // Show toast helper
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  // Reset form
  const resetForm = () => {
    setClientId(null)
    setHours(1)
    setCustomHours('')
    setWorkType('serving')
    setServiceCategory(memberPrimaryWork || 'meta_ads')
    setDescription('')
    setShowNote(false)
  }

  // Submit new entry
  const handleSubmit = async () => {
    if (!memberId) return
    if (workType === 'serving' && !clientId) return
    setSubmitting(true)

    const finalHours = customHours ? parseFloat(customHours) : hours
    if (!finalHours || finalHours <= 0) {
      setSubmitting(false)
      return
    }

    const entry: Record<string, unknown> = {
      team_member_id: memberId,
      date,
      hours: finalHours,
      work_type: workType,
      service_category: serviceCategory,
      description: description.trim(),
    }

    if (clientId) {
      entry.client_id = clientId
    }

    const { error } = await supabase.from('work_logs').insert(entry)
    if (!error) {
      showToast('Logged!')
      resetForm()
      setShowForm(false)
      fetchLogs()
      fetchQuickTemplates()
    }
    setSubmitting(false)
  }

  // Quick log a template
  const quickLog = async (tpl: QuickTemplate) => {
    if (!memberId) return

    const entry: Record<string, unknown> = {
      team_member_id: memberId,
      date,
      hours: tpl.hours,
      work_type: tpl.client_id ? 'serving' : 'internal',
      service_category: tpl.service_category,
      description: '',
    }

    if (tpl.client_id) {
      entry.client_id = tpl.client_id
    }

    const { error } = await supabase.from('work_logs').insert(entry)
    if (!error) {
      showToast('Logged!')
      fetchLogs()
      fetchQuickTemplates()
    }
  }

  // Copy yesterday's entries
  const copyYesterday = async () => {
    if (!memberId || yesterdayEntries.length === 0) return
    setCopyingYesterday(true)

    const entries = yesterdayEntries.map((entry) => ({
      team_member_id: memberId,
      date,
      hours: entry.hours,
      work_type: entry.work_type,
      service_category: entry.service_category,
      description: entry.description || '',
      client_id: entry.client_id || null,
    }))

    const { error } = await supabase.from('work_logs').insert(entries)
    if (!error) {
      showToast(`Copied ${entries.length} entries!`)
      fetchLogs()
    }
    setCopyingYesterday(false)
  }

  // Delete entry
  const handleDelete = async (id: string) => {
    await supabase.from('work_logs').delete().eq('id', id)
    fetchLogs()
    fetchQuickTemplates()
  }

  // Date navigation
  const changeDate = (days: number) => {
    const d = parseISO(date)
    d.setDate(d.getDate() + days)
    setDate(format(d, 'yyyy-MM-dd'))
  }

  const totalHours = logs.reduce((sum, l) => sum + Number(l.hours), 0)
  const selectedHours = customHours ? parseFloat(customHours) : hours

  return (
    <div className="max-w-lg mx-auto pb-32">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* Header with date navigator */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Work Log</h1>
        <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 px-1.5 py-1">
          <button onClick={() => changeDate(-1)} className="p-1.5 hover:bg-gray-100 rounded active:bg-gray-200">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-sm border-none outline-none bg-transparent w-32 text-center"
          />
          <button onClick={() => changeDate(1)} className="p-1.5 hover:bg-gray-100 rounded active:bg-gray-200">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Total Hours Card */}
      <div className="bg-blue-600 rounded-xl p-4 mb-4 flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-200" />
          <span className="text-sm font-medium text-blue-100">
            {formatNepaliDayMonth(parseISO(date))}
          </span>
        </div>
        <span className="text-2xl font-bold">{totalHours}h</span>
      </div>

      {/* Repeat Yesterday Button */}
      {yesterdayEntries.length > 0 && logs.length === 0 && (
        <button
          onClick={copyYesterday}
          disabled={copyingYesterday}
          className="w-full mb-4 py-3 px-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between hover:bg-amber-100 active:bg-amber-200 transition disabled:opacity-50"
        >
          <div className="flex items-center gap-2">
            <Copy className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              Copy yesterday&apos;s log ({yesterdayEntries.length} {yesterdayEntries.length === 1 ? 'entry' : 'entries'})
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-400" />
        </button>
      )}

      {/* Quick Log Templates */}
      {quickTemplates.length > 0 && !showForm && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Quick Log</p>
          <div className="space-y-2">
            {quickTemplates.map((tpl, i) => (
              <button
                key={i}
                onClick={() => quickLog(tpl)}
                className="w-full text-left bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between hover:border-blue-300 active:bg-blue-50 transition group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {tpl.client_color && (
                    <span
                      className="w-1 h-8 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tpl.client_color }}
                    />
                  )}
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-800 truncate block">
                      {tpl.client_name || 'Internal'} · {getCategoryLabel(tpl.service_category)}
                    </span>
                    <span className="text-xs text-gray-400">{tpl.hours}h · used {tpl.count}x recently</span>
                  </div>
                </div>
                <span className="flex-shrink-0 text-xs font-medium bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition">
                  Log this
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add New Entry Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 active:bg-blue-50 transition flex items-center justify-center gap-2 text-sm font-medium mb-4"
        >
          <Plus className="w-4 h-4" />
          Log something new
        </button>
      )}

      {/* New Entry Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden">
          <div className="p-4 space-y-4">
            {/* Work Type Chips */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Work Type</p>
              <div className="flex gap-2">
                {WORK_TYPES.map((wt) => (
                  <button
                    key={wt.value}
                    type="button"
                    onClick={() => {
                      setWorkType(wt.value)
                      if (wt.value === 'internal') setClientId(null)
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition active:scale-95 ${
                      workType === wt.value
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {wt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Client Chips */}
            {workType !== 'internal' && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Client {workType === 'serving' && <span className="text-red-400">*</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {workType !== 'serving' && (
                    <button
                      type="button"
                      onClick={() => setClientId(null)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition active:scale-95 ${
                        clientId === null
                          ? 'bg-gray-800 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      No client
                    </button>
                  )}
                  {clients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setClientId(c.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition active:scale-95 flex items-center gap-1.5 ${
                        clientId === c.id
                          ? 'text-white shadow-sm'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                      style={
                        clientId === c.id
                          ? { backgroundColor: c.color || '#2563eb' }
                          : { borderLeftColor: c.color || '#d1d5db', borderLeftWidth: '3px' }
                      }
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Service Category Chips */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Service</p>
              <div className="flex flex-wrap gap-1.5">
                {sortedCategories().map((sc) => (
                  <button
                    key={sc.value}
                    type="button"
                    onClick={() => setServiceCategory(sc.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition active:scale-95 ${
                      serviceCategory === sc.value
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hours Quick-Tap */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Hours</p>
              <div className="flex flex-wrap gap-2">
                {HOUR_OPTIONS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => {
                      setHours(h)
                      setCustomHours('')
                    }}
                    className={`w-12 h-10 rounded-xl text-sm font-semibold transition active:scale-95 ${
                      !customHours && hours === h
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {h}
                  </button>
                ))}
                <input
                  type="number"
                  value={customHours}
                  onChange={(e) => setCustomHours(e.target.value)}
                  placeholder="Other"
                  min="0.25"
                  max="24"
                  step="0.25"
                  className={`w-16 h-10 rounded-xl text-sm text-center border outline-none transition ${
                    customHours
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold'
                      : 'border-gray-200 bg-gray-50 text-gray-500'
                  }`}
                />
              </div>
            </div>

            {/* Note (collapsed by default) */}
            <div>
              {!showNote ? (
                <button
                  type="button"
                  onClick={() => setShowNote(true)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  + Add note (optional)
                </button>
              ) : (
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder:text-gray-300"
                  placeholder="What did you work on?"
                />
              )}
            </div>
          </div>

          {/* Form Actions - sticky on mobile */}
          <div className="border-t border-gray-100 p-3 flex gap-2 bg-gray-50 sticky bottom-0">
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                resetForm()
              }}
              className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || (workType === 'serving' && !clientId) || (!customHours && !hours)}
              className="flex-[2] py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save · {selectedHours || 0}h
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Today's Entries List */}
      <div>
        {logs.length > 0 && (
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            {formatNepaliShortDate(parseISO(date))} — {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
          </p>
        )}
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No work logged for this day</p>
            </div>
          ) : (
            logs.map((log) => {
              const logClient = log.client as unknown as { name: string; color?: string } | null
              return (
                <div
                  key={log.id}
                  className="bg-white rounded-xl border border-gray-200 p-3 flex items-start gap-3"
                  style={logClient?.color ? { borderLeftColor: logClient.color, borderLeftWidth: '3px' } : {}}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm text-gray-900 truncate">
                        {logClient?.name ||
                         (log.work_type === 'internal' ? 'Internal' : 'Acquisition')}
                      </span>
                      <span className="flex-shrink-0 text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {log.hours}h
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        {getCategoryLabel(log.service_category)}
                      </span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400 capitalize">{log.work_type}</span>
                    </div>
                    {log.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{log.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(log.id)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition flex-shrink-0 active:bg-red-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Completed Tasks - Activity Log */}
      {completedTasks.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mt-4">
          <h3 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            पूरा भएका कार्यहरू
          </h3>
          <div className="space-y-2">
            {completedTasks.map((task: any) => (
              <div key={task.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{task.title}</p>
                  {task.client && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: task.client.color || '#9ca3af' }} />
                      <span className="text-xs text-gray-400">{task.client.name}</span>
                    </div>
                  )}
                </div>
                {task.completed_at && (
                  <span className="text-xs text-gray-400">{formatNepaliTime(new Date(task.completed_at))}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
