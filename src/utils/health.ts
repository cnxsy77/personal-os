import type {
  HealthCondition,
  HealthMetric,
  Workout,
  WorkoutKind,
  WorkoutStatus,
} from '../data/model'
import { toDateKey } from './study'

export const weeklyWorkoutTarget = 4

export const workoutKindLabels: Record<WorkoutKind, string> = {
  push: '推',
  pull: '拉',
  legs: '腿',
  cardio: '有氧',
  rest: '休息',
}

export const workoutStatusLabels: Record<WorkoutStatus, string> = {
  planned: '计划中',
  completed: '已完成',
  skipped: '已跳过',
}

export const healthConditionLabels: Record<HealthCondition, string> = {
  great: '很好',
  good: '良好',
  fair: '一般',
  tired: '疲惫',
}

export function getWeekStart(value: Date) {
  const start = new Date(value)
  const weekday = start.getDay()
  start.setDate(start.getDate() - (weekday === 0 ? 6 : weekday - 1))

  return start
}

export function getCompletedWorkoutsThisWeek(workouts: Workout[], now: Date) {
  const startKey = toDateKey(getWeekStart(now))
  const endKey = toDateKey(now)

  return workouts.filter(
    (workout) =>
      workout.status === 'completed' &&
      workout.date >= startKey &&
      workout.date <= endKey,
  )
}

export function getLatestHealthMetric(metrics: HealthMetric[]) {
  return [...metrics].sort((metricA, metricB) =>
    metricB.date.localeCompare(metricA.date),
  )[0]
}
