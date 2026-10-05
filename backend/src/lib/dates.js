const MANILA = 'Asia/Manila'

function manilaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type) => Number(parts.find((part) => part.type === type).value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

function manilaDateString(date = new Date()) {
  const { year, month, day } = manilaParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function manilaRange(from, to) {
  return {
    gte: new Date(`${from}T00:00:00+08:00`),
    lte: new Date(`${to}T23:59:59.999+08:00`),
  }
}

function defaultRange(now = new Date()) {
  const end = manilaDateString(now)
  const startDate = new Date(`${end}T00:00:00+08:00`)
  startDate.setUTCDate(startDate.getUTCDate() - 29)
  const start = manilaDateString(startDate)
  return { from: start, to: end }
}

function daysBetweenManila(earlier, later) {
  const start = manilaDateString(earlier)
  const end = manilaDateString(later)
  const startMs = new Date(`${start}T00:00:00+08:00`).getTime()
  const endMs = new Date(`${end}T00:00:00+08:00`).getTime()
  return Math.round((endMs - startMs) / 86400000)
}

function addManilaDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00+08:00`)
  date.setUTCDate(date.getUTCDate() + days)
  return manilaDateString(date)
}

function calendarDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return date.toISOString().slice(0, 10)
}

module.exports = {
  manilaParts,
  manilaDateString,
  manilaRange,
  defaultRange,
  daysBetweenManila,
  addManilaDays,
  calendarDate,
}
