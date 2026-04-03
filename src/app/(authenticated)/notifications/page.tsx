'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  parseISO,
} from 'date-fns'
import { formatNepaliRelativeTime } from '@/lib/nepali-date'
import {
  Bell,
  CheckSquare,
  Check,
  Clock,
  Info,
  CheckCheck,
} from 'lucide-react'
import type { Notification } from '@/lib/types'

type NotificationWithSender = Notification & {
  sender?: { name: string }
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  task_assigned: CheckSquare,
  task_done: Check,
  ping: Bell,
  reminder: Clock,
  system: Info,
}

const TYPE_ICON_STYLES: Record<string, string> = {
  task_assigned: 'text-blue-500 bg-blue-50',
  task_done: 'text-green-500 bg-green-50',
  ping: 'text-orange-500 bg-orange-50',
  reminder: 'text-purple-500 bg-purple-50',
  system: 'text-gray-500 bg-gray-50',
}

export default function NotificationsPage() {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<NotificationWithSender[]>([])
  const [loading, setLoading] = useState(true)
  const [memberId, setMemberId] = useState<string | null>(null)

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
    }
    init()
  }, [])

  const fetchNotifications = useCallback(async () => {
    if (!memberId) return
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*, sender:team_members!sender_id(name)')
      .eq('recipient_id', memberId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (data) setNotifications(data as unknown as NotificationWithSender[])
    setLoading(false)
  }, [memberId])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Realtime subscription
  useEffect(() => {
    if (!memberId) return

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${memberId}`,
        },
        async (payload) => {
          // Fetch the full notification with sender join
          const { data } = await supabase
            .from('notifications')
            .select('*, sender:team_members!sender_id(name)')
            .eq('id', payload.new.id)
            .single()
          if (data) {
            setNotifications((prev) => [
              data as unknown as NotificationWithSender,
              ...prev,
            ])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [memberId])

  const markAsRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
  }

  const markAllRead = async () => {
    if (!memberId) return
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', memberId)
      .eq('is_read', false)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const getRelativeTime = (dateStr: string) => {
    try {
      return formatNepaliRelativeTime(parseISO(dateStr))
    } catch {
      return ''
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      {/* Notification list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          Loading...
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">No notifications yet</p>
          <p className="text-xs mt-1">
            You&apos;ll see task assignments, pings, and reminders here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const IconComponent = TYPE_ICONS[notif.type] || Bell
            const iconStyle = TYPE_ICON_STYLES[notif.type] || 'text-gray-500 bg-gray-50'

            return (
              <button
                key={notif.id}
                onClick={() => {
                  if (!notif.is_read) markAsRead(notif.id)
                }}
                className={`w-full text-left rounded-xl border p-4 transition ${
                  notif.is_read
                    ? 'bg-white border-gray-200'
                    : 'bg-blue-50/50 border-blue-200'
                }`}
                style={
                  !notif.is_read
                    ? { borderLeftWidth: '3px', borderLeftColor: '#3B82F6' }
                    : {}
                }
              >
                <div className="flex gap-3">
                  {/* Icon */}
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconStyle}`}
                  >
                    <IconComponent className="w-4 h-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className={`text-sm font-medium ${
                          notif.is_read ? 'text-gray-700' : 'text-gray-900'
                        }`}
                      >
                        {notif.title}
                      </h3>
                      <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">
                        {getRelativeTime(notif.created_at)}
                      </span>
                    </div>
                    {notif.body && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {notif.body}
                      </p>
                    )}
                    {notif.sender?.name && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        from {notif.sender.name}
                      </p>
                    )}
                  </div>

                  {/* Unread dot */}
                  {!notif.is_read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
