import type { Workout, WorkoutExercise } from '../data/model'

const prescriptionPattern =
  /(?<prescription>(?:各)?(?:\d+|[一二两三四五六七八九十]+)\s*(?:[*×xX]\s*\d+)+|[*×xX]\s*\d+|(?:各)?(?:\d+|[一二两三四五六七八九十]+)\s*组[^\s，,]*)/i

export function getWorkoutExercises(workout: Workout): WorkoutExercise[] {
  if (workout.exercises?.length) {
    return workout.exercises
  }

  return (workout.plan ?? []).map(parseWorkoutPlanLine)
}

export function parseWorkoutPlanLine(line: string): WorkoutExercise {
  const content = line.trim()
  const match = content.match(prescriptionPattern)

  if (!match?.groups?.prescription) {
    return { name: content }
  }

  const prescription = match.groups.prescription
  const name = content.slice(0, match.index).trim().replace(/各$/u, '')
  const target = content
    .slice((match.index ?? 0) + prescription.length)
    .trim()
    .replace(/^[，,、]+/u, '')

  return {
    name: name || content,
    prescription: normalizePrescription(prescription),
    ...(target ? { target } : {}),
  }
}

function normalizePrescription(value: string) {
  return value.replaceAll(/\s+/gu, '').replaceAll(/[*xX]/gu, '×')
}
