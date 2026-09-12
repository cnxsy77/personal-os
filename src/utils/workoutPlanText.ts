import type {
  SelectableWorkoutKind,
  WorkoutExercise,
} from '../data/model'
import { parseWorkoutPlanLine } from './workoutPlanTags'

export type ParsedWorkoutPlan = {
  date?: string
  focus?: string
  kinds: SelectableWorkoutKind[]
  warmup: string[]
  exercises: WorkoutExercise[]
  notes: string[]
}

const datePattern =
  /^\s*(?:(\d{4})\s*[-/年]\s*)?(\d{1,2})\s*[月/]\s*(\d{1,2})\s*日?\s*(.*)$/
const warmupPattern =
  /(热身|泡沫轴|松解|激活|灵活度|伸展|拉伸|活动度|准备活动)/

const kindPatterns: Array<[SelectableWorkoutKind, RegExp]> = [
  ['glutes', /臀|髋外展|臀推/],
  ['legs', /腿|深蹲|硬拉|股四头|腘绳/],
  ['shoulders', /肩|推肩|前平举/],
  ['chest', /胸|飞鸟|推胸|夹胸/],
  ['back', /背|划船|下拉|斜方|菱形/],
  ['cardio', /有氧|跑步|骑车|游泳|划船机|椭圆机|跳绳/],
]

export function parseWorkoutPlanText(
  text: string,
  today = new Date(),
): ParsedWorkoutPlan {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const result: ParsedWorkoutPlan = {
    kinds: [],
    warmup: [],
    exercises: [],
    notes: [],
  }
  let focusAssigned = false

  lines.forEach((line, index) => {
    const dateMatch = line.match(datePattern)

    if (dateMatch && index === 0) {
      const [, rawYear, rawMonth, rawDay, remainder] = dateMatch
      result.date = resolvePlanDate(
        rawYear ? Number(rawYear) : undefined,
        Number(rawMonth),
        Number(rawDay),
        today,
      )

      if (isFocusLine(remainder)) {
        result.focus = remainder.trim()
        focusAssigned = true
      }

      return
    }

    if (!focusAssigned && index === 1 && isFocusLine(line)) {
      result.focus = line
      focusAssigned = true
      return
    }

    if (warmupPattern.test(line)) {
      result.warmup.push(line)
      return
    }

    const exercise = parseWorkoutPlanLine(line)

    if (exercise.prescription) {
      result.exercises.push(exercise)
      return
    }

    result.notes.push(line)
  })

  const kindSource = [
    result.focus,
    ...result.exercises.map((exercise) =>
      [exercise.name, exercise.target].filter(Boolean).join(' '),
    ),
  ]
    .filter(Boolean)
    .join(' ')
  result.kinds = kindPatterns
    .filter(([, pattern]) => pattern.test(kindSource))
    .map(([kind]) => kind)

  return result
}

function isFocusLine(value: string) {
  const content = value.trim()

  if (!content || content.length > 20 || warmupPattern.test(content)) {
    return false
  }

  return (
    /训练|日$/.test(content) ||
    kindPatterns.some(([, pattern]) => pattern.test(content))
  )
}

function resolvePlanDate(
  explicitYear: number | undefined,
  month: number,
  day: number,
  today: Date,
) {
  const year = explicitYear ?? chooseImplicitYear(month, day, today)
  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function chooseImplicitYear(month: number, day: number, today: Date) {
  const currentYear = today.getFullYear()
  const currentYearDate = new Date(currentYear, month - 1, day)

  return currentYearDate > today ? currentYear - 1 : currentYear
}
