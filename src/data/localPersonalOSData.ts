import type {
  LearningPath,
  LearningPathInput,
  LearningResource,
  LearningResourceInput,
  LearningResourceStatus,
  PersonalOSData,
  PersonalOSState,
  StudyLog,
  StudyLogInput,
  TransactionInput,
  Transaction,
  Task,
  WeeklyReview,
  WeeklyReviewInput,
} from './model'

const storageKey = 'personal-os:v1'

type LocalDataOptions = {
  storage?: Storage
  now?: () => Date
  seed?: PersonalOSState
}

export function createLocalPersonalOSData(
  options: LocalDataOptions = {},
): PersonalOSData {
  const storage = options.storage ?? window.localStorage
  const now = options.now ?? (() => new Date())
  const listeners = new Set<() => void>()
  let state = loadState(storage, options.seed ?? createSeedState(now()))
  let snapshot = state

  function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  function getSnapshot() {
    return snapshot
  }

  function commit(nextState: PersonalOSState) {
    state = nextState
    snapshot = nextState
    storage.setItem(storageKey, JSON.stringify(nextState))
    listeners.forEach((listener) => listener())
  }

  function toggleTask(id: string) {
    commit({
      ...state,
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    })
  }

  function addQuickTask(title: string) {
    const task: Task = {
      id: createId(),
      title,
      meta: '工作 · 今天',
      done: false,
    }
    commit({ ...state, tasks: [...state.tasks, task] })
  }

  function recordTransaction(input: TransactionInput) {
    const transaction: Transaction = { ...input, id: createId() }
    commit({
      ...state,
      transactions: [transaction, ...state.transactions],
    })
  }

  function recordStudyLog(input: StudyLogInput) {
    const studyLog: StudyLog = { ...input, id: createId() }
    commit({
      ...state,
      studyLogs: [studyLog, ...state.studyLogs],
    })
  }

  function updateMonthlyBudget(monthlyBudgetCents: number) {
    if (!Number.isInteger(monthlyBudgetCents) || monthlyBudgetCents <= 0) {
      throw new Error('月度预算必须是大于 0 的整数金额')
    }

    commit({
      ...state,
      monthlyBudgetCents,
    })
  }

  function addLearningPath(input: LearningPathInput) {
    const title = input.title.trim()

    if (!title) {
      throw new Error('学习路径名称不能为空')
    }

    if (!Number.isInteger(input.targetMinutes) || input.targetMinutes <= 0) {
      throw new Error('学习目标必须大于 0 分钟')
    }

    commit({
      ...state,
      learningPaths: [
        { id: createId(), ...input, title },
        ...state.learningPaths,
      ],
    })
  }

  function addLearningResource(input: LearningResourceInput) {
    const title = input.title.trim()

    if (!title) {
      throw new Error('资料名称不能为空')
    }

    commit({
      ...state,
      learningResources: [
        { id: createId(), ...input, title },
        ...state.learningResources,
      ],
    })
  }

  function setLearningResourceStatus(id: string, status: LearningResourceStatus) {
    const exists = state.learningResources.some((resource) => resource.id === id)

    if (!exists) {
      throw new Error('学习资料不存在')
    }

    commit({
      ...state,
      learningResources: state.learningResources.map((resource) =>
        resource.id === id ? { ...resource, status } : resource,
      ),
    })
  }

  function saveWeeklyReview(input: WeeklyReviewInput) {
    const review: WeeklyReview = {
      id: createId(),
      weekStartDate: input.weekStartDate,
      wins: input.wins.trim(),
      blockers: input.blockers.trim(),
      nextFocus: input.nextFocus.trim(),
    }
    const existingIndex = state.weeklyReviews.findIndex(
      (item) => item.weekStartDate === review.weekStartDate,
    )

    commit({
      ...state,
      weeklyReviews:
        existingIndex >= 0
          ? state.weeklyReviews.map((item, index) =>
              index === existingIndex ? review : item,
            )
          : [review, ...state.weeklyReviews],
    })
  }

  return {
    subscribe,
    getSnapshot,
    toggleTask,
    addQuickTask,
    recordTransaction,
    recordStudyLog,
    updateMonthlyBudget,
    addLearningPath,
    addLearningResource,
    setLearningResourceStatus,
    saveWeeklyReview,
  }
}

