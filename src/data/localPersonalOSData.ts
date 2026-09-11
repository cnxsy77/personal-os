import type {
  PersonalOSData,
  PersonalOSState,
  StudyLog,
  StudyLogInput,
  TransactionInput,
  Transaction,
  Task,
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

  return {
    subscribe,
    getSnapshot,
    toggleTask,
    addQuickTask,
    recordTransaction,
    recordStudyLog,
    updateMonthlyBudget,
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
    studyLogs: [
      {
        id: 'react-architecture',
        topic: 'React 架构设计',
        minutes: 45,
        date: toDateKey(now),
      },
    ],
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
    /^\d{4}-\d{2}-\d{2}$/.test(value.date)
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
