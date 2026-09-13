import type { Task, TaskCategory } from '../data/model'

export type PlanRange = 'today' | 'week' | 'all'
export type PlanStatusFilter = 'active' | 'all' | 'done'

export type PlanFilters = {
  range: PlanRange
  status: PlanStatusFilter
  category: TaskCategory | 'all'
  query: string
}

export type TaskGroupKey =
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'weekAfter'
  | 'future'
  | 'unscheduled'
  | 'completed'

export type TaskGroup = {
  key: TaskGroupKey
  label: string
  tasks: Task[]
}

export type DateRange = {
  start: string
  end: string
}

export type PlanSummary = {
  todayTotal: number
  todayActive: number
  weekTotal: number
  completionPercent: number
}

export type PlanRhythm = {
  distribution: Array<{ category: TaskCategory | 'none'; count: number }>
  overdueCount: number
  latestOverdueDate?: string
  unscheduledCount: number
  todayCompleted: number
  todayTotal: number
  weekCompleted: number
  weekTotal: number
}

const groupOrder: Array<{ key: TaskGroupKey; label: string }> = [
  { key: 'overdue', label: '逾期' },
  { key: 'today', label: '今天' },
  { key: 'tomorrow', label: '明天' },
  { key: 'weekAfter', label: '本周后续' },
  { key: 'future', label: '更远' },
  { key: 'unscheduled', label: '未排期' },
  { key: 'completed', label: '已完成' },
]

export function getWeekRange(now: Date): DateRange {
  const start = new Date(now)
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7))

  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  return { start: toDateKey(start), end: toDateKey(end) }
}

export function filterTasks(
  tasks: Task[],
  filters: PlanFilters,
  now = new Date(),
) {
  const today = toDateKey(now)
  const week = getWeekRange(now)
  const query = filters.query.trim().toLowerCase()

  return tasks
    .filter((task) => {
      if (filters.range === 'today' && task.date !== today) {
        return false
      }

      if (
        filters.range === 'week' &&
        (task.date === undefined ||
          task.date < week.start ||
          task.date > week.end)
      ) {
        return false
      }

      if (filters.category !== 'all' && task.category !== filters.category) {
        return false
      }

      if (filters.status === 'active' && task.done) {
        return false
      }

      if (filters.status === 'done' && !task.done) {
        return false
      }

      if (!query) {
        return true
      }

      return [task.title, task.meta]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    })
    .sort(compareTasks)
}

export function groupTasks(
  tasks: Task[],
  now = new Date(),
): Array<TaskGroup> {
  const today = toDateKey(now)
  const tomorrowDate = new Date(now)
  tomorrowDate.setDate(now.getDate() + 1)
  const tomorrow = toDateKey(tomorrowDate)
  const week = getWeekRange(now)
  const grouped = new Map<TaskGroupKey, Task[]>(groupOrder.map((item) => [
    item.key,
    [],
  ]))

  for (const task of tasks) {
    let key: TaskGroupKey

    if (task.done) {
      key = 'completed'
    } else if (task.date === undefined) {
      key = 'unscheduled'
    } else if (task.date < today) {
      key = 'overdue'
    } else if (task.date === today) {
      key = 'today'
    } else if (task.date === tomorrow) {
      key = 'tomorrow'
    } else if (task.date <= week.end) {
      key = 'weekAfter'
    } else {
      key = 'future'
    }

    grouped.get(key)?.push(task)
  }

  return groupOrder
    .map(({ key, label }) => ({ key, label, tasks: grouped.get(key) ?? [] }))
    .filter((group) => group.tasks.length > 0)
}

export function summarizePlan(
  tasks: Task[],
  now = new Date(),
): PlanSummary {
  const today = toDateKey(now)
  const week = getWeekRange(now)
  const todayTasks = tasks.filter((task) => task.date === today)
  const weekTasks = tasks.filter(
    (task) =>
      task.date !== undefined &&
      task.date >= week.start &&
      task.date <= week.end,
  )

  return {
    todayTotal: todayTasks.length,
    todayActive: todayTasks.filter((task) => !task.done).length,
    weekTotal: weekTasks.length,
    completionPercent: weekTasks.length
      ? Math.round(
          (weekTasks.filter((task) => task.done).length /
            weekTasks.length) * 100,
        )
      : 0,
  }
}

export function summarizePlanRhythm(
  filteredTasks: Task[],
  scopedTasks: Task[],
  now = new Date(),
): PlanRhythm {
  const today = toDateKey(now)
  const week = getWeekRange(now)
  const overdueTasks = filteredTasks.filter(
    (task) => !task.done && task.date !== undefined && task.date < today,
  )
  const todayTasks = scopedTasks.filter((task) => task.date === today)
  const weekTasks = scopedTasks.filter(
    (task) =>
      task.date !== undefined &&
      task.date >= week.start &&
      task.date <= week.end,
  )
  const categories: TaskCategory[] = ['work', 'health', 'learning', 'life']

  return {
    distribution: [
      ...categories.map((category) => ({
        category,
        count: filteredTasks.filter((task) => task.category === category).length,
      })),
      {
        category: 'none' as const,
        count: filteredTasks.filter((task) => task.category === undefined)
          .length,
      },
    ],
    overdueCount: overdueTasks.length,
    latestOverdueDate: overdueTasks.at(-1)?.date,
    unscheduledCount: filteredTasks.filter(
      (task) => !task.done && task.date === undefined,
    ).length,
    todayCompleted: todayTasks.filter((task) => task.done).length,
    todayTotal: todayTasks.length,
    weekCompleted: weekTasks.filter((task) => task.done).length,
    weekTotal: weekTasks.length,
  }
}

function compareTasks(taskA: Task, taskB: Task) {
  const dateA = taskA.date ?? '9999-12-31'
  const dateB = taskB.date ?? '9999-12-31'

  if (dateA !== dateB) {
    return dateA.localeCompare(dateB)
  }

  return (taskA.time ?? '99:99').localeCompare(taskB.time ?? '99:99')
}

function toDateKey(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}
