import NepaliDate from 'nepali-date-converter'

const BS_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
]

const BS_MONTHS_NP = [
  'बैशाख', 'जेठ', 'असार', 'श्रावण', 'भाद्र', 'आश्विन',
  'कार्तिक', 'मंसिर', 'पौष', 'माघ', 'फाल्गुन', 'चैत्र',
]

const BS_DAYS_NP = [
  'आइतबार', 'सोमबार', 'मंगलबार', 'बुधबार', 'बिहिबार', 'शुक्रबार', 'शनिबार',
]

const BS_DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

/** Format BS date: "15 Falgun 2082" */
export function formatBSFull(date: Date): string {
  const { year, month, day } = getBSComponents(date)
  return `${day} ${BS_MONTHS[month]} ${year}`
}

/** Format BS date: "Falgun 2082" */
export function formatBSMonthYear(date: Date): string {
  const { year, month } = getBSComponents(date)
  return `${BS_MONTHS[month]} ${year}`
}

/** Format BS date with Nepali month: "15 फाल्गुन 2082" */
export function formatBSNepali(date: Date): string {
  const { year, month, day } = getBSComponents(date)
  return `${day} ${BS_MONTHS_NP[month]} ${year}`
}

/** Get the BS day number for a given AD date */
export function getBSDay(date: Date): number {
  return new NepaliDate(date).getDate()
}

/** Get the BS month name for a given AD date */
export function getBSMonthName(date: Date): string {
  return BS_MONTHS[new NepaliDate(date).getMonth()]
}

/** Get the BS month name in Nepali */
export function getBSMonthNameNP(date: Date): string {
  return BS_MONTHS_NP[new NepaliDate(date).getMonth()]
}

/** Get number of days in a BS month */
export function getBSDaysInMonth(bsYear: number, bsMonth: number): number {
  // Create a NepaliDate for day 1 of the given month, then find last valid day
  // NepaliDate months are 0-indexed
  const nd = new NepaliDate(bsYear, bsMonth, 1)
  // Get the AD date for 1st of next BS month, then subtract 1 day
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

/** Navigate to next BS month given current BS year/month */
export function nextBSMonth(bsYear: number, bsMonth: number): { year: number; month: number } {
  if (bsMonth >= 11) return { year: bsYear + 1, month: 0 }
  return { year: bsYear, month: bsMonth + 1 }
}

/** Navigate to previous BS month given current BS year/month */
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

/** Format BS week range: "12 - 18 Falgun 2082" or "28 Magh - 4 Falgun 2082" */
export function formatBSWeekRange(start: Date, end: Date): string {
  const bsStart = getBSComponents(start)
  const bsEnd = getBSComponents(end)

  if (bsStart.month === bsEnd.month && bsStart.year === bsEnd.year) {
    return `${bsStart.day} - ${bsEnd.day} ${BS_MONTHS[bsStart.month]} ${bsStart.year}`
  }
  if (bsStart.year === bsEnd.year) {
    return `${bsStart.day} ${BS_MONTHS[bsStart.month]} - ${bsEnd.day} ${BS_MONTHS[bsEnd.month]} ${bsEnd.year}`
  }
  return `${bsStart.day} ${BS_MONTHS[bsStart.month]} ${bsStart.year} - ${bsEnd.day} ${BS_MONTHS[bsEnd.month]} ${bsEnd.year}`
}

/** Format for selected day detail: "Saturday, 15 Falgun 2082" */
export function formatBSDayDetail(date: Date): string {
  const dayOfWeek = BS_DAYS_SHORT[date.getDay()]
  const { year, month, day } = getBSComponents(date)
  return `${dayOfWeek}, ${day} ${BS_MONTHS[month]} ${year}`
}

export { BS_MONTHS, BS_MONTHS_NP, BS_DAYS_NP, BS_DAYS_SHORT }
