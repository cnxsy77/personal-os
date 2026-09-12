import { describe, expect, it } from 'vitest'
import type { Workout } from '../data/model'
import {
  filterWorkoutsByMode,
  filterWorkoutsByMonth,
  getAdjacentMonthKey,
  getCompletedMonthlyWorkouts,
  getMonthLabel,
  getMonthlyWorkoutCalendar,
  getMonthlyWorkoutDays,
  getWorkoutMode,
  getWorkoutModes,
  workoutModeLabels,
} from './healthViews'

const workouts: Workout[] = [
  {
    id: 'push-day',
    date: '2026-09-09',
    kind: 'chest',
    kinds: ['chest', 'shoulders'],
    status: 'completed',
    durationMinutes: 60,
    notes: '',
  },
  {
    id: 'run-day',
    date: '2026-09-09',
    kind: 'cardio',
    status: 'completed',
    durationMinutes: 30,
    notes: '',
  },
  {
    id: 'rest-day',
    date: '2026-09-08',
    kind: 'rest',
    status: 'completed',
    durationMinutes: 0,
    notes: '',
  },
  {
    id: 'planned-legs',
    date: '2026-09-07',
    kind: 'legs',
    status: 'completed',
    durationMinutes: 45,
    notes: '',
  },
  {
    id: 'august-pull',
    date: '2026-08-31',
    kind: 'pull',
    status: 'completed',
    durationMinutes: 50,
    notes: '',
  },
]

describe('health views', () => {
  it('groups workout kinds into training modes', () => {
    expect(getWorkoutMode('chest')).toBe('strength')
    expect(getWorkoutMode('glutes')).toBe('strength')
    expect(getWorkoutMode('legs')).toBe('strength')
    expect(getWorkoutMode('cardio')).toBe('cardio')
    expect(getWorkoutMode('rest')).toBeNull()
    expect(getWorkoutModes(workouts[0])).toEqual(['strength'])
    expect(workoutModeLabels.strength).toBe('力量')
    expect(workoutModeLabels.cardio).toBe('有氧')
    expect(workoutModeLabels).not.toHaveProperty('recovery')
  })

  it('filters workouts by month and mode', () => {
    const september = filterWorkoutsByMonth(workouts, '2026-09')

    expect(september.map((workout) => workout.id)).toEqual([
      'push-day',
      'run-day',
      'rest-day',
      'planned-legs',
    ])
    expect(filterWorkoutsByMode(september, 'strength')).toEqual([
      workouts[0],
      workouts[3],
    ])
    expect(filterWorkoutsByMode(september, 'cardio')).toEqual([workouts[1]])
    expect(getCompletedMonthlyWorkouts(workouts, '2026-09')).toHaveLength(4)
    expect(getMonthlyWorkoutDays(workouts, '2026-09')).toBe(3)
  })

  it('builds a Monday-start calendar heat map for the selected month', () => {
    const calendar = getMonthlyWorkoutCalendar(workouts, '2026-09')

    expect(calendar).toHaveLength(35)
    expect(calendar[0]).toMatchObject({
      date: '2026-08-31',
      day: 31,
      inMonth: false,
      totalCount: 0,
      level: 0,
    })

    const ninth = calendar.find((day) => day.date === '2026-09-09')

    expect(ninth).toMatchObject({
      day: 9,
      inMonth: true,
      strengthCount: 1,
      cardioCount: 1,
      totalCount: 2,
      level: 2,
    })
    expect(calendar.find((day) => day.date === '2026-09-07')).toMatchObject({
      totalCount: 1,
      level: 1,
    })
  })

  it('formats and navigates selected months', () => {
    expect(getMonthLabel('2026-09')).toBe('2026 年 9 月')
    expect(getAdjacentMonthKey('2026-09', -1)).toBe('2026-08')
    expect(getAdjacentMonthKey('2026-09', 1)).toBe('2026-10')
    expect(getAdjacentMonthKey('2026-12', 1)).toBe('2027-01')
  })
})
