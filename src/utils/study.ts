import type { StudyLog } from '../data/model'

export function toDateKey(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${value.getFullYear()}-${month}-${day}`
}

export function getStudyMinutesOnDate(studyLogs: StudyLog[], date: string) {
  return studyLogs
    .filter((log) => log.date === date)
    .reduce((total, log) => total + log.minutes, 0)
}

export function getRecentStudyMinutes(
  studyLogs: StudyLog[],
  now = new Date(),
  days = 7,
) {
  const start = new Date(now)
  start.setDate(start.getDate() - (days - 1))
  const startKey = toDateKey(start)
  const endKey = toDateKey(now)

  return studyLogs
    .filter((log) => log.date >= startKey && log.date <= endKey)
    .reduce((total, log) => total + log.minutes, 0)
}

export function formatStudyDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} 分钟`
  }

  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60

  return remaining === 0
    ? `${hours} 小时`
    : `${hours} 小时 ${remaining} 分`
}
