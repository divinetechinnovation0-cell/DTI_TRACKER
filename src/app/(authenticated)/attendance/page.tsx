'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isSameDay } from 'date-fns'
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Attendance } from '@/lib/types'

const STATUS_CONFIG = {
  present: { label: 'Present', color: 'bg-green-100 text-green-700 border-green-300', dot: 'bg-green-500' },
  half_day: { label: 'Half Day', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', dot: 'bg-yellow-500' },
  leave: { label: 'Leave', color: 'bg-blue-100 text-blue-700 border-blue-300', dot: 'bg-blue-500' },
  absent: { label: 'Absent', color: 'bg-red-100 text-red-700 border-red-300', dot: 'bg-red-500' },
}

export default function AttendancePage() {
  const supabase = createClient()
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [memberId, setMemberId] = useState<string | null>(null)
  const [todayStatus, setTodayStatus] = useState<Attendance | null>(null)
  const [monthRecords, setMonthRecords] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
    }
    init()
  }, [])

  const fetchAttendance = useCallback(async () => {
    if (!memberId) return
    setLoading(true)

    // Fetch today's record
    const { data: todayData } = await supabase
      .from('attendance')
      .select('*')
      .eq('team_member_id', memberId)
      .eq('date', date)
      .single()

    setTodayStatus(todayData as Attendance | null)

    // Fetch month records
    const monthStart = format(startOfMonth(parseISO(date)), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(parseISO(date)), 'yyyy-MM-dd')

    const { data: monthData } = await supabase
      .from('attendance')
      .select('*')
      .eq('team_member_id', memberId)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date')

    if (monthData) setMonthRecords(monthData as Attendance[])
    setLoading(false)
  }, [memberId, date])

  useEffect(() => {
    fetchAttendance()
  }, [fetchAttendance])

  const markAttendance = async (status: string) => {
    if (!memberId) return
    setSaving(true)

    if (todayStatus) {
      await supabase
        .from('attendance')
        .update({ status })
        .eq('id', todayStatus.id)
    } else {
      await supabase
        .from('attendance')
        .insert({ team_member_id: memberId, date, status })
    }

    setSaving(false)
    fetchAttendance()
  }

  const changeDate = (days: number) => {
    const d = parseISO(date)
    d.setDate(d.getDate() + days)
    setDate(format(d, 'yyyy-MM-dd'))
  }

  // Monthly stats
  const present = monthRecords.filter(r => r.status === 'present').length
  const halfDay = monthRecords.filter(r => r.status === 'half_day').length
  const leave = monthRecords.filter(r => r.status === 'leave').length
  const absent = monthRecords.filter(r => r.status === 'absent').length
  const total = monthRecords.length
  const rate = total > 0 ? Math.round(((present + halfDay * 0.5) / total) * 100) : 0

  // Calendar days
  const selectedDate = parseISO(date)
  const monthDays = eachDayOfInterval({
    start: startOfMonth(selectedDate),
    end: endOfMonth(selectedDate),
  })
  const firstDayOffset = startOfMonth(selectedDate).getDay()

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Attendance</h1>
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

      {/* Current status */}
      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarCheck className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium">
                {format(parseISO(date), 'EEEE, MMM d')}
              </span>
              {todayStatus && (
                <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_CONFIG[todayStatus.status as keyof typeof STATUS_CONFIG].color}`}>
                  {STATUS_CONFIG[todayStatus.status as keyof typeof STATUS_CONFIG].label}
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(STATUS_CONFIG) as [string, typeof STATUS_CONFIG.present][]).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => markAttendance(key)}
                  disabled={saving}
                  className={`py-2.5 rounded-lg text-xs font-medium transition border ${
                    todayStatus?.status === key
                      ? config.color + ' border-current'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {config.label}
                </button>
              ))}
            </div>
          </div>

          {/* Monthly summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <h2 className="text-sm font-semibold mb-3">
              {format(selectedDate, 'MMMM yyyy')} Summary
            </h2>
            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="bg-green-50 rounded-lg p-2">
                <div className="text-lg font-bold text-green-700">{present}</div>
                <div className="text-xs text-green-600">Present</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-2">
                <div className="text-lg font-bold text-yellow-700">{halfDay}</div>
                <div className="text-xs text-yellow-600">Half</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-2">
                <div className="text-lg font-bold text-blue-700">{leave}</div>
                <div className="text-xs text-blue-600">Leave</div>
              </div>
              <div className="bg-red-50 rounded-lg p-2">
                <div className="text-lg font-bold text-red-700">{absent}</div>
                <div className="text-xs text-red-600">Absent</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <div className="text-lg font-bold text-gray-700">{rate}%</div>
                <div className="text-xs text-gray-600">Rate</div>
              </div>
            </div>
          </div>

          {/* Mini calendar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="grid grid-cols-7 gap-1 text-center">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-xs font-medium text-gray-400 py-1">{d}</div>
              ))}
              {Array.from({ length: firstDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {monthDays.map((day) => {
                const record = monthRecords.find(r => isSameDay(parseISO(r.date), day))
                const isSelected = isSameDay(day, parseISO(date))
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setDate(format(day, 'yyyy-MM-dd'))}
                    className={`relative py-1.5 rounded-lg text-xs ${
                      isSelected ? 'bg-blue-100 font-bold text-blue-700' : 'hover:bg-gray-50'
                    }`}
                  >
                    {format(day, 'd')}
                    {record && (
                      <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[record.status as keyof typeof STATUS_CONFIG].dot}`} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
