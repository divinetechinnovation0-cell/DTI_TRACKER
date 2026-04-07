'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns'
import {
  ArrowLeft,
  Clock,
  DollarSign,
  TrendingUp,
  Phone,
  Mail,
  User,
  Plus,
  X,
  Check,
  Trash2,
  ChevronDown,
  Circle,
  CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'
import type {
  Client,
  WorkLog,
  ClientDeliverable,
  Expense,
  ClientPackage,
} from '@/lib/types'
import {
  getCategoryLabel,
  fmtNPR,
  SERVICE_CATEGORIES,
  DELIVERABLE_STATUSES,
} from '@/lib/types'
import { formatNepaliShortDate } from '@/lib/nepali-date'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  prospect: 'bg-yellow-100 text-yellow-700',
}

const DELIVERABLE_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-yellow-100 text-yellow-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
}

const BILLING_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  one_time: 'One-time',
}

type WorkLogWithMember = WorkLog & {
  team_member?: { name: string; monthly_salary?: number }
  client?: { name: string }
}

type DeliverableWithAssignee = ClientDeliverable & {
  assignee?: { name: string }
}

type ExpenseWithRecorder = Expense & {
  recorder?: { name: string }
}

type Tab = 'worklog' | 'deliverables' | 'expenses' | 'packages' | 'tasks'

