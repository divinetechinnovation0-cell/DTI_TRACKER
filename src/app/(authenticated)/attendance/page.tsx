'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  parseISO,
  isSameDay,
  isToday,
  isFuture,
  isPast,
  startOfDay,
} from 'date-fns'
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sun,
  Bell,
  UserCheck,
  UserX,
  AlertCircle,
} from 'lucide-react'
import type { Attendance, TeamMember } from '@/lib/types'
import {
  formatNepaliDayMonth,
  formatNepaliMonthYear,
  formatNepaliDay,
  formatNepaliTime,
  NEPALI_DAYS_SHORT,
} from '@/lib/nepali-date'

const STATUS_CONFIG = {
  present: { label: 'Present', color: 'bg-green-100 text-green-700 border-green-300', dot: 'bg-green-500' },
  half_day: { label: 'Half Day', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', dot: 'bg-yellow-500' },
  leave: { label: 'Leave', color: 'bg-blue-100 text-blue-700 border-blue-300', dot: 'bg-blue-500' },
  absent: { label: 'Absent', color: 'bg-red-100 text-red-700 border-red-300', dot: 'bg-red-500' },
}

type TeamAttendance = {
  member: TeamMember
  attendance: Attendance | null
}

export default function AttendancePage() {
  const supabase = createClient()
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [memberId, setMemberId] = useState<string | null>(null)
  const [memberName, setMemberName] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [todayStatus, setTodayStatus] = useState<Attendance | null>(null)
  const [monthRecords, setMonthRecords] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checkedIn, setCheckedIn] = useState(false)
  const [teamToday, setTeamToday] = useState<TeamAttendance[]>([])
  const [pinging, setPinging] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: member } = await supabase
        .from('team_members')
        .select('id, name, is_admin')
        .eq('auth_user_id', user.id)
        .single()
      if (member) {
        setMemberId(member.id)
        setMemberName(member.name)
        setIsAdmin(member.is_admin)

        // Clean up: remove "present" records from past dates
        const today = format(new Date(), 'yyyy-MM-dd')
        await supabase
          .from('attendance')
          .delete()
          .eq('team_member_id', member.id)
          .eq('status', 'present')
          .lt('date', today)
      }
    }
    init()
  }, [])

  const fetchAttendance = useCallback(async () => {
    if (!memberId) {
      setLoading(false)
      return
    }
    setLoading(true)

    // Fetch selected date's record
    const { data: todayData } = await supabase
      .from('attendance')
      .select('*')
      .eq('team_member_id', memberId)
      .eq('date', date)
      .single()

    setTodayStatus(todayData as Attendance | null)
    setCheckedIn(!!todayData)

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

  const fetchTeamToday = useCallback(async () => {
    if (!isAdmin) return

    const todayStr = format(new Date(), 'yyyy-MM-dd')

    const { data: members } = await supabase
      .from('team_members')
      .select('*')
      .eq('is_active', true)
      .order('name')

    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', todayStr)

    if (members) {
      const teamData: TeamAttendance[] = members.map(m => ({
        member: m as TeamMember,
        attendance: (attendanceData as Attendance[] | null)?.find(a => a.team_member_id === m.id) || null,
      }))
      setTeamToday(teamData)
    }
  }, [isAdmin])

  useEffect(() => {
    fetchAttendance()
  }, [fetchAttendance])

  useEffect(() => {
    fetchTeamToday()
  }, [fetchTeamToday])

  const handleCheckIn = async (status: 'present' | 'half_day' | 'leave') => {
    if (!memberId) return
    setSaving(true)

    const checkInTime = new Date().toISOString()

    if (todayStatus) {
      // Update existing record
      const updates: Record<string, unknown> = { status }
      // If changing from absent/leave to present/half_day, update check_in_time
      if (
        (todayStatus.status === 'absent' || todayStatus.status === 'leave') &&
        (status === 'present' || status === 'half_day')
      ) {
        updates.check_in_time = checkInTime
      }
      await supabase
        .from('attendance')
        .update(updates)
        .eq('id', todayStatus.id)
    } else {
      // Insert new record
      await supabase
        .from('attendance')
        .insert({
          team_member_id: memberId,
          date,
          status,
          check_in_time: status === 'present' || status === 'half_day' ? checkInTime : null,
        })
    }

    setSaving(false)
    fetchAttendance()
    if (isAdmin) fetchTeamToday()
  }

  const markAttendance = async (status: string) => {
    if (!memberId) return
    setSaving(true)

    if (todayStatus) {
      const updates: Record<string, unknown> = { status }
      if (
        (todayStatus.status === 'absent' || todayStatus.status === 'leave') &&
        (status === 'present' || status === 'half_day')
      ) {
        updates.check_in_time = new Date().toISOString()
      }
      await supabase
        .from('attendance')
        .update(updates)
        .eq('id', todayStatus.id)
    } else {
      await supabase
        .from('attendance')
        .insert({
          team_member_id: memberId,
          date,
          status,
          check_in_time: status === 'present' || status === 'half_day' ? new Date().toISOString() : null,
        })
    }

    setSaving(false)
    fetchAttendance()
    if (isAdmin) fetchTeamToday()
  }

  const pingMember = async (targetMemberId: string) => {
    if (!memberId) return
    setPinging(targetMemberId)

    await supabase.from('notifications').insert({
      recipient_id: targetMemberId,
      sender_id: memberId,
      type: 'ping',
      title: 'Attendance Reminder',
      body: `${memberName} is reminding you to mark your attendance today.`,
      link: '/attendance',
    })

    setPinging(null)
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const changeDate = (days: number) => {
    const d = parseISO(date)
    d.setDate(d.getDate() + days)
    // Don't allow navigating to future dates
    if (isFuture(startOfDay(d))) return
    setDate(format(d, 'yyyy-MM-dd'))
  }

  const isDateInPast = !isToday(parseISO(date)) && isPast(startOfDay(parseISO(date)))

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

  // Is viewing today?
  const isViewingToday = isToday(parseISO(date))
  const showMorningCard = isViewingToday && !todayStatus && !loading

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
            max={todayStr}
            onChange={(e) => {
              const val = e.target.value
              if (val > todayStr) return
              setDate(val)
            }}
            className="text-sm border-none outline-none bg-transparent w-32 text-center"
          />
          <button
            onClick={() => changeDate(1)}
            disabled={isToday(parseISO(date))}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
      ) : (
        <>
          {/* Morning Check-in Card */}
          {showMorningCard && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 mb-5 text-center">
              <Sun className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Good morning, {memberName.split(' ')[0]}!
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                {formatNepaliDayMonth(new Date())}
              </p>

              <button
                onClick={() => handleCheckIn('present')}
                disabled={saving}
                className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl text-lg font-bold transition shadow-lg shadow-green-200 disabled:opacity-50 mb-3"
              >
                {saving ? 'Marking...' : "I'M HERE"}
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => handleCheckIn('half_day')}
                  disabled={saving}
                  className="flex-1 py-3 bg-white border border-yellow-300 text-yellow-700 rounded-xl text-sm font-medium hover:bg-yellow-50 transition disabled:opacity-50"
                >
                  Half Day
                </button>
                <button
                  onClick={() => handleCheckIn('leave')}
                  disabled={saving}
                  className="flex-1 py-3 bg-white border border-blue-300 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-50 transition disabled:opacity-50"
                >
                  On Leave
                </button>
              </div>
            </div>
          )}

          {/* Already Checked In Card */}
          {isViewingToday && todayStatus && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarCheck className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium">
                  {formatNepaliDayMonth(new Date())}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_CONFIG[todayStatus.status as keyof typeof STATUS_CONFIG].color}`}>
                  {STATUS_CONFIG[todayStatus.status as keyof typeof STATUS_CONFIG].label}
                </span>
              </div>

              {todayStatus.check_in_time && (
                <div className="flex items-center gap-1.5 mb-3 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg w-fit">
                  <Clock className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs font-medium text-green-700">
                    चेक इन: {formatNepaliTime(parseISO(todayStatus.check_in_time))}
                  </span>
                </div>
              )}

              <p className="text-xs text-gray-400 mb-2">Change status:</p>
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
          )}

          {/* Non-today date view (read-only for past dates) */}
          {!isViewingToday && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarCheck className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium">
                  {formatNepaliDayMonth(parseISO(date))}
                </span>
                {todayStatus && (
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_CONFIG[todayStatus.status as keyof typeof STATUS_CONFIG].color}`}>
                    {STATUS_CONFIG[todayStatus.status as keyof typeof STATUS_CONFIG].label}
                  </span>
                )}
              </div>

              {todayStatus?.check_in_time && (
                <div className="flex items-center gap-1.5 mb-3 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg w-fit">
                  <Clock className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs font-medium text-green-700">
                    चेक इन: {formatNepaliTime(parseISO(todayStatus.check_in_time))}
                  </span>
                </div>
              )}

              {!todayStatus && (
                <p className="text-xs text-gray-400 text-center py-2">No attendance record for this date</p>
              )}
            </div>
          )}

          {/* Monthly summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <h2 className="text-sm font-semibold mb-3">
              {formatNepaliMonthYear(selectedDate)} सारांश
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
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <div className="grid grid-cols-7 gap-1 text-center">
              {['आ', 'सो', 'मं', 'बु', 'बि', 'शु', 'श'].map((d, i) => (
                <div key={i} className="text-xs font-medium text-gray-400 py-1">{d}</div>
              ))}
              {Array.from({ length: firstDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {monthDays.map((day) => {
                const record = monthRecords.find(r => isSameDay(parseISO(r.date), day))
                const isSelected = isSameDay(day, parseISO(date))
                const isDayToday = isToday(day)
                const isFutureDay = isFuture(startOfDay(day))
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => !isFutureDay && setDate(format(day, 'yyyy-MM-dd'))}
                    disabled={isFutureDay}
                    className={`relative py-1.5 rounded-lg text-xs ${
                      isFutureDay
                        ? 'text-gray-300 cursor-not-allowed'
                        : isSelected
                          ? 'bg-blue-100 font-bold text-blue-700'
                          : isDayToday
                            ? 'bg-gray-100 font-semibold'
                            : 'hover:bg-gray-50'
                    }`}
                  >
                    {formatNepaliDay(day)}
                    {record && (
                      <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[record.status as keyof typeof STATUS_CONFIG].dot}`} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Admin: Team Today */}
          {isAdmin && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <UserCheck className="w-5 h-5 text-gray-600" />
                <h2 className="text-sm font-semibold">Team Today</h2>
              </div>

              <div className="space-y-2">
                {teamToday.map(({ member, attendance: att }) => {
                  const status = att?.status as keyof typeof STATUS_CONFIG | undefined
                  const notMarked = !att

                  return (
                    <div
                      key={member.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        notMarked ? 'border-orange-200 bg-orange-50' : 'border-gray-100 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          notMarked
                            ? 'bg-orange-200 text-orange-700'
                            : status === 'present'
                              ? 'bg-green-200 text-green-700'
                              : status === 'half_day'
                                ? 'bg-yellow-200 text-yellow-700'
                                : status === 'leave'
                                  ? 'bg-blue-200 text-blue-700'
                                  : 'bg-red-200 text-red-700'
                        }`}>
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{member.name}</p>
                          <div className="flex items-center gap-1.5">
                            {notMarked ? (
                              <span className="text-xs text-orange-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Not marked
                              </span>
                            ) : (
                              <>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_CONFIG[status!].color}`}>
                                  {STATUS_CONFIG[status!].label}
                                </span>
                                {att?.check_in_time && (
                                  <span className="text-xs text-gray-400">
                                    {formatNepaliTime(parseISO(att.check_in_time))}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {notMarked && member.id !== memberId && (
                        <button
                          onClick={() => pingMember(member.id)}
                          disabled={pinging === member.id}
                          className="p-2 text-orange-500 hover:bg-orange-100 rounded-lg transition disabled:opacity-50"
                          title="Send reminder"
                        >
                          {pinging === member.id ? (
                            <Bell className="w-4 h-4 animate-pulse" />
                          ) : (
                            <Bell className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  )
                })}

                {teamToday.length === 0 && (
                  <div className="text-center py-4 text-gray-400 text-sm">
                    <UserX className="w-6 h-6 mx-auto mb-1 text-gray-300" />
                    No active team members
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
