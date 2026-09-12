import type { Workout, WorkoutKind } from '../data/model'

export type WorkoutMode = 'strength' | 'cardio'

export type WorkoutModeFilter = WorkoutMode | 'all'

export type CalendarWorkoutDay = {
  date: string
  day: number
  inMonth: boolean
  strengthCount: number
  cardioCount: number
  totalCount: number
  level: 0 | 1 | 2 | 3 | 4
}

export const workoutModeLabels: Record<WorkoutMode, string> = {
  strength: '力量',
  cardio: '有氧',
}

export function getWorkoutMode(kind: WorkoutKind): WorkoutMode | null {
  return kind === 'cardio' ? 'cardio' : kind === 'rest' ? null : 'strength'
}

export function getWorkoutModes(workout: Workout): WorkoutMode[] {
  const kinds = workout.kinds?.length ? workout.kinds : [workout.kind]

  return kinds
    .map(getWorkoutMode)
    .filter((mode): mode is WorkoutMode => mode !== null)
    .filter((mode, index, modes) => modes.indexOf(mode) === index)
}

export function getMonthKey(value: Date | string) {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`
  }

  return value.slice(0, 7)
}

export function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)

  if (!year || !month) {
    return monthKey
  }

  return `${year} 年 ${month} 月`
}

export function getAdjacentMonthKey(monthKey: string, offset: number) {
  const [year, month] = monthKey.split('-').map(Number)

  if (!year || !month) {
    return monthKey
  }

  const date = new Date(year, month - 1 + offset, 1)

  return getMonthKey(date)
}

export function filterWorkoutsByMonth(workouts: Workout[], monthKey: string) {
  return workouts.filter((workout) => workout.date.startsWith(monthKey))
}

export function filterWorkoutsByMode(
  workouts: Workout[],
  mode: WorkoutModeFilter,
) {
  if (mode === 'all') {
    return workouts
  }

  return workouts.filter((workout) => getWorkoutModes(workout).includes(mode))
}

export function getCompletedMonthlyWorkouts(
  workouts: Workout[],
  monthKey: string,
) {
  return filterWorkoutsByMonth(workouts, monthKey)
}

export function getMonthlyWorkoutDays(workouts: Workout[], monthKey: string) {
  const completed = getCompletedMonthlyWorkouts(workouts, monthKey)

  return new Set(completed.map((workout) => workout.date)).size
}

export function getMonthlyWorkoutCalendar(
  workouts: Workout[],
  monthKey: string,
): CalendarWorkoutDay[] {
  const [year, month] = monthKey.split('-').map(Number)

  if (!year || !month || month < 1 || month > 12) {
    return []
  }

  const firstDate = new Date(year, month - 1, 1)
  const weekday = (firstDate.getDay() + 6) % 7
  const startOffset = -weekday
  const cells = Math.ceil((weekday + new Date(year, month, 0).getDate()) / 7) * 7
  const completed = getCompletedMonthlyWorkouts(workouts, monthKey)

  return Array.from({ length: cells }, (_, index) => {
    const date = new Date(year, month - 1, startOffset + index + 1)
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const dayWorkouts = completed.filter((workout) => workout.date === dateKey)
    const strengthCount = dayWorkouts.filter(
      (workout) => getWorkoutModes(workout).includes('strength'),
    ).length
    const cardioCount = dayWorkouts.filter(
      (workout) => getWorkoutModes(workout).includes('cardio'),
    ).length
    const totalCount = dayWorkouts.length

    return {
      date: dateKey,
      day: date.getDate(),
      inMonth: date.getMonth() === month - 1,
      strengthCount,
      cardioCount,
      totalCount,
      level: Math.min(4, totalCount) as 0 | 1 | 2 | 3 | 4,
    }
  })
}
