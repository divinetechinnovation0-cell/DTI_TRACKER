'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Building2, Phone, Mail, User, Pencil, X, Check, Trash2, Package } from 'lucide-react'
import { SERVICE_CATEGORIES } from '@/lib/types'
import type { Client } from '@/lib/types'

type ClientPackage = {
  id: string
  client_id: string
  service_category: string
  quantity_promised: number
  unit: string
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  prospect: 'bg-yellow-100 text-yellow-700',
}

export default function ClientsPage() {
  const supabase = createClient()
  const [clients, setClients] = useState<Client[]>([])
  const [packages, setPackages] = useState<ClientPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Form
  const [name, setName] = useState('')
  const [status, setStatus] = useState<string>('active')
  const [services, setServices] = useState<string[]>([])
  const [contactPerson, setContactPerson] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [notes, setNotes] = useState('')

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
    fetchClients()
  }, [])

  async function fetchClients() {
    setLoading(true)
    const [{ data: clientData }, { data: pkgData }] = await Promise.all([
      supabase.from('clients').select('*').order('status').order('name'),
      supabase.from('client_packages').select('id,client_id,service_category,quantity_promised,unit').eq('is_active', true),
    ])
    if (clientData) setClients(clientData)
    if (pkgData) setPackages(pkgData)
    setLoading(false)
  }

  const toggleService = (val: string) => {
    setServices(prev =>
      prev.includes(val) ? prev.filter(s => s !== val) : [...prev, val]
    )
  }

  const resetForm = () => {
    setName('')
    setStatus('active')
    setServices([])
    setContactPerson('')
    setContactEmail('')
    setContactPhone('')
    setNotes('')
  }

  const startEdit = (c: Client) => {
    setEditingId(c.id)
    setName(c.name)
    setStatus(c.status)
    setServices(c.services || [])
    setContactPerson(c.contact_person || '')
    setContactEmail(c.contact_email || '')
    setContactPhone(c.contact_phone || '')
    setNotes(c.notes || '')
    setShowForm(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const payload = {
      name,
      status,
      services,
      contact_person: contactPerson || null,
      contact_email: contactEmail || null,
      contact_phone: contactPhone || null,
      notes: notes || null,
    }

    if (editingId) {
      const { error } = await supabase
        .from('clients')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editingId)

      if (!error) {
        setEditingId(null)
        resetForm()
        fetchClients()
      }
    } else {
      const { error } = await supabase.from('clients').insert(payload)

      if (!error) {
        resetForm()
        setShowForm(false)
        fetchClients()
      }
    }
    setSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('clients')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setConfirmDeleteId(null)
      fetchClients()
    }
  }

  const getCategoryLabel = (val: string) =>
    SERVICE_CATEGORIES.find(c => c.value === val)?.label || val

  const formContent = (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-4">
      <h3 className="font-semibold text-sm text-gray-700">
        {editingId ? 'Edit Client' : 'Add New Client'}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="active">Active</option>
            <option value="prospect">Prospect</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Services</label>
        <div className="flex flex-wrap gap-2">
          {SERVICE_CATEGORIES.map((sc) => (
            <button
              key={sc.value}
              type="button"
              onClick={() => toggleService(sc.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                services.includes(sc.value)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {sc.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
          <input
            type="text"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            type="text"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
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
          {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Client'}
        </button>
      </div>
    </form>
  )

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Clients</h1>
        {isAdmin && !editingId && (
          <button
            onClick={() => { resetForm(); setShowForm(!showForm) }}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Client
          </button>
        )}
      </div>

      {/* Add/Edit form */}
      {(showForm || editingId) && formContent}

      {/* Client list */}
      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
      ) : clients.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No clients yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <div
              key={client.id}
              className={`bg-white rounded-xl border p-4 transition ${
                editingId === client.id ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <Link href={`/clients/${client.id}`} className="font-semibold hover:text-blue-600 transition">
                    {client.name}
                  </Link>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${STATUS_STYLES[client.status] || ''}`}>
                    {client.status}
                  </span>
                </div>
                {isAdmin && !editingId && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(client)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition"
                      title="Edit client"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {confirmDeleteId === client.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(client.id)}
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
                        onClick={() => setConfirmDeleteId(client.id)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition"
                        title="Deactivate client"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {(() => {
                const clientPkgs = packages.filter(p => p.client_id === client.id)
                if (clientPkgs.length === 0) return null
                return (
                  <div className="mb-3 mt-1">
                    <div className="flex items-center gap-1 mb-1.5">
                      <Package className="w-3 h-3 text-gray-400" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Monthly Package</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {clientPkgs.map(pkg => (
                        <span
                          key={pkg.id}
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border"
                          style={{ borderColor: client.color + '40', backgroundColor: client.color + '12', color: client.color }}
                        >
                          <span className="font-bold">{pkg.quantity_promised}×</span>
                          {pkg.unit}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })()}

              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
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
              {client.notes && (
                <p className="text-xs text-gray-400 mt-2">{client.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
