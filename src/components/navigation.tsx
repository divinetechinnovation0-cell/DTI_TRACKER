'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Clock, CalendarCheck, Receipt, Users, Building2,
  LogOut, CalendarDays, CheckSquare, Bell, Plus, MessageCircle
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/work-log', label: 'Log', icon: Clock, highlight: true },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/attendance', label: 'Attendance', icon: CalendarCheck },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/clients', label: 'Clients', icon: Building2 },
  { href: '/team', label: 'Team', icon: Users, adminOnly: true },
]

export default function Navigation({ isAdmin, memberName, memberId }: {
  isAdmin: boolean
  memberName: string
  memberId: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    async function fetchUnread() {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', memberId)
        .eq('is_read', false)
      setUnreadCount(count || 0)
    }
    fetchUnread()

    const channel = supabase
      .channel('nav-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${memberId}`,
      }, () => { fetchUnread() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [memberId])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const items = navItems.filter(i => !i.adminOnly || isAdmin)

  // Mobile: show 5 items max
  const mobileItems = [
    items.find(i => i.href === '/'),
    items.find(i => i.href === '/work-log'),
    items.find(i => i.href === '/tasks'),
    items.find(i => i.href === '/chat'),
    items.find(i => i.href === '/calendar'),
  ].filter(Boolean) as typeof navItems

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-56 md:fixed md:inset-y-0 bg-white border-r border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-blue-600">DTI Tracker</h1>
          <p className="text-xs text-gray-400 mt-0.5">{memberName}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Notifications + Logout */}
        <div className="p-3 border-t border-gray-200 space-y-1">
          <Link
            href="/notifications"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition relative ${
              pathname === '/notifications' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Bell className="w-5 h-5" />
            Notifications
            {unreadCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 w-full transition"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
        <div className="flex justify-around py-1.5">
          {mobileItems.map((item) => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            const isLog = item.highlight
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 text-xs relative ${
                  isLog
                    ? 'text-white'
                    : active ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                {isLog ? (
                  <span className="bg-blue-600 rounded-full p-2.5 -mt-5 shadow-lg">
                    <Plus className="w-5 h-5" />
                  </span>
                ) : (
                  <item.icon className="w-5 h-5" />
                )}
                <span className={isLog ? 'text-blue-600 font-medium' : ''}>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Mobile notification badge (top right) */}
      {unreadCount > 0 && (
        <Link
          href="/notifications"
          className="md:hidden fixed top-3 right-3 z-50 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg"
        >
          <Bell className="w-4 h-4" />
        </Link>
      )}
    </>
  )
}
