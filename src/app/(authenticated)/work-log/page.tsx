'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { Plus, Trash2, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { SERVICE_CATEGORIES, WORK_TYPES } from '@/lib/types'
import type { WorkLog, Client } from '@/lib/types'

export default function WorkLogPage() {
  const supabase = createClient()
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [logs, setLogs] = useState<WorkLog[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [memberId, setMemberId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [clientId, setClientId] = useState('')
  const [hours, setHours] = useState('1')
  const [workType, setWorkType] = useState<string>('serving')
  const [serviceCategory, setServiceCategory] = useState('meta_ads')
  const [description, setDescription] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
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
    }
    init()
  }, [])

  const fetchLogs = useCallback(async () => {
    if (!memberId) return
    setLoading(true)
    const { data } = await supabase
      .from('work_logs')
      .select('*, client:clients(name)')
      .eq('team_member_id', memberId)
      .eq('date', date)
      .order('created_at', { ascending: false })

    if (data) setLogs(data as unknown as WorkLog[])
    setLoading(false)
  }, [memberId, date])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberId) return
    setSubmitting(true)

    const entry: Record<string, unknown> = {
      team_member_id: memberId,
      date,
      hours: parseFloat(hours),
      work_type: workType,
      service_category: serviceCategory,
      description,
    }

    if (clientId && workType === 'serving') {
      entry.client_id = clientId
    } else if (clientId) {
      entry.client_id = clientId
    }

    const { error } = await supabase.from('work_logs').insert(entry)
    if (!error) {
      setDescription('')
      setHours('1')
      setShowForm(false)
      fetchLogs()
    }
    setSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('work_logs').delete().eq('id', id)
    fetchLogs()
  }

  const changeDate = (days: number) => {
    const d = parseISO(date)
    d.setDate(d.getDate() + days)
    setDate(format(d, 'yyyy-MM-dd'))
  }

  const totalHours = logs.reduce((sum, l) => sum + Number(l.hours), 0)
  const getCategoryLabel = (val: string) =>
    SERVICE_CATEGORIES.find(c => c.value === val)?.label || val

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Work Log</h1>
        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-2 py-1">
          <button onClick={() => changeDate(-1)} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-sm border-none outline-none bg-transparent w-32 text-center"
          />
          <button onClick={() => changeDate(1)} className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Total hours card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">Today&apos;s Total</span>
        </div>
        <span className="text-2xl font-bold text-blue-700">{totalHours}h</span>
      </div>

      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 transition flex items-center justify-center gap-2 text-sm font-medium mb-4"
        >
          <Plus className="w-4 h-4" />
          Log Work
        </button>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-4">
          {/* Work Type */}
          <div className="flex gap-2">
            {WORK_TYPES.map((wt) => (
              <button
                key={wt.value}
                type="button"
                onClick={() => setWorkType(wt.value)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                  workType === wt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {wt.label}
              </button>
            ))}
          </div>

          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client {workType === 'serving' && <span className="text-red-500">*</span>}
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required={workType === 'serving'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">
                {workType === 'serving' ? 'Select client...' : 'No client (optional)'}
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Hours + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hours</label>
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                min="0.5"
                max="24"
                step="0.5"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
              <select
                value={serviceCategory}
                onChange={(e) => setServiceCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SERVICE_CATEGORIES.map((sc) => (
                  <option key={sc.value} value={sc.value}>{sc.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">What did you do?</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Brief description of your work..."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {/* Log entries */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No work logged for this day</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {(log.client as unknown as { name: string })?.name ||
                       (log.work_type === 'internal' ? 'Internal' : 'Acquisition')}
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {log.hours}h
                    </span>
                  </div>
                  <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mb-1">
                    {getCategoryLabel(log.service_category)}
                  </span>
                  {log.description && (
                    <p className="text-sm text-gray-500 mt-1">{log.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(log.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
