'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isToday,
  getDay,
  addWeeks,
  subWeeks,
  parseISO,
} from 'date-fns'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  X,
  Clock,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Check,
} from 'lucide-react'
import type { ContentCalendar, Client, TeamMember } from '@/lib/types'
import { CONTENT_TYPES, PLATFORMS } from '@/lib/types'
import {
  getBSComponents,
  getBSDay,
  getBSDaysInMonth,
  getADDateForBSMonthStart,
  getADDateForBSMonthEnd,
  nextBSMonth,
  prevBSMonth,
  isSameBSMonth,
  formatBSWeekRange,
  formatBSDayDetail,
  BS_MONTHS,
} from '@/lib/nepali-date'

type ContentEntry = ContentCalendar & {
  client?: { name: string; color?: string }
  assignee?: { name: string }
}

type WorkLogEntry = {
  id: string
  date: string
  hours: number
  description: string
  service_category: string
  team_member?: { name: string }
  client?: { name: string; color?: string }
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function CalendarPage() {
  const supabase = createClient()

  const [view, setView] = useState<'week' | 'month'>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [filterClientId, setFilterClientId] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [entries, setEntries] = useState<ContentEntry[]>([])
  const [workLogs, setWorkLogs] = useState<WorkLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [expandedMobileDay, setExpandedMobileDay] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  )
  const [memberId, setMemberId] = useState<string | null>(null)

  // BS month/year for month view navigation
  const [bsYear, setBsYear] = useState(() => getBSComponents(new Date()).year)
  const [bsMonth, setBsMonth] = useState(() => getBSComponents(new Date()).month)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formClientId, setFormClientId] = useState('')
  const [formContentType, setFormContentType] = useState('')
  const [formPlatforms, setFormPlatforms] = useState<string[]>([])
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [formTime, setFormTime] = useState('')
  const [formAssignedTo, setFormAssignedTo] = useState('')
  const [formDescription, setFormDescription] = useState('')

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from('team_members')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
      if (member) setMemberId(member.id)

      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('status', 'active')
        .order('name')
      if (clientData) setClients(clientData)

      const { data: memberData } = await supabase
        .from('team_members')
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (memberData) setMembers(memberData)
    }
    init()
  }, [])

  // Date range for data fetching
  const dateRange = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })
      return { start, end }
    } else {
      // For BS month view, get the AD range covering the full BS month
      const start = getADDateForBSMonthStart(bsYear, bsMonth)
      const end = getADDateForBSMonthEnd(bsYear, bsMonth)
      return { start, end }
    }
  }, [currentDate, view, bsYear, bsMonth])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const startStr = format(dateRange.start, 'yyyy-MM-dd')
    const endStr = format(dateRange.end, 'yyyy-MM-dd')

    let contentQuery = supabase
      .from('content_calendar')
      .select('*, client:clients(name, color), assignee:team_members!assigned_to(name)')
      .neq('status', 'cancelled')
      .gte('scheduled_date', startStr)
      .lte('scheduled_date', endStr)
      .order('scheduled_date')
      .order('scheduled_time', { ascending: true, nullsFirst: false })

    if (filterClientId) {
      contentQuery = contentQuery.eq('client_id', filterClientId)
    }

    const { data: contentData } = await contentQuery
    if (contentData) setEntries(contentData as unknown as ContentEntry[])

    let workLogQuery = supabase
      .from('work_logs')
      .select('id, date, hours, description, service_category, team_member:team_members!team_member_id(name), client:clients(name, color)')
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date')

    if (filterClientId) {
      workLogQuery = workLogQuery.eq('client_id', filterClientId)
    }

    const { data: workLogData } = await workLogQuery
    if (workLogData) setWorkLogs(workLogData as unknown as WorkLogEntry[])

    setLoading(false)
  }, [dateRange, filterClientId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const navigate = (direction: number) => {
    if (view === 'week') {
      setCurrentDate((d) => (direction > 0 ? addWeeks(d, 1) : subWeeks(d, 1)))
    } else {
      // Navigate by BS month
      if (direction > 0) {
        const next = nextBSMonth(bsYear, bsMonth)
        setBsYear(next.year)
        setBsMonth(next.month)
      } else {
        const prev = prevBSMonth(bsYear, bsMonth)
        setBsYear(prev.year)
        setBsMonth(prev.month)
      }
    }
  }

  const goToday = () => {
    setCurrentDate(new Date())
    const today = getBSComponents(new Date())
    setBsYear(today.year)
    setBsMonth(today.month)
  }

  const resetForm = () => {
    setFormTitle('')
    setFormClientId('')
    setFormContentType('')
    setFormPlatforms([])
    setFormDate(format(new Date(), 'yyyy-MM-dd'))
    setFormTime('')
    setFormAssignedTo('')
    setFormDescription('')
  }

  const startEditEntry = (entry: ContentEntry) => {
    setFormTitle(entry.title)
    setFormClientId(entry.client_id)
    setFormContentType(entry.content_type)
    setFormPlatforms(entry.platform ? entry.platform.split(',') : [])
    setFormDate(entry.scheduled_date)
    setFormTime(entry.scheduled_time || '')
    setFormAssignedTo(entry.assigned_to || '')
    setFormDescription(entry.description || '')
    setEditingEntryId(entry.id)
    setShowForm(true)
    setDeleteConfirmId(null)
  }

  const handleDeleteEntry = async (id: string) => {
    const { error } = await supabase.from('content_calendar').delete().eq('id', id)
    if (error) {
      // If RLS blocks delete, update status to cancelled instead
      await supabase.from('content_calendar').update({ status: 'cancelled' }).eq('id', id)
    }
    setDeleteConfirmId(null)
    fetchData()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formClientId || !formTitle || !formContentType) return
    setSubmitting(true)

    const payload: Record<string, unknown> = {
      client_id: formClientId,
      title: formTitle,
      content_type: formContentType,
      scheduled_date: formDate,
      description: formDescription || '',
      platform: formPlatforms.length > 0 ? formPlatforms.join(',') : null,
      scheduled_time: formTime || null,
      assigned_to: formAssignedTo || null,
    }

    if (editingEntryId) {
      const { error } = await supabase.from('content_calendar').update(payload).eq('id', editingEntryId)
      if (error) console.error('Update error:', error)
      else { resetForm(); setEditingEntryId(null); setShowForm(false); fetchData() }
    } else {
      if (memberId) payload.created_by = memberId
      payload.status = 'planned'
      const { error } = await supabase.from('content_calendar').insert(payload)
      if (error) console.error('Insert error:', error)
      else { resetForm(); setShowForm(false); fetchData() }
    }
    setSubmitting(false)
  }

  // Week view days
  const days = useMemo(() => eachDayOfInterval(dateRange), [dateRange])

  const entriesByDate = useMemo(() => {
    const map: Record<string, ContentEntry[]> = {}
    entries.forEach((e) => {
      const key = e.scheduled_date
      if (!map[key]) map[key] = []
      map[key].push(e)
    })
    return map
  }, [entries])

  const workLogsByDate = useMemo(() => {
    const map: Record<string, WorkLogEntry[]> = {}
    workLogs.forEach((w) => {
      const key = w.date
      if (!map[key]) map[key] = []
      map[key].push(w)
    })
    return map
  }, [workLogs])

  // Month view: build full calendar grid with padding for BS month
  const monthGrid = useMemo(() => {
    if (view !== 'month') return []
    const monthStart = getADDateForBSMonthStart(bsYear, bsMonth)
    const monthEnd = getADDateForBSMonthEnd(bsYear, bsMonth)
    // Pad to full weeks (Mon start)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: calStart, end: calEnd })
  }, [bsYear, bsMonth, view])

  // Header label in BS
  const headerLabel = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })
      return formatBSWeekRange(start, end)
    } else {
      return `${BS_MONTHS[bsMonth]} ${bsYear}`
    }
  }, [view, currentDate, bsYear, bsMonth])

  const getContentTypeLabel = (val: string) =>
    CONTENT_TYPES.find((c) => c.value === val)?.label || val

  const getPlatformLabel = (val: string) =>
    val.split(',').map((v) => PLATFORMS.find((p) => p.value === v.trim())?.label || v.trim()).join(', ')

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <h1 className="text-xl font-bold">Content Calendar</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                view === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                view === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Month
            </button>
          </div>
          <button
            onClick={() => {
              resetForm()
              setEditingEntryId(null)
              setShowForm(true)
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[220px] text-center">
            {headerLabel}
          </span>
          <button
            onClick={() => navigate(1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={goToday}
            className="px-2.5 py-1 text-xs font-medium bg-gray-100 rounded-lg hover:bg-gray-200 transition text-gray-600"
          >
            Today
          </button>
        </div>
      </div>

      {/* Client filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilterClientId(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
            filterClientId === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {clients.map((client) => (
          <button
            key={client.id}
            onClick={() =>
              setFilterClientId(filterClientId === client.id ? null : client.id)
            }
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filterClientId === client.id
                ? 'text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={
              filterClientId === client.id
                ? { backgroundColor: client.color }
                : {}
            }
          >
            <span className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: client.color }}
              />
              {client.name}
            </span>
          </button>
        ))}
      </div>

      {/* Add entry form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-gray-700">
              {editingEntryId ? 'Edit Entry' : 'Add Content Entry'}
            </h3>
            <button
              onClick={() => { resetForm(); setEditingEntryId(null); setShowForm(false) }}
              className="p-1 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Monthly promo reel"
              />
            </div>

            {/* Client chips */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {clients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setFormClientId(c.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                      formClientId === c.id
                        ? 'text-white border-transparent'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                    style={
                      formClientId === c.id
                        ? { backgroundColor: c.color }
                        : {}
                    }
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Content type chips */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content Type <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {CONTENT_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => setFormContentType(formContentType === ct.value ? '' : ct.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                      formContentType === ct.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Platform chips (multi-select) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platform (optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => {
                  const selected = formPlatforms.includes(p.value)
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() =>
                        setFormPlatforms((prev) =>
                          selected
                            ? prev.filter((v) => v !== p.value)
                            : [...prev, p.value]
                        )
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                        selected
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Date, time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scheduled Date
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time (optional)
                </label>
                <input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Assigned to member chips */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assigned To
              </label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      setFormAssignedTo(formAssignedTo === m.id ? '' : m.id)
                    }
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

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Details, links, notes..."
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setShowForm(false)
                }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !formClientId || !formContentType}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {submitting ? 'Saving...' : editingEntryId ? 'Update Entry' : 'Add Entry'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          Loading...
        </div>
      ) : view === 'week' ? (
        <>
          {/* WEEK VIEW - Desktop: 7 columns */}
          <div className="hidden md:grid grid-cols-7 gap-2">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const dayEntries = entriesByDate[key] || []
              const dayWorkLogs = workLogsByDate[key] || []
              const today = isToday(day)
              const bsDay = getBSDay(day)

              return (
                <div
                  key={key}
                  className={`rounded-xl border p-2 min-h-[160px] ${
                    today
                      ? 'border-blue-400 bg-blue-50/50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div
                    className={`text-xs font-medium mb-2 ${
                      today ? 'text-blue-700' : 'text-gray-500'
                    }`}
                  >
                    <span>{DAY_LABELS[getDay(day) === 0 ? 6 : getDay(day) - 1]}</span>{' '}
                    <span
                      className={`${
                        today
                          ? 'bg-blue-600 text-white px-1.5 py-0.5 rounded-full'
                          : ''
                      }`}
                    >
                      {bsDay}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-lg p-1.5 text-xs bg-white border border-gray-100 group"
                        style={{
                          borderLeftWidth: '3px',
                          borderLeftColor:
                            entry.client?.color || '#6B7280',
                        }}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="font-medium text-gray-800 truncate flex-1">{entry.title}</div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                            {deleteConfirmId === entry.id ? (
                              <>
                                <button onClick={() => handleDeleteEntry(entry.id)} className="p-0.5 rounded bg-red-50 text-red-500"><Check className="w-3 h-3" /></button>
                                <button onClick={() => setDeleteConfirmId(null)} className="p-0.5 rounded hover:bg-gray-100 text-gray-400"><X className="w-3 h-3" /></button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEditEntry(entry)} className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500"><Pencil className="w-3 h-3" /></button>
                                <button onClick={() => setDeleteConfirmId(entry.id)} className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {entry.assignee?.name && (
                            <span className="bg-gray-100 text-gray-500 px-1 rounded text-[10px] font-medium">
                              {getInitials(entry.assignee.name)}
                            </span>
                          )}
                          {entry.scheduled_time && (
                            <span className="text-gray-400 text-[10px] flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {entry.scheduled_time.slice(0, 5)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {dayWorkLogs.map((wl) => (
                      <div
                        key={wl.id}
                        className="rounded-lg p-1.5 text-xs bg-gray-50 border border-gray-100"
                        style={{
                          borderLeftWidth: '3px',
                          borderLeftColor: '#9CA3AF',
                        }}
                      >
                        <div className="font-medium text-gray-500 truncate">
                          {wl.description || wl.service_category}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-400">
                          {wl.team_member?.name && (
                            <span className="bg-gray-100 px-1 rounded font-medium">
                              {getInitials(wl.team_member.name)}
                            </span>
                          )}
                          <span>{wl.hours}h</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* WEEK VIEW - Mobile: vertical day list */}
          <div className="md:hidden space-y-2">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const dayEntries = entriesByDate[key] || []
              const dayWorkLogs = workLogsByDate[key] || []
              const today = isToday(day)
              const isExpanded = expandedMobileDay === key
              const itemCount = dayEntries.length + dayWorkLogs.length
              const bsDay = getBSDay(day)
              const bsMonthName = BS_MONTHS[getBSComponents(day).month]

              return (
                <div
                  key={key}
                  className={`rounded-xl border overflow-hidden ${
                    today
                      ? 'border-blue-400 bg-blue-50/50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <button
                    onClick={() =>
                      setExpandedMobileDay(isExpanded ? '' : key)
                    }
                    className="w-full flex items-center justify-between p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          today ? 'text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        {DAY_LABELS[getDay(day) === 0 ? 6 : getDay(day) - 1]}, {bsMonthName} {bsDay}
                      </span>
                      {today && (
                        <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-medium">
                          Today
                        </span>
                      )}
                      {itemCount > 0 && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                          {itemCount}
                        </span>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-1.5">
                      {dayEntries.length === 0 && dayWorkLogs.length === 0 && (
                        <p className="text-xs text-gray-400 py-2 text-center">
                          Nothing scheduled
                        </p>
                      )}
                      {dayEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-lg p-2 text-xs bg-white border border-gray-100"
                          style={{
                            borderLeftWidth: '3px',
                            borderLeftColor:
                              entry.client?.color || '#6B7280',
                          }}
                        >
                          <div className="font-medium text-gray-800">
                            {entry.title}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-gray-500">
                            <span>{entry.client?.name}</span>
                            <span className="bg-gray-100 px-1.5 py-0.5 rounded">
                              {getContentTypeLabel(entry.content_type)}
                            </span>
                            {entry.assignee?.name && (
                              <span className="bg-gray-100 px-1 rounded font-medium">
                                {getInitials(entry.assignee.name)}
                              </span>
                            )}
                            {entry.scheduled_time && (
                              <span className="flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {entry.scheduled_time.slice(0, 5)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {dayWorkLogs.map((wl) => (
                        <div
                          key={wl.id}
                          className="rounded-lg p-2 text-xs bg-gray-50 border border-gray-100"
                          style={{
                            borderLeftWidth: '3px',
                            borderLeftColor: '#9CA3AF',
                          }}
                        >
                          <div className="font-medium text-gray-500">
                            {wl.description || wl.service_category}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-gray-400">
                            {wl.team_member?.name && (
                              <span>{wl.team_member.name}</span>
                            )}
                            {wl.client?.name && (
                              <span>{wl.client.name}</span>
                            )}
                            <span>{wl.hours}h</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      ) : (
        /* MONTH VIEW */
        <>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_LABELS.map((d) => (
              <div
                key={d}
                className="text-center text-xs font-medium text-gray-500 py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {monthGrid.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const dayEntries = entriesByDate[key] || []
              const today = isToday(day)
              const inMonth = isSameBSMonth(day, getADDateForBSMonthStart(bsYear, bsMonth))
              const isSelected = selectedDay === key
              const bsDay = getBSDay(day)

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(isSelected ? null : key)}
                  className={`rounded-lg border p-1.5 min-h-[70px] md:min-h-[90px] text-left transition overflow-hidden ${
                    isSelected
                      ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200'
                      : today
                        ? 'border-blue-300 bg-blue-50/40'
                        : inMonth
                          ? 'border-gray-200 bg-white hover:bg-gray-50'
                          : 'border-gray-100 bg-gray-50/50'
                  }`}
                >
                  <span
                    className={`text-xs font-medium ${
                      today
                        ? 'bg-blue-600 text-white px-1.5 py-0.5 rounded-full'
                        : inMonth
                          ? 'text-gray-700'
                          : 'text-gray-300'
                    }`}
                  >
                    {bsDay}
                  </span>
                  {dayEntries.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {dayEntries.slice(0, 2).map((e) => (
                        <div
                          key={e.id}
                          className="text-[10px] leading-tight px-1 py-0.5 rounded truncate font-medium text-white"
                          style={{ backgroundColor: e.client?.color || '#6B7280' }}
                          title={e.title}
                        >
                          {e.title}
                        </div>
                      ))}
                      {dayEntries.length > 2 && (
                        <div className="text-[9px] text-gray-400 pl-0.5 font-medium">
                          +{dayEntries.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Selected day details */}
          {selectedDay && (
            <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-sm text-gray-700 mb-3">
                {formatBSDayDetail(parseISO(selectedDay))}
              </h3>
              {(entriesByDate[selectedDay]?.length || 0) === 0 &&
              (workLogsByDate[selectedDay]?.length || 0) === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  Nothing scheduled for this day
                </p>
              ) : (
                <div className="space-y-2">
                  {(entriesByDate[selectedDay] || []).map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg p-3 border border-gray-100"
                      style={{
                        borderLeftWidth: '3px',
                        borderLeftColor: entry.client?.color || '#6B7280',
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-800">
                            {entry.title}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                            <span>{entry.client?.name}</span>
                            <span className="bg-gray-100 px-1.5 py-0.5 rounded">
                              {getContentTypeLabel(entry.content_type)}
                            </span>
                            {entry.platform && (
                              <span className="bg-gray-100 px-1.5 py-0.5 rounded">
                                {getPlatformLabel(entry.platform)}
                              </span>
                            )}
                            {entry.assignee?.name && (
                              <span>@ {entry.assignee.name}</span>
                            )}
                            {entry.scheduled_time && (
                              <span className="flex items-center gap-0.5">
                                <Clock className="w-3 h-3" />
                                {entry.scheduled_time.slice(0, 5)}
                              </span>
                            )}
                          </div>
                          {entry.description && (
                            <p className="text-xs text-gray-400 mt-1.5">
                              {entry.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {deleteConfirmId === entry.id ? (
                            <>
                              <button onClick={() => handleDeleteEntry(entry.id)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition" title="Confirm delete">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setDeleteConfirmId(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEditEntry(entry)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-blue-500 transition" title="Edit">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setDeleteConfirmId(entry.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-red-500 transition" title="Delete">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(workLogsByDate[selectedDay] || []).map((wl) => (
                    <div
                      key={wl.id}
                      className="rounded-lg p-3 bg-gray-50 border border-gray-100"
                      style={{
                        borderLeftWidth: '3px',
                        borderLeftColor: '#9CA3AF',
                      }}
                    >
                      <div className="font-medium text-sm text-gray-500">
                        {wl.description || wl.service_category}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        {wl.team_member?.name && (
                          <span>{wl.team_member.name}</span>
                        )}
                        {wl.client?.name && <span>{wl.client.name}</span>}
                        <span>{wl.hours}h</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading &&
        entries.length === 0 &&
        workLogs.length === 0 &&
        !showForm && (
          <div className="text-center py-12 text-gray-400">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No content scheduled for this period</p>
            <button
              onClick={() => {
                resetForm()
                setShowForm(true)
              }}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Add your first entry
            </button>
          </div>
        )}
    </div>
  )
}
