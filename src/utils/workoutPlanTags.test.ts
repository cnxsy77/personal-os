import { describe, expect, it } from 'vitest'
import { getWorkoutExercises, parseWorkoutPlanLine } from './workoutPlanTags'
import type { Workout } from '../data/model'

describe('workout plan tags', () => {
  it('parses plan lines into exercise name and prescription', () => {
    expect(parseWorkoutPlanLine('坐姿髋外展中立位12×4')).toEqual({
      name: '坐姿髋外展中立位',
      prescription: '12×4',
    })
    expect(parseWorkoutPlanLine('哑铃飞鸟12×2×4递减')).toEqual({
      name: '哑铃飞鸟',
      prescription: '12×2×4',
      target: '递减',
    })
    expect(parseWorkoutPlanLine('固定器械下卷腹3组每组20次')).toEqual({
      name: '固定器械下卷腹',
      prescription: '3组每组20次',
    })
    expect(parseWorkoutPlanLine('恢复训练')).toEqual({ name: '恢复训练' })
  })

  it('prefers structured exercises and falls back to plan lines', () => {
    const exercises = [{ name: '哑铃飞鸟', prescription: '12×4' }]
    const structuredWorkout = {
      id: 'structured',
      date: '2026-09-12',
      kind: 'chest',
      durationMinutes: 45,
      notes: '',
      plan: ['高脚杯深蹲12×3'],
      exercises,
    } as Workout
    const planWorkout = {
      id: 'plan',
      date: '2026-09-12',
      kind: 'chest',
      durationMinutes: 45,
      notes: '',
      plan: ['高脚杯深蹲12×3'],
    } as Workout

    expect(getWorkoutExercises(structuredWorkout)).toEqual(exercises)
    expect(getWorkoutExercises(planWorkout)).toEqual([
      { name: '高脚杯深蹲', prescription: '12×3' },
    ])
  })
})