export default function ClientDetailPage() {
  const params = useParams()
  const clientId = params.id as string
  const supabase = createClient()

  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [memberId, setMemberId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('worklog')

  // Data
  const [workLogs, setWorkLogs] = useState<WorkLogWithMember[]>([])
  const [deliverables, setDeliverables] = useState<DeliverableWithAssignee[]>([])
  const [expenses, setExpenses] = useState<ExpenseWithRecorder[]>([])
  const [packages, setPackages] = useState<ClientPackage[]>([])
  const [clientTasks, setClientTasks] = useState<any[]>([])
  const [members, setMembers] = useState<{ id: string; name: string }[]>([])

  // Stats
  const [monthHours, setMonthHours] = useState(0)
  const [monthCost, setMonthlyCost] = useState(0)

  // Forms
  const [showDeliverableForm, setShowDeliverableForm] = useState(false)
  const [showPackageForm, setShowPackageForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleteConfirmDelId, setDeleteConfirmDelId] = useState<string | null>(null)
  const [deleteConfirmExpId, setDeleteConfirmExpId] = useState<string | null>(null)
  const [deleteConfirmPkgId, setDeleteConfirmPkgId] = useState<string | null>(null)

  // Deliverable form
  const [delTitle, setDelTitle] = useState('')
  const [delStatus, setDelStatus] = useState('pending')
  const [delAssignedTo, setDelAssignedTo] = useState('')
  const [delDueDate, setDelDueDate] = useState('')
  const [delMonth, setDelMonth] = useState(format(new Date(), 'yyyy-MM'))

  // Package form
  const [pkgService, setPkgService] = useState('')
  const [pkgQuantity, setPkgQuantity] = useState('1')
  const [pkgUnit, setPkgUnit] = useState('pieces')
  const [pkgHours, setPkgHours] = useState('0')
  const [pkgPrice, setPkgPrice] = useState('')
  const [pkgBilling, setPkgBilling] = useState('monthly')
  const [pkgStartDate, setPkgStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [pkgNotes, setPkgNotes] = useState('')
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from('team_members')
        .select('id, is_admin')
        .eq('auth_user_id', user.id)
        .single()
      if (member) {
        setIsAdmin(member.is_admin)
        setMemberId(member.id)
      }

      const { data: memberList } = await supabase
        .from('team_members')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      if (memberList) setMembers(memberList)
    }
    init()
  }, [])

  const fetchClient = useCallback(async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()
    if (data) setClient(data)
  }, [clientId])

  const fetchWorkLogs = useCallback(async () => {
    const { data } = await supabase
      .from('work_logs')
      .select(
        '*, team_member:team_members!team_member_id(name, monthly_salary)'
      )
      .eq('client_id', clientId)
      .order('date', { ascending: false })
    if (data) setWorkLogs(data as unknown as WorkLogWithMember[])
  }, [clientId])

  const fetchDeliverables = useCallback(async () => {
    const { data } = await supabase
      .from('client_deliverables')
      .select('*, assignee:team_members!assigned_to(name)')
      .eq('client_id', clientId)
      .order('due_date', { ascending: true, nullsFirst: false })
    if (data) setDeliverables(data as unknown as DeliverableWithAssignee[])
  }, [clientId])

  const fetchExpenses = useCallback(async () => {
    const { data } = await supabase
      .from('expenses')
      .select('*, recorder:team_members!recorded_by(name)')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
    if (data) setExpenses(data as unknown as ExpenseWithRecorder[])
  }, [clientId])

  const fetchPackages = useCallback(async () => {
    const { data } = await supabase
      .from('client_packages')
      .select('*')
      .eq('client_id', clientId)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false })
    if (data) setPackages(data)
  }, [clientId])

  const fetchClientTasks = useCallback(async () => {
    const { data: taskData } = await supabase
      .from('tasks')
      .select('*, assignee:team_members!assigned_to(name), assigner:team_members!assigned_by(name)')
      .eq('client_id', clientId)
      .order('status', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
    if (taskData) setClientTasks(taskData)
  }, [clientId])

  const computeStats = useCallback(async () => {
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')

    const { data: monthLogs } = await supabase
      .from('work_logs')
      .select('hours, team_member:team_members!team_member_id(monthly_salary)')
      .eq('client_id', clientId)
      .gte('date', monthStart)
      .lte('date', monthEnd)

    if (monthLogs) {
      const totalH = monthLogs.reduce(
        (s: number, l: { hours: number }) => s + Number(l.hours),
        0
      )
      setMonthHours(totalH)

      // cost = sum of (hours * hourly_rate), hourly_rate = monthly_salary / (22*8)
      let cost = 0
      monthLogs.forEach((l: any) => {
        const tm = Array.isArray(l.team_member) ? l.team_member[0] : l.team_member
        const salary = tm?.monthly_salary || 0
        const hourlyRate = salary / (22 * 8)
        cost += Number(l.hours) * hourlyRate
      })

      // Add expenses for the month
      const { data: monthExpenses } = await supabase
        .from('expenses')
        .select('amount')
        .eq('client_id', clientId)
        .gte('date', monthStart)
        .lte('date', monthEnd)

      const expenseCost = (monthExpenses || []).reduce(
        (s: number, e: { amount: number }) => s + Number(e.amount),
        0
      )

      setMonthlyCost(cost + expenseCost)
    }
  }, [clientId])

  useEffect(() => {
    async function loadAll() {
      setLoading(true)
      await fetchClient()
      await Promise.all([
        fetchWorkLogs(),
        fetchDeliverables(),
        fetchExpenses(),
        fetchPackages(),
        fetchClientTasks(),
        computeStats(),
      ])
      setLoading(false)
    }
    loadAll()
  }, [
    fetchClient,
    fetchWorkLogs,
    fetchDeliverables,
    fetchExpenses,
    fetchPackages,
    fetchClientTasks,
    computeStats,
  ])

  // Group work logs by week
  const groupedWorkLogs = (() => {
    const groups: Record<string, { logs: WorkLogWithMember[]; totalHours: number }> = {}
    workLogs.forEach((log) => {
      const weekStart = format(
        startOfWeek(parseISO(log.date), { weekStartsOn: 1 }),
        'yyyy-MM-dd'
      )
      if (!groups[weekStart]) groups[weekStart] = { logs: [], totalHours: 0 }
      groups[weekStart].logs.push(log)
      groups[weekStart].totalHours += Number(log.hours)
    })
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  })()

  // Hours used this month per package service
  const hoursUsedByService = (() => {
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')
    const map: Record<string, number> = {}
    workLogs
      .filter((l) => l.date >= monthStart && l.date <= monthEnd)
      .forEach((l) => {
        const key = l.service_category
        map[key] = (map[key] || 0) + Number(l.hours)
      })
    return map
  })()

  const handleAddDeliverable = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const payload: Record<string, unknown> = {
      client_id: clientId,
      title: delTitle,
      status: delStatus,
      notes: '',
    }
    if (delAssignedTo) payload.assigned_to = delAssignedTo
    if (delDueDate) payload.due_date = delDueDate
    if (delMonth) payload.month = delMonth + '-01'

    const { error } = await supabase.from('client_deliverables').insert(payload)
    if (!error) {
      setDelTitle('')
      setDelStatus('pending')
      setDelAssignedTo('')
      setDelDueDate('')
      setDelMonth(format(new Date(), 'yyyy-MM'))
      setShowDeliverableForm(false)
      fetchDeliverables()
    }
    setSubmitting(false)
  }

  const handleUpdateDeliverableStatus = async (
    id: string,
    newStatus: string
  ) => {
    const update: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    }
    if (newStatus === 'delivered') {
      update.delivery_date = format(new Date(), 'yyyy-MM-dd')
    }
    await supabase.from('client_deliverables').update(update).eq('id', id)
    fetchDeliverables()
  }

  const handleDeleteDeliverable = async (id: string) => {
    await supabase.from('client_deliverables').delete().eq('id', id)
    setDeleteConfirmDelId(null)
    fetchDeliverables()
  }

  const handleDeleteExpense = async (id: string) => {
    await supabase.from('expenses').delete().eq('id', id)
    setDeleteConfirmExpId(null)
    fetchExpenses()
    computeStats()
  }

  const handleDeletePackage = async (id: string) => {
    await supabase.from('client_packages').delete().eq('id', id)
    setDeleteConfirmPkgId(null)
    fetchPackages()
  }

  const resetPackageForm = () => {
    setPkgService('')
    setPkgQuantity('1')
    setPkgUnit('pieces')
    setPkgHours('0')
    setPkgPrice('')
    setPkgBilling('monthly')
    setPkgStartDate(format(new Date(), 'yyyy-MM-dd'))
    setPkgNotes('')
    setEditingPackageId(null)
  }

  const startEditPackage = (pkg: ClientPackage) => {
    setEditingPackageId(pkg.id)
    setPkgService(pkg.service_category)
    setPkgQuantity(String(pkg.quantity_promised))
    setPkgUnit(pkg.unit)
    setPkgHours(String(pkg.hours_budgeted))
    setPkgPrice(String(pkg.price_npr))
    setPkgBilling(pkg.billing_cycle)
    setPkgStartDate(pkg.start_date)
    setPkgNotes(pkg.notes || '')
    setShowPackageForm(true)
  }

  const handleSubmitPackage = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const payload = {
      client_id: clientId,
      service_category: pkgService,
      quantity_promised: parseInt(pkgQuantity),
      unit: pkgUnit,
      hours_budgeted: parseFloat(pkgHours),
      price_npr: parseFloat(pkgPrice),
      billing_cycle: pkgBilling,
      start_date: pkgStartDate,
      is_active: true,
      notes: pkgNotes || '',
    }

    if (editingPackageId) {
      const { error } = await supabase
        .from('client_packages')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editingPackageId)
      if (!error) {
        resetPackageForm()
        setShowPackageForm(false)
        fetchPackages()
      }
    } else {
      const { error } = await supabase.from('client_packages').insert(payload)
      if (!error) {
        resetPackageForm()
        setShowPackageForm(false)
        fetchPackages()
      }
    }
    setSubmitting(false)
  }

  const toggleClientTask = async (task: any) => {
    const newStatus = task.status === 'done' ? 'open' : 'done'
    await supabase.from('tasks').update({
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null,
    }).eq('id', task.id)
    setClientTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null } : t))
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="text-center py-12 text-gray-400 text-sm">
          Loading...
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <p className="text-gray-400">Client not found</p>
        <Link
          href="/clients"
          className="text-blue-600 text-sm mt-2 inline-block"
        >
          Back to clients
        </Link>
      </div>
    )
  }

  const suggestedMinPrice = monthCost * 1.3

  const tabs: { key: Tab; label: string }[] = [
    { key: 'worklog', label: 'Work Log' },
    { key: 'deliverables', label: 'Deliverables' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'packages', label: 'Packages' },
    { key: 'tasks', label: 'Tasks' },
  ]

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        All Clients
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg"
              style={{ backgroundColor: client.color }}
            />
            <div>
              <h1 className="text-xl font-bold">{client.name}</h1>
              <span
                className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${
                  STATUS_STYLES[client.status] || ''
                }`}
              >
                {client.status}
              </span>
            </div>
          </div>
        </div>
        {(client.contact_person || client.contact_email || client.contact_phone) && (
          <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
            {client.contact_person && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" /> {client.contact_person}
              </span>
            )}
            {client.contact_email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" /> {client.contact_email}
              </span>
            )}
            {client.contact_phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" /> {client.contact_phone}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-gray-500">Hours (month)</span>
          </div>
          <p className="text-lg font-bold text-gray-800">
            {monthHours.toFixed(1)}h
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-gray-500">Cost (month)</span>
          </div>
          <p className="text-lg font-bold text-gray-800">
            {fmtNPR(monthCost)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-500">Min price</span>
          </div>
          <p className="text-lg font-bold text-gray-800">
            {fmtNPR(suggestedMinPrice)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4 overflow-x-auto">
        {tabs
          .filter((t) => t.key !== 'packages' || isAdmin)
          .map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition border-b-2 -mb-px ${
                activeTab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>

      {/* TAB: Work Log */}
      {activeTab === 'worklog' && (
        <div className="space-y-4">
          {groupedWorkLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No work logged for this client
            </div>
          ) : (
            groupedWorkLogs.map(([weekStart, { logs, totalHours }]) => (
              <div
                key={weekStart}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                <div className="flex items-center justify-between bg-gray-50 px-4 py-2 border-b border-gray-100">
                  <span className="text-xs font-medium text-gray-500">
                    Week of{' '}
                    {format(parseISO(weekStart), 'MMM d, yyyy')}
                  </span>
                  <span className="text-xs font-bold text-blue-600">
                    {totalHours.toFixed(1)}h
                  </span>
                </div>
                <div className="divide-y divide-gray-50">
                  {logs.map((log) => (
                    <div key={log.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">
                            {log.team_member?.name || 'Unknown'}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {getCategoryLabel(log.service_category)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            {log.hours}h
                          </span>
                          <span className="text-xs text-gray-400">
                            {format(parseISO(log.date), 'MMM d')}
                          </span>
                        </div>
                      </div>
                      {log.description && (
                        <p className="text-xs text-gray-500 mt-1">
                          {log.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB: Deliverables */}
      {activeTab === 'deliverables' && (
        <div>
          {isAdmin && !showDeliverableForm && (
            <button
              onClick={() => setShowDeliverableForm(true)}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 transition flex items-center justify-center gap-2 text-sm font-medium mb-4"
            >
              <Plus className="w-4 h-4" />
              Add Deliverable
            </button>
          )}

          {showDeliverableForm && (
            <form
              onSubmit={handleAddDeliverable}
              className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-gray-700">
                  New Deliverable
                </h3>
                <button
                  type="button"
                  onClick={() => setShowDeliverableForm(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={delTitle}
                  onChange={(e) => setDelTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={delStatus}
                    onChange={(e) => setDelStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {DELIVERABLE_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assigned To
                  </label>
                  <select
                    value={delAssignedTo}
                    onChange={(e) => setDelAssignedTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={delDueDate}
                    onChange={(e) => setDelDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Month
                  </label>
                  <input
                    type="month"
                    value={delMonth}
                    onChange={(e) => setDelMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeliverableForm(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Add'}
                </button>
              </div>
            </form>
          )}

          {deliverables.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No deliverables yet
            </div>
          ) : (
            <div className="space-y-2">
              {deliverables.map((del) => (
                <div
                  key={del.id}
                  className="bg-white rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-sm text-gray-800">
                        {del.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {isAdmin ? (
                          <select
                            value={del.status}
                            onChange={(e) =>
                              handleUpdateDeliverableStatus(
                                del.id,
                                e.target.value
                              )
                            }
                            className={`text-xs px-2 py-0.5 rounded-full border-none outline-none cursor-pointer ${
                              DELIVERABLE_STATUS_STYLES[del.status] || ''
                            }`}
                          >
                            {DELIVERABLE_STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              DELIVERABLE_STATUS_STYLES[del.status] || ''
                            }`}
                          >
                            {DELIVERABLE_STATUSES.find(
                              (s) => s.value === del.status
                            )?.label || del.status}
                          </span>
                        )}
                        {del.assignee?.name && (
                          <span className="text-xs text-gray-500">
                            @ {del.assignee.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {del.due_date && (
                        <span className="text-xs text-gray-400">
                          Due {format(parseISO(del.due_date), 'MMM d')}
                        </span>
                      )}
                      {isAdmin && (
                        deleteConfirmDelId === del.id ? (
                          <div className="flex gap-1">
                            <button onClick={() => handleDeleteDeliverable(del.id)} className="p-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setDeleteConfirmDelId(null)} className="p-1 rounded hover:bg-gray-100 text-gray-400 transition"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirmDelId(del.id)} className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-red-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: Expenses */}
      {activeTab === 'expenses' && (
        <div>
          {expenses.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No expenses recorded for this client
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map((exp) => (
                <div
                  key={exp.id}
                  className="bg-white rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full capitalize">
                          {exp.category.replace('_', ' ')}
                        </span>
                        <span className="font-semibold text-sm text-gray-800">
                          {fmtNPR(exp.amount)}
                        </span>
                      </div>
                      {exp.description && (
                        <p className="text-xs text-gray-500">
                          {exp.description}
                        </p>
                      )}
                      {exp.recorder?.name && (
                        <p className="text-xs text-gray-400 mt-1">
                          by {exp.recorder.name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {format(parseISO(exp.date), 'MMM d, yyyy')}
                      </span>
                      {isAdmin && (
                        deleteConfirmExpId === exp.id ? (
                          <div className="flex gap-1">
                            <button onClick={() => handleDeleteExpense(exp.id)} className="p-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setDeleteConfirmExpId(null)} className="p-1 rounded hover:bg-gray-100 text-gray-400 transition"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirmExpId(exp.id)} className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-red-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: Packages (admin only) */}
      {activeTab === 'packages' && isAdmin && (
        <div>
          {!showPackageForm && (
            <button
              onClick={() => {
                resetPackageForm()
                setShowPackageForm(true)
              }}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 transition flex items-center justify-center gap-2 text-sm font-medium mb-4"
            >
              <Plus className="w-4 h-4" />
              Add Package
            </button>
          )}

          {showPackageForm && (
            <form
              onSubmit={handleSubmitPackage}
              className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-gray-700">
                  {editingPackageId ? 'Edit Package' : 'New Package'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    resetPackageForm()
                    setShowPackageForm(false)
                  }}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={pkgService}
                    onChange={(e) => setPkgService(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select...</option>
                    {SERVICE_CATEGORIES.map((sc) => (
                      <option key={sc.value} value={sc.value}>
                        {sc.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Billing Cycle
                  </label>
                  <select
                    value={pkgBilling}
                    onChange={(e) => setPkgBilling(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="one_time">One-time</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={pkgQuantity}
                    onChange={(e) => setPkgQuantity(e.target.value)}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={pkgUnit}
                    onChange={(e) => setPkgUnit(e.target.value)}
                    placeholder="pieces, posts, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hours Budget
                  </label>
                  <input
                    type="number"
                    value={pkgHours}
                    onChange={(e) => setPkgHours(e.target.value)}
                    min="0"
                    step="0.5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (NPR) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={pkgPrice}
                    onChange={(e) => setPkgPrice(e.target.value)}
                    required
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={pkgStartDate}
                    onChange={(e) => setPkgStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={pkgNotes}
                  onChange={(e) => setPkgNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetPackageForm()
                    setShowPackageForm(false)
                  }}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submitting
                    ? 'Saving...'
                    : editingPackageId
                      ? 'Save Changes'
                      : 'Add Package'}
                </button>
              </div>
            </form>
          )}

          {packages.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No packages configured
            </div>
          ) : (
            <div className="space-y-3">
              {packages.map((pkg) => {
                const usedHours =
                  hoursUsedByService[pkg.service_category] || 0
                const budgetPct =
                  pkg.hours_budgeted > 0
                    ? Math.min((usedHours / pkg.hours_budgeted) * 100, 100)
                    : 0
                const overBudget =
                  pkg.hours_budgeted > 0 && usedHours > pkg.hours_budgeted

                return (
                  <div
                    key={pkg.id}
                    className={`bg-white rounded-xl border p-4 ${
                      pkg.is_active
                        ? 'border-gray-200'
                        : 'border-gray-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-sm text-gray-800">
                          {getCategoryLabel(pkg.service_category)}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                          <span>
                            {pkg.quantity_promised} {pkg.unit}
                          </span>
                          <span>{fmtNPR(pkg.price_npr)}</span>
                          <span className="bg-gray-100 px-1.5 py-0.5 rounded">
                            {BILLING_LABELS[pkg.billing_cycle] ||
                              pkg.billing_cycle}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEditPackage(pkg)} className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 transition">Edit</button>
                        {deleteConfirmPkgId === pkg.id ? (
                          <>
                            <button onClick={() => handleDeletePackage(pkg.id)} className="p-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setDeleteConfirmPkgId(null)} className="p-1 rounded hover:bg-gray-100 text-gray-400 transition"><X className="w-3.5 h-3.5" /></button>
                          </>
                        ) : (
                          <button onClick={() => setDeleteConfirmPkgId(pkg.id)} className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-red-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    {pkg.hours_budgeted > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-500">
                            Hours: {usedHours.toFixed(1)} /{' '}
                            {pkg.hours_budgeted}h
                          </span>
                          <span
                            className={`font-medium ${
                              overBudget ? 'text-red-600' : 'text-gray-600'
                            }`}
                          >
                            {budgetPct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              overBudget ? 'bg-red-500' : budgetPct > 80 ? 'bg-yellow-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${Math.min(budgetPct, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {pkg.notes && (
                      <p className="text-xs text-gray-400 mt-2">{pkg.notes}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: Tasks */}
      {activeTab === 'tasks' && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Left: Active Packages */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Monthly Packages</h3>
            {packages.filter(p => p.is_active).length === 0 ? (
              <p className="text-sm text-gray-400">No active packages</p>
            ) : (
              <div className="space-y-3">
                {packages.filter(p => p.is_active).map(pkg => (
                  <div key={pkg.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="font-medium text-sm text-gray-900">{getCategoryLabel(pkg.service_category)}</div>
                    <div className="text-xs text-gray-500 mt-1">{pkg.quantity_promised} {pkg.unit} · {fmtNPR(pkg.price_npr)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{BILLING_LABELS[pkg.billing_cycle] || pkg.billing_cycle}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Right: Tasks */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Tasks</h3>
            {clientTasks.length === 0 ? (
              <p className="text-sm text-gray-400">No tasks for this client</p>
            ) : (
              <div className="space-y-2">
                {clientTasks.map(task => {
                  const isDone = task.status === 'done'
                  return (
                    <div key={task.id} className={`flex items-start gap-3 p-2 rounded-lg border border-gray-100 ${isDone ? 'opacity-60' : ''}`}>
                      <button onClick={() => toggleClientTask(task)} className="mt-0.5 flex-shrink-0">
                        {isDone ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5 text-gray-300 hover:text-blue-400 transition" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {task.assignee && <span className="text-xs text-gray-500">{task.assignee.name}</span>}
                          {task.due_date && <span className="text-xs text-gray-400">{formatNepaliShortDate(parseISO(task.due_date))}</span>}
                          {task.priority === 'urgent' && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Urgent</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
