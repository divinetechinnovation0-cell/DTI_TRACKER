'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { Plus, Trash2, Receipt, ChevronLeft, ChevronRight } from 'lucide-react'
import { EXPENSE_CATEGORIES, COST_TYPES } from '@/lib/types'
import type { Expense, Client } from '@/lib/types'

export default function ExpensesPage() {
  const supabase = createClient()
  const [month, setMonth] = useState(new Date())
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [memberId, setMemberId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('ad_spend')
  const [costType, setCostType] = useState('serving')
  const [clientId, setClientId] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
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

  const fetchExpenses = useCallback(async () => {
    if (!memberId) return
    setLoading(true)
    const monthStart = format(startOfMonth(month), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('expenses')
      .select('*, client:clients(name)')
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date', { ascending: false })

    if (data) setExpenses(data as unknown as Expense[])
    setLoading(false)
  }, [memberId, month])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberId) return
    setSubmitting(true)

    const entry: Record<string, unknown> = {
      recorded_by: memberId,
      amount: parseFloat(amount),
      category,
      cost_type: costType,
      date,
      description,
    }

    if (clientId && costType === 'serving') {
      entry.client_id = clientId
    }

    const { error } = await supabase.from('expenses').insert(entry)
    if (!error) {
      setAmount('')
      setDescription('')
      setShowForm(false)
      fetchExpenses()
    }
    setSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('expenses').delete().eq('id', id)
    fetchExpenses()
  }

  const changeMonth = (dir: number) => {
    const d = new Date(month)
    d.setMonth(d.getMonth() + dir)
    setMonth(d)
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const servingTotal = expenses.filter(e => e.cost_type === 'serving').reduce((s, e) => s + Number(e.amount), 0)
  const acquisitionTotal = expenses.filter(e => e.cost_type === 'acquisition').reduce((s, e) => s + Number(e.amount), 0)
  const overheadTotal = expenses.filter(e => e.cost_type === 'overhead').reduce((s, e) => s + Number(e.amount), 0)

  const getCategoryLabel = (val: string) =>
    EXPENSE_CATEGORIES.find(c => c.value === val)?.label || val

  const fmtNPR = (n: number) => `रू ${n.toLocaleString()}`

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Expenses</h1>
        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-2 py-1">
          <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium w-28 text-center">{format(month, 'MMM yyyy')}</span>
          <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-lg font-bold">{fmtNPR(total)}</div>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-3">
          <div className="text-xs text-green-600">Serving</div>
          <div className="text-lg font-bold text-green-700">{fmtNPR(servingTotal)}</div>
        </div>
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-3">
          <div className="text-xs text-orange-600">Acquisition</div>
          <div className="text-lg font-bold text-orange-700">{fmtNPR(acquisitionTotal)}</div>
        </div>
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Overhead</div>
          <div className="text-lg font-bold text-gray-700">{fmtNPR(overheadTotal)}</div>
        </div>
      </div>

      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 transition flex items-center justify-center gap-2 text-sm font-medium mb-4"
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-4">
          {/* Cost Type */}
          <div className="flex gap-2">
            {COST_TYPES.map((ct) => (
              <button
                key={ct.value}
                type="button"
                onClick={() => setCostType(ct.value)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                  costType === ct.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {ct.label}
              </button>
            ))}
          </div>

          {/* Amount + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (NPR)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                {EXPENSE_CATEGORIES.map((ec) => (
                  <option key={ec.value} value={ec.value}>{ec.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Client (only for serving) */}
          {costType === 'serving' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date + Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="What was this expense for?"
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

      {/* Expense list */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No expenses this month</div>
        ) : (
          expenses.map((exp) => (
            <div key={exp.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">{fmtNPR(Number(exp.amount))}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {getCategoryLabel(exp.category)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      exp.cost_type === 'serving' ? 'bg-green-100 text-green-700' :
                      exp.cost_type === 'acquisition' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {exp.cost_type}
                    </span>
                  </div>
                  {(exp.client as unknown as { name: string })?.name && (
                    <p className="text-xs text-blue-600 mb-0.5">{(exp.client as unknown as { name: string }).name}</p>
                  )}
                  {exp.description && (
                    <p className="text-sm text-gray-500">{exp.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{format(parseISO(exp.date), 'MMM d, yyyy')}</p>
                </div>
                <button
                  onClick={() => handleDelete(exp.id)}
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
