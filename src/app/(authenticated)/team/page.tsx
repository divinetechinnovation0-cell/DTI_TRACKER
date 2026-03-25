'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { Plus, Users, Shield, Clock, CalendarCheck, Pencil, X, Check, Trash2 } from 'lucide-react'
import type { TeamMember } from '@/lib/types'

type MemberStats = {
  hours: number
  presentDays: number
  totalAttendance: number
}

export default function TeamPage() {
  const supabase = createClient()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [stats, setStats] = useState<Record<string, MemberStats>>({})
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Form state (shared for add & edit)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [primaryWork, setPrimaryWork] = useState('')
  const [salary, setSalary] = useState('')
  const [formIsAdmin, setFormIsAdmin] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: member } = await supabase
        .from('team_members')
        .select('is_admin')
        .eq('auth_user_id', user.id)
        .single()
      if (member) setIsAdmin(member.is_admin)
    }
    init()
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const now = new Date()
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

    const [
      { data: membersData },
      { data: workLogs },
      { data: attendance },
    ] = await Promise.all([
      supabase.from('team_members').select('*').eq('is_active', true).order('name'),
      supabase.from('work_logs').select('team_member_id, hours').gte('date', monthStart).lte('date', monthEnd),
      supabase.from('attendance').select('team_member_id, status').gte('date', monthStart).lte('date', monthEnd),
    ])

    if (membersData) setMembers(membersData)

    const s: Record<string, MemberStats> = {}
    for (const m of membersData || []) {
      const memberLogs = (workLogs || []).filter(l => l.team_member_id === m.id)
      const memberAttendance = (attendance || []).filter(a => a.team_member_id === m.id)
      s[m.id] = {
        hours: memberLogs.reduce((sum, l) => sum + Number(l.hours), 0),
        presentDays: memberAttendance.filter(a => a.status === 'present' || a.status === 'half_day').length,
        totalAttendance: memberAttendance.length,
      }
    }
    setStats(s)
    setLoading(false)
  }

  const resetForm = () => {
    setName('')
    setEmail('')
    setRole('')
    setPrimaryWork('')
    setSalary('')
    setFormIsAdmin(false)
  }

  const startEdit = (m: TeamMember) => {
    setEditingId(m.id)
    setName(m.name)
    setEmail(m.email)
    setRole(m.role || '')
    setPrimaryWork(m.primary_work || '')
    setSalary(String(m.monthly_salary || 0))
    setFormIsAdmin(m.is_admin)
    setShowForm(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    if (editingId) {
      // Update existing
      const { error } = await supabase
        .from('team_members')
        .update({
          name,
          email,
          role,
          primary_work: primaryWork,
          monthly_salary: parseFloat(salary) || 0,
          is_admin: formIsAdmin,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId)

      if (!error) {
        setEditingId(null)
        resetForm()
        fetchData()
      }
    } else {
      // Insert new
      const { error } = await supabase.from('team_members').insert({
        name,
        email,
        role,
        primary_work: primaryWork,
        monthly_salary: parseFloat(salary) || 0,
        is_admin: formIsAdmin,
      })

      if (!error) {
        resetForm()
        setShowForm(false)
        fetchData()
      }
    }
    setSubmitting(false)
  }

  const handleDeactivate = async (id: string) => {
    const { error } = await supabase
      .from('team_members')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setConfirmDeleteId(null)
      fetchData()
    }
  }

  if (!isAdmin && !loading) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-gray-500">Only admins can access team management.</p>
      </div>
    )
  }

  const fmtNPR = (n: number) => `रू ${Number(n).toLocaleString()}`

  const formContent = (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-4">
      <h3 className="font-semibold text-sm text-gray-700">
        {editingId ? 'Edit Member' : 'Add New Member'}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Designer, Developer"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Primary Work</label>
          <input
            type="text"
            value={primaryWork}
            onChange={(e) => setPrimaryWork(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Video Editing, Meta Ads"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Salary (NPR)</label>
          <input
            type="number"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formIsAdmin}
              onChange={(e) => setFormIsAdmin(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Admin access</span>
          </label>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { editingId ? cancelEdit() : setShowForm(false) }}
          className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Member'}
        </button>
      </div>

      {!editingId && (
        <p className="text-xs text-gray-400">
          Note: This creates the team record. The member still needs to create an account from the login page to log in.
        </p>
      )}
    </form>
  )

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Team</h1>
        {!editingId && (
          <button
            onClick={() => { resetForm(); setShowForm(!showForm) }}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Member
          </button>
        )}
      </div>

      {/* Add/Edit form */}
      {(showForm || editingId) && formContent}

      {/* Team list */}
      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="space-y-3">
          {members.map((m) => {
            const s = stats[m.id] || { hours: 0, presentDays: 0, totalAttendance: 0 }
            const rate = s.totalAttendance > 0 ? Math.round((s.presentDays / s.totalAttendance) * 100) : 0
            const isBeingEdited = editingId === m.id
            return (
              <div
                key={m.id}
                className={`bg-white rounded-xl border p-4 transition ${
                  isBeingEdited ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{m.name}</h3>
                      {m.is_admin && (
                        <span className="flex items-center gap-0.5 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          <Shield className="w-3 h-3" /> Admin
                        </span>
                      )}
                      {m.auth_user_id ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Linked</span>
                      ) : (
                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Not registered</span>
                      )}
                    </div>
                    {m.primary_work && (
                      <p className="text-sm text-gray-500">{m.primary_work}</p>
                    )}
                    <p className="text-xs text-gray-400">{m.role}{m.email ? ` · ${m.email}` : ''}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="text-right">
                      <div className="text-sm font-medium">{fmtNPR(m.monthly_salary)}</div>
                      <div className="text-xs text-gray-400">/ month</div>
                    </div>
                    {!editingId && (
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={() => startEdit(m)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition"
                          title="Edit member"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {confirmDeleteId === m.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeactivate(m.id)}
                              className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
                              title="Confirm deactivate"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(m.id)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition"
                            title="Deactivate member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="font-medium">{s.hours}h</span>
                    <span className="text-xs text-gray-400">this month</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <CalendarCheck className="w-4 h-4 text-green-500" />
                    <span className="font-medium">{rate}%</span>
                    <span className="text-xs text-gray-400">attendance</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
