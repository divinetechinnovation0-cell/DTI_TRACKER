import NepaliDate from 'nepali-date-converter'

const NEPALI_MONTHS = [
  'बैशाख', 'जेठ', 'असार', 'श्रावण', 'भदौ', 'असोज',
  'कार्तिक', 'मंसिर', 'पुष', 'माघ', 'फागुन', 'चैत्र'
]

const NEPALI_MONTHS_SHORT = [
  'बैशाख', 'जेठ', 'असार', 'श्रावण', 'भदौ', 'असोज',
  'कार्तिक', 'मंसिर', 'पुष', 'माघ', 'फागुन', 'चैत्र'
]

const NEPALI_DAYS = [
  'आइतबार', 'सोमबार', 'मंगलबार', 'बुधबार', 'बिहीबार', 'शुक्रबार', 'शनिबार'
]

const NEPALI_DAYS_SHORT = [
  'आइत', 'सोम', 'मंगल', 'बुध', 'बिही', 'शुक्र', 'शनि'
]

const NEPALI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९']

function toNepaliDigits(num: number | string): string {
  return String(num).replace(/[0-9]/g, (d) => NEPALI_DIGITS[parseInt(d)])
}

function toNepaliDate(date: Date | string): NepaliDate {
  const d = typeof date === 'string' ? new Date(date) : date
  return new NepaliDate(d)
}

/**
 * Get BS date parts from a JS Date or ISO string
 */
function getBSParts(date: Date | string) {
  const nd = toNepaliDate(date)
  const bs = nd.getBS()
  const dayOfWeek = nd.format('d') // 0=Sun, 1=Mon...
  return {
    year: bs.year,
    month: bs.month, // 0-indexed
    date: bs.date,
    day: parseInt(dayOfWeek),
  }
}

// ============================================================
// Public formatting functions — drop-in replacements for format()
// ============================================================

/**
 * "बिहीबार, चैत्र १९, २०८२" — full date with day name
 * Replaces: format(date, 'EEEE, MMMM d, yyyy')
 */
export function formatNepaliFullDate(date: Date | string): string {
  const p = getBSParts(date)
  return `${NEPALI_DAYS[p.day]}, ${NEPALI_MONTHS[p.month]} ${toNepaliDigits(p.date)}, ${toNepaliDigits(p.year)}`
}

/**
 * "बिहीबार, चैत्र १९" — day name + month + date (no year)
 * Replaces: format(date, 'EEEE, MMM d')
 */
export function formatNepaliDayMonth(date: Date | string): string {
  const p = getBSParts(date)
  return `${NEPALI_DAYS[p.day]}, ${NEPALI_MONTHS[p.month]} ${toNepaliDigits(p.date)}`
}

/**
 * "चैत्र १९" — month + date
 * Replaces: format(date, 'MMM d')
 */
export function formatNepaliShortDate(date: Date | string): string {
  const p = getBSParts(date)
  return `${NEPALI_MONTHS[p.month]} ${toNepaliDigits(p.date)}`
}

/**
 * "चैत्र १९, २०८२" — month + date + year
 * Replaces: format(date, 'MMM d, yyyy')
 */
export function formatNepaliDateWithYear(date: Date | string): string {
  const p = getBSParts(date)
  return `${NEPALI_MONTHS[p.month]} ${toNepaliDigits(p.date)}, ${toNepaliDigits(p.year)}`
}

/**
 * "चैत्र २०८२" — month + year
 * Replaces: format(date, 'MMMM yyyy') or format(date, 'MMM yyyy')
 */
export function formatNepaliMonthYear(date: Date | string): string {
  const p = getBSParts(date)
  return `${NEPALI_MONTHS[p.month]} ${toNepaliDigits(p.year)}`
}

/**
 * "१९" — just the date number
 * Replaces: format(day, 'd')
 */
export function formatNepaliDay(date: Date | string): string {
  const p = getBSParts(date)
  return toNepaliDigits(p.date)
}

/**
 * "सोम, चैत्र १९" — short day name + month + date (week view)
 * Replaces: format(day, 'EEE, MMM d')
 */
export function formatNepaliWeekDay(date: Date | string): string {
  const p = getBSParts(date)
  return `${NEPALI_DAYS_SHORT[p.day]}, ${NEPALI_MONTHS[p.month]} ${toNepaliDigits(p.date)}`
}

/**
 * "चैत्र १ - चैत्र ७, २०८२" — date range for week view
 */
export function formatNepaliDateRange(start: Date | string, end: Date | string): string {
  const s = getBSParts(start)
  const e = getBSParts(end)
  if (s.month === e.month && s.year === e.year) {
    return `${NEPALI_MONTHS[s.month]} ${toNepaliDigits(s.date)} - ${toNepaliDigits(e.date)}, ${toNepaliDigits(s.year)}`
  }
  return `${NEPALI_MONTHS[s.month]} ${toNepaliDigits(s.date)} - ${NEPALI_MONTHS[e.month]} ${toNepaliDigits(e.date)}, ${toNepaliDigits(e.year)}`
}

/**
 * Format time in Nepali digits — "३:४५ PM"
 * Replaces: format(date, 'h:mm a')
 */
export function formatNepaliTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  let hours = d.getHours()
  const minutes = d.getMinutes()
  const ampm = hours >= 12 ? 'बेलुका' : 'बिहान'
  hours = hours % 12 || 12
  const mm = minutes < 10 ? `०${toNepaliDigits(minutes)}` : toNepaliDigits(minutes)
  return `${toNepaliDigits(hours)}:${mm} ${ampm}`
}

/**
 * Relative time in Nepali — "५ मिनेट अगाडि"
 * Replaces: formatDistanceToNow()
 */
export function formatNepaliRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'भर्खरै'
  if (diffMin < 60) return `${toNepaliDigits(diffMin)} मिनेट अगाडि`
  if (diffHour < 24) return `${toNepaliDigits(diffHour)} घण्टा अगाडि`
  if (diffDay < 30) return `${toNepaliDigits(diffDay)} दिन अगाडि`
  const diffMonth = Math.floor(diffDay / 30)
  if (diffMonth < 12) return `${toNepaliDigits(diffMonth)} महिना अगाडि`
  const diffYear = Math.floor(diffMonth / 12)
  return `${toNepaliDigits(diffYear)} वर्ष अगाडि`
}

/**
 * Convert Nepali digits back to English for data operations
 */
export function toEnglishDigits(str: string): string {
  return str.replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)))
}

/**
 * Get Nepali month name by 0-indexed month number
 */
export function getNepaliMonthName(month: number): string {
  return NEPALI_MONTHS[month]
}

/**
 * Get Nepali day name (short) by day number (0=Sun)
 */
export function getNepaliDayShort(day: number): string {
  return NEPALI_DAYS_SHORT[day]
}

/**
 * Check if two dates fall in the same BS month
 */
export function isSameNepaliMonth(date1: Date | string, date2: Date | string): boolean {
  const p1 = getBSParts(date1)
  const p2 = getBSParts(date2)
  return p1.year === p2.year && p1.month === p2.month
}

export { toNepaliDigits, toNepaliDate, getBSParts, NEPALI_MONTHS, NEPALI_DAYS, NEPALI_DAYS_SHORT }
