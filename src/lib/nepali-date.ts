import NepaliDate from 'nepali-date-converter'

// ─── Constants ──────────────────────────────────────────────

const NEPALI_MONTHS = [
  'बैशाख', 'जेठ', 'असार', 'श्रावण', 'भदौ', 'असोज',
  'कार्तिक', 'मंसिर', 'पुष', 'माघ', 'फागुन', 'चैत्र'
]

const BS_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
]

const NEPALI_DAYS = [
  'आइतबार', 'सोमबार', 'मंगलबार', 'बुधबार', 'बिहीबार', 'शुक्रबार', 'शनिबार'
]

const NEPALI_DAYS_SHORT = [
  'आइत', 'सोम', 'मंगल', 'बुध', 'बिही', 'शुक्र', 'शनि'
]

const BS_DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const NEPALI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९']

// ─── Core helpers ───────────────────────────────────────────

function toNepaliDigits(num: number | string): string {
  return String(num).replace(/[0-9]/g, (d) => NEPALI_DIGITS[parseInt(d)])
}

function toNepaliDate(date: Date | string): NepaliDate {
  const d = typeof date === 'string' ? new Date(date) : date
  return new NepaliDate(d)
}

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

// ─── BS Component utilities (from remote) ───────────────────

/** Convert a JS Date (AD) to NepaliDate (BS) */
export function adToBS(date: Date): NepaliDate {
  return new NepaliDate(date)
}

/** Convert a yyyy-MM-dd AD string to NepaliDate */
export function adStringToBS(dateStr: string): NepaliDate {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new NepaliDate(new Date(y, m - 1, d))
}

/** Get BS year, month (0-indexed), day from a JS Date */
export function getBSComponents(date: Date): { year: number; month: number; day: number } {
  const nd = new NepaliDate(date)
  return { year: nd.getYear(), month: nd.getMonth(), day: nd.getDate() }
}

/** Get the BS day number for a given AD date */
export function getBSDay(date: Date): number {
  return new NepaliDate(date).getDate()
}

/** Get number of days in a BS month */
export function getBSDaysInMonth(bsYear: number, bsMonth: number): number {
  let nextMonth = bsMonth + 1
  let nextYear = bsYear
  if (nextMonth > 11) {
    nextMonth = 0
    nextYear++
  }
  const nextMonthStart = new NepaliDate(nextYear, nextMonth, 1).toJsDate()
  const lastDay = new Date(nextMonthStart.getTime() - 86400000)
  return new NepaliDate(lastDay).getDate()
}

/** Get the AD Date for the 1st day of a BS month */
export function getADDateForBSMonthStart(bsYear: number, bsMonth: number): Date {
  return new NepaliDate(bsYear, bsMonth, 1).toJsDate()
}

/** Get the AD Date for the last day of a BS month */
export function getADDateForBSMonthEnd(bsYear: number, bsMonth: number): Date {
  const daysInMonth = getBSDaysInMonth(bsYear, bsMonth)
  return new NepaliDate(bsYear, bsMonth, daysInMonth).toJsDate()
}

/** Navigate to next BS month */
export function nextBSMonth(bsYear: number, bsMonth: number): { year: number; month: number } {
  if (bsMonth >= 11) return { year: bsYear + 1, month: 0 }
  return { year: bsYear, month: bsMonth + 1 }
}

/** Navigate to previous BS month */
export function prevBSMonth(bsYear: number, bsMonth: number): { year: number; month: number } {
  if (bsMonth <= 0) return { year: bsYear - 1, month: 11 }
  return { year: bsYear, month: bsMonth - 1 }
}

/** Check if two dates fall in the same BS month */
export function isSameBSMonth(date1: Date, date2: Date): boolean {
  const bs1 = getBSComponents(date1)
  const bs2 = getBSComponents(date2)
  return bs1.year === bs2.year && bs1.month === bs2.month
}

// ─── Devanagari formatting functions ────────────────────────

/**
 * "बिहीबार, चैत्र १९, २०८२" — full date with day name
 */
export function formatNepaliFullDate(date: Date | string): string {
  const p = getBSParts(date)
  return `${NEPALI_DAYS[p.day]}, ${NEPALI_MONTHS[p.month]} ${toNepaliDigits(p.date)}, ${toNepaliDigits(p.year)}`
}

/**
 * "बिहीबार, चैत्र १९" — day name + month + date (no year)
 */
export function formatNepaliDayMonth(date: Date | string): string {
  const p = getBSParts(date)
  return `${NEPALI_DAYS[p.day]}, ${NEPALI_MONTHS[p.month]} ${toNepaliDigits(p.date)}`
}

/**
 * "चैत्र १९" — month + date
 */
export function formatNepaliShortDate(date: Date | string): string {
  const p = getBSParts(date)
  return `${NEPALI_MONTHS[p.month]} ${toNepaliDigits(p.date)}`
}

/**
 * "चैत्र १९, २०८२" — month + date + year
 */
export function formatNepaliDateWithYear(date: Date | string): string {
  const p = getBSParts(date)
  return `${NEPALI_MONTHS[p.month]} ${toNepaliDigits(p.date)}, ${toNepaliDigits(p.year)}`
}

/**
 * "चैत्र २०८२" — month + year
 */
export function formatNepaliMonthYear(date: Date | string): string {
  const p = getBSParts(date)
  return `${NEPALI_MONTHS[p.month]} ${toNepaliDigits(p.year)}`
}

/**
 * "१९" — just the date number in Devanagari
 */
export function formatNepaliDay(date: Date | string): string {
  const p = getBSParts(date)
  return toNepaliDigits(p.date)
}

/**
 * "सोम, चैत्र १९" — short day name + month + date (week view)
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
 * Format time in Nepali — "३:४५ बेलुका"
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

// ─── Aliases used by remote code (English-style names) ──────

/** "15 Falgun 2082" — English month name format (kept for backward compat) */
export function formatBSFull(date: Date): string {
  return formatNepaliFullDate(date)
}

/** "Falgun 2082" — English month name format (kept for backward compat) */
export function formatBSMonthYear(date: Date): string {
  return formatNepaliMonthYear(date)
}

/** Week range in Nepali */
export function formatBSWeekRange(start: Date, end: Date): string {
  return formatNepaliDateRange(start, end)
}

/** Selected day detail in Nepali */
export function formatBSDayDetail(date: Date): string {
  return formatNepaliFullDate(date)
}

// ─── Misc utilities ─────────────────────────────────────────

export function toEnglishDigits(str: string): string {
  return str.replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)))
}

export function getNepaliMonthName(month: number): string {
  return NEPALI_MONTHS[month]
}

export function getNepaliDayShort(day: number): string {
  return NEPALI_DAYS_SHORT[day]
}

export function isSameNepaliMonth(date1: Date | string, date2: Date | string): boolean {
  const p1 = getBSParts(date1)
  const p2 = getBSParts(date2)
  return p1.year === p2.year && p1.month === p2.month
}

export { toNepaliDigits, toNepaliDate, getBSParts, NEPALI_MONTHS, NEPALI_DAYS, NEPALI_DAYS_SHORT, BS_MONTHS, BS_DAYS_SHORT }