function createSeedState(now: Date): PersonalOSState {
  return {
    tasks: [
      {
        id: 'dashboard-mvp',
        title: '完成 Personal OS 仪表盘 MVP',
        meta: '工作 · 09:30',
        done: false,
      },
      {
        id: 'push-day',
        title: '力量训练：推（45 分钟）',
        meta: '健康 · 18:30',
        done: false,
      },
      {
        id: 'react-study',
        title: '学习 React 架构设计 45 分钟',
        meta: '学习 · 20:30',
        done: false,
      },
    ],
    transactions: [
      {
        id: 'lunch',
        kind: 'expense',
        amountCents: 3600,
        category: '餐饮',
        date: toDateKey(now),
      },
    ],
    monthlyBudgetCents: 100000,
    learningPaths: [
      {
        id: 'react-engineering-path',
        title: 'React 工程化路径',
        targetMinutes: 1200,
      },
    ],
    studyLogs: [
      {
        id: 'react-architecture',
        topic: 'React 架构设计',
        minutes: 45,
        date: toDateKey(now),
        pathId: 'react-engineering-path',
      },
    ],
    learningResources: [
      {
        id: 'react-docs',
        pathId: 'react-engineering-path',
        title: 'React 官方文档',
        kind: 'docs',
        status: 'doing',
      },
    ],
    weeklyReviews: [],
  }
}

function loadState(storage: Storage, fallback: PersonalOSState): PersonalOSState {
  const raw = storage.getItem(storageKey)
  if (!raw) {
    return fallback
  }

  try {
    return normalizeState(JSON.parse(raw), fallback)
  } catch {
    return fallback
  }
}

function normalizeState(value: unknown, fallback: PersonalOSState): PersonalOSState {
  if (
    !isRecord(value) ||
    !Array.isArray(value.tasks) ||
    !Array.isArray(value.transactions) ||
    !value.tasks.every(isTask) ||
    !value.transactions.every(isTransaction)
  ) {
    return fallback
  }

  return {
    tasks: value.tasks,
    transactions: value.transactions,
    monthlyBudgetCents:
      typeof value.monthlyBudgetCents === 'number' &&
      Number.isInteger(value.monthlyBudgetCents) &&
      value.monthlyBudgetCents > 0
        ? value.monthlyBudgetCents
        : 100000,
    studyLogs: Array.isArray(value.studyLogs)
      ? value.studyLogs.filter(isStudyLog)
      : [],
    learningPaths: Array.isArray(value.learningPaths)
      ? value.learningPaths.filter(isLearningPath)
      : [],
    learningResources: Array.isArray(value.learningResources)
      ? value.learningResources.filter(isLearningResource)
      : [],
    weeklyReviews: Array.isArray(value.weeklyReviews)
      ? value.weeklyReviews.filter(isWeeklyReview)
      : [],
  }
}

function isTask(value: unknown): value is Task {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.meta === 'string' &&
    typeof value.done === 'boolean'
  )
}

function isTransaction(value: unknown): value is Transaction {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    (value.kind === 'expense' || value.kind === 'income') &&
    typeof value.amountCents === 'number' &&
    Number.isInteger(value.amountCents) &&
    value.amountCents > 0 &&
    typeof value.category === 'string' &&
    typeof value.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.date)
  )
}

function isStudyLog(value: unknown): value is StudyLog {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.topic === 'string' &&
    value.topic.trim().length > 0 &&
    typeof value.minutes === 'number' &&
    Number.isInteger(value.minutes) &&
    value.minutes > 0 &&
    typeof value.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
    (value.pathId === undefined || typeof value.pathId === 'string')
  )
}

function isLearningPath(value: unknown): value is LearningPath {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    value.title.trim().length > 0 &&
    typeof value.targetMinutes === 'number' &&
    Number.isInteger(value.targetMinutes) &&
    value.targetMinutes > 0
  )
}

function isLearningResource(value: unknown): value is LearningResource {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    (value.pathId === null || typeof value.pathId === 'string') &&
    typeof value.title === 'string' &&
    value.title.trim().length > 0 &&
    isLearningResourceKind(value.kind) &&
    isLearningResourceStatus(value.status)
  )
}

function isLearningResourceKind(value: unknown): value is LearningResource['kind'] {
  return value === 'course' || value === 'book' || value === 'article' || value === 'video' || value === 'docs'
}

function isLearningResourceStatus(value: unknown): value is LearningResource['status'] {
  return value === 'todo' || value === 'doing' || value === 'done'
}

function isWeeklyReview(value: unknown): value is WeeklyReview {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.weekStartDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.weekStartDate) &&
    typeof value.wins === 'string' &&
    typeof value.blockers === 'string' &&
    typeof value.nextFocus === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function createId() {
  if ('randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toDateKey(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}
