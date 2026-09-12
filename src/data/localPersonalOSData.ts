import type {
  HealthCondition,
  HealthMetric,
  HealthMetricInput,
  LearningPath,
  LearningPathInput,
  LearningResource,
  LearningResourceInput,
  LearningResourceStatus,
  MenstruationFlow,
  MenstruationSymptom,
  PersonalOSData,
  PersonalOSState,
  Project,
  ProjectInput,
  ProjectStatus,
  StudyLog,
  StudyLogInput,
  TaskCategory,
  TaskInput,
  TransactionInput,
  Transaction,
  Task,
  WeeklyReview,
  WeeklyReviewInput,
  Workout,
  WorkoutExercise,
  WorkoutInput,
  WorkoutKind,
  WorkoutStatus,
  SelectableWorkoutKind,
} from './model'

const storageKey = 'personal-os:v1'

const taskCategoryLabels: Record<TaskCategory, string> = {
  work: '工作',
  health: '健康',
  learning: '学习',
  life: '生活',
}

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

  function addProject(input: ProjectInput) {
    const name = input.name.trim()
    const goal = input.goal.trim()
    const nextAction = input.nextAction.trim()

    if (!name) {
      throw new Error('项目名称不能为空')
    }

    if (!goal) {
      throw new Error('项目目标不能为空')
    }

    if (!nextAction) {
      throw new Error('下一步动作不能为空')
    }

    if (!isProjectStatus(input.status)) {
      throw new Error('请选择有效的项目状态')
    }

    if (
      input.dueDate !== undefined &&
      !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)
    ) {
      throw new Error('请选择有效的截止日期')
    }

    commit({
      ...state,
      projects: [
        {
          id: createId(),
          name,
          goal,
          status: input.status,
          nextAction,
          dueDate: input.dueDate,
        },
        ...state.projects,
      ],
    })
  }

  function setProjectStatus(id: string, status: ProjectStatus) {
    const exists = state.projects.some((project) => project.id === id)

    if (!exists) {
      throw new Error('项目不存在')
    }

    commit({
      ...state,
      projects: state.projects.map((project) =>
        project.id === id ? { ...project, status } : project,
      ),
    })
  }

  function addTask(input: TaskInput) {
    const title = input.title.trim()

    if (!title) {
      throw new Error('计划内容不能为空')
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new Error('请选择有效的计划日期')
    }

    if (!isTaskCategory(input.category)) {
      throw new Error('请选择有效的计划分类')
    }

    if (input.time !== undefined && !/^\d{2}:\d{2}$/.test(input.time)) {
      throw new Error('请选择有效的计划时间')
    }

    const task: Task = {
      id: createId(),
      title,
      meta: `${taskCategoryLabels[input.category]} · ${input.time ?? '全天'}`,
      done: false,
      date: input.date,
      time: input.time,
      category: input.category,
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

  function buildWorkout(id: string, input: WorkoutInput): Workout {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new Error('请选择有效的训练日期')
    }

    if (!isSelectableWorkoutKind(input.kind)) {
      throw new Error('请选择有效的训练类型')
    }

    if (!input.kinds?.length) {
      throw new Error('请选择至少一个训练类型')
    }

    if (!input.kinds.every(isSelectableWorkoutKind)) {
      throw new Error('请选择有效的训练类型')
    }

    const kinds = [...new Set(input.kinds)]

    if (input.status !== undefined && !isWorkoutStatus(input.status)) {
      throw new Error('请选择有效的训练状态')
    }

    if (
      !Number.isInteger(input.durationMinutes) ||
      input.durationMinutes < 0 ||
      input.durationMinutes > 600
    ) {
      throw new Error('训练时长必须在 0 到 600 分钟之间')
    }

    const workout: Workout = {
      id,
      kind: kinds[0],
      kinds,
      status: input.status ?? 'completed',
      durationMinutes: input.durationMinutes,
      date: input.date,
      notes: input.notes.trim(),
    }

    if (input.focus?.trim()) {
      workout.focus = input.focus.trim()
    }

    const warmup = cleanStringArray(input.warmup)

    if (warmup.length > 0) {
      workout.warmup = warmup
    }

    const exercises = cleanWorkoutExercises(input.exercises)

    if (exercises.length > 0) {
      workout.exercises = exercises
    }

    const finisher = cleanStringArray(input.finisher)

    if (finisher.length > 0) {
      workout.finisher = finisher
    }

    const sorenessAreas = cleanStringArray(input.sorenessAreas)

    if (sorenessAreas.length > 0) {
      workout.sorenessAreas = sorenessAreas
    }

    const coachNotes = cleanStringArray(input.coachNotes)

    if (coachNotes.length > 0) {
      workout.coachNotes = coachNotes
    }

    return workout
  }

  function recordWorkout(input: WorkoutInput) {
    const workout = buildWorkout(createId(), input)

    commit({
      ...state,
      workouts: [workout, ...state.workouts],
    })
  }

  function updateWorkout(id: string, input: WorkoutInput) {
    const existingIndex = state.workouts.findIndex(
      (workout) => workout.id === id,
    )

    if (existingIndex < 0) {
      throw new Error('训练记录不存在')
    }

    const workout = buildWorkout(id, input)

    commit({
      ...state,
      workouts: state.workouts.map((item, index) =>
        index === existingIndex ? workout : item,
      ),
    })
  }

  function setWorkoutStatus(id: string, status: WorkoutStatus) {
    const exists = state.workouts.some((workout) => workout.id === id)

    if (!exists) {
      throw new Error('训练记录不存在')
    }

    commit({
      ...state,
      workouts: state.workouts.map((workout) =>
        workout.id === id ? { ...workout, status } : workout,
      ),
    })
  }

  function saveHealthMetric(input: HealthMetricInput) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new Error('请选择有效的记录日期')
    }

    if (
      !Number.isFinite(input.sleepHours) ||
      input.sleepHours < 0 ||
      input.sleepHours > 24
    ) {
      throw new Error('睡眠时长必须在 0 到 24 小时之间')
    }

    if (
      input.weightKg !== null &&
      (!Number.isFinite(input.weightKg) || input.weightKg < 20 || input.weightKg > 300)
    ) {
      throw new Error('体重必须在 20 到 300 公斤之间')
    }

    if (!isHealthCondition(input.condition)) {
      throw new Error('请选择有效的身体状态')
    }

    if (
      input.menstruationFlow !== undefined &&
      !isMenstruationFlow(input.menstruationFlow)
    ) {
      throw new Error('请选择有效的月经流量')
    }

    if (
      input.menstruationSymptoms !== undefined &&
      !input.menstruationSymptoms.every(isMenstruationSymptom)
    ) {
      throw new Error('请选择有效的月经症状')
    }

    const metric: HealthMetric = {
      id: createId(),
      date: input.date,
      sleepHours: Math.round(input.sleepHours * 10) / 10,
      weightKg:
        input.weightKg === null
          ? null
          : Math.round(input.weightKg * 10) / 10,
      condition: input.condition,
      ...(input.menstruationFlow ? { menstruationFlow: input.menstruationFlow } : {}),
      ...(input.menstruationSymptoms?.length
        ? { menstruationSymptoms: [...new Set(input.menstruationSymptoms)] }
        : {}),
      ...(input.menstruationNote?.trim()
        ? { menstruationNote: input.menstruationNote.trim() }
        : {}),
    }
    const existingIndex = state.healthMetrics.findIndex(
      (item) => item.date === metric.date,
    )

    commit({
      ...state,
      healthMetrics:
        existingIndex >= 0
          ? state.healthMetrics.map((item, index) =>
              index === existingIndex ? metric : item,
            )
          : [metric, ...state.healthMetrics],
    })
  }

  return {
    subscribe,
    getSnapshot,
    toggleTask,
    addTask,
    addQuickTask,
    addProject,
    setProjectStatus,
    recordTransaction,
    recordStudyLog,
    updateMonthlyBudget,
    addLearningPath,
    addLearningResource,
    setLearningResourceStatus,
    saveWeeklyReview,
    recordWorkout,
    updateWorkout,
    setWorkoutStatus,
    saveHealthMetric,
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
        date: toDateKey(now),
        time: '09:30',
        category: 'work',
      },
      {
        id: 'push-day',
        title: '力量训练：推（45 分钟）',
        meta: '健康 · 18:30',
        done: false,
        date: toDateKey(now),
        time: '18:30',
        category: 'health',
      },
      {
        id: 'react-study',
        title: '学习 React 架构设计 45 分钟',
        meta: '学习 · 20:30',
        done: false,
        date: toDateKey(now),
        time: '20:30',
        category: 'learning',
      },
    ],
    projects: [
      {
        id: 'personal-os-project',
        name: 'Personal OS',
        goal: '建立统一的个人运营系统',
        status: 'active',
        nextAction: '完成项目工作台',
        dueDate: toDateKey(now),
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
    workouts: [],
    healthMetrics: [],
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
    projects: Array.isArray(value.projects)
      ? value.projects.filter(isProject)
      : [],
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
    workouts: Array.isArray(value.workouts)
      ? value.workouts.filter(isWorkout)
      : [],
    healthMetrics: Array.isArray(value.healthMetrics)
      ? value.healthMetrics.filter(isHealthMetric)
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
    typeof value.done === 'boolean' &&
    (value.date === undefined ||
      (typeof value.date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(value.date))) &&
    (value.time === undefined ||
      (typeof value.time === 'string' && /^\d{2}:\d{2}$/.test(value.time))) &&
    (value.category === undefined || isTaskCategory(value.category))
  )
}

function isTaskCategory(value: unknown): value is TaskCategory {
  return (
    value === 'work' ||
    value === 'health' ||
    value === 'learning' ||
    value === 'life'
  )
}

function isProject(value: unknown): value is Project {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof value.goal === 'string' &&
    typeof value.status === 'string' &&
    isProjectStatus(value.status) &&
    typeof value.nextAction === 'string' &&
    (value.dueDate === undefined ||
      (typeof value.dueDate === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(value.dueDate)))
  )
}

function isProjectStatus(value: unknown): value is ProjectStatus {
  return (
    value === 'planned' ||
    value === 'active' ||
    value === 'blocked' ||
    value === 'done'
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

function isWorkout(value: unknown): value is Workout {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
    isWorkoutKind(value.kind) &&
    (value.status === undefined || isWorkoutStatus(value.status)) &&
    (value.kinds === undefined ||
      (Array.isArray(value.kinds) && value.kinds.every(isSelectableWorkoutKind))) &&
    typeof value.durationMinutes === 'number' &&
    Number.isInteger(value.durationMinutes) &&
    value.durationMinutes >= 0 &&
    value.durationMinutes <= 600 &&
    typeof value.notes === 'string'
  ) && (
    (value.focus === undefined ||
      (typeof value.focus === 'string' && value.focus.trim().length > 0)) &&
    (value.warmup === undefined || isStringArray(value.warmup)) &&
    (value.exercises === undefined ||
      (Array.isArray(value.exercises) &&
        value.exercises.every(isWorkoutExercise))) &&
    (value.finisher === undefined || isStringArray(value.finisher)) &&
    (value.sorenessAreas === undefined || isStringArray(value.sorenessAreas)) &&
    (value.coachNotes === undefined || isStringArray(value.coachNotes))
  )
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isWorkoutExercise(value: unknown): value is WorkoutExercise {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    (value.prescription === undefined ||
      (typeof value.prescription === 'string' &&
        value.prescription.trim().length > 0)) &&
    (value.target === undefined ||
      (typeof value.target === 'string' && value.target.trim().length > 0))
  )
}

function isWorkoutKind(value: unknown): value is WorkoutKind {
  return (
    value === 'glutes' ||
    value === 'legs' ||
    value === 'shoulders' ||
    value === 'chest' ||
    value === 'back' ||
    value === 'cardio' ||
    value === 'push' ||
    value === 'pull' ||
    value === 'rest'
  )
}

function isSelectableWorkoutKind(
  value: unknown,
): value is SelectableWorkoutKind {
  return (
    value === 'glutes' ||
    value === 'legs' ||
    value === 'shoulders' ||
    value === 'chest' ||
    value === 'back' ||
    value === 'cardio'
  )
}

function isWorkoutStatus(value: unknown): value is WorkoutStatus {
  return value === 'planned' || value === 'completed' || value === 'skipped'
}

function isHealthMetric(value: unknown): value is HealthMetric {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
    typeof value.sleepHours === 'number' &&
    Number.isFinite(value.sleepHours) &&
    value.sleepHours >= 0 &&
    value.sleepHours <= 24 &&
    (value.weightKg === null ||
      (typeof value.weightKg === 'number' &&
        Number.isFinite(value.weightKg) &&
        value.weightKg >= 20 &&
        value.weightKg <= 300)) &&
    isHealthCondition(value.condition) &&
    (value.menstruationFlow === undefined ||
      isMenstruationFlow(value.menstruationFlow)) &&
    (value.menstruationSymptoms === undefined ||
      (Array.isArray(value.menstruationSymptoms) &&
        value.menstruationSymptoms.every(isMenstruationSymptom))) &&
    (value.menstruationNote === undefined ||
      (typeof value.menstruationNote === 'string' &&
        value.menstruationNote.trim().length > 0))
  )
}

function isMenstruationFlow(value: unknown): value is MenstruationFlow {
  return (
    value === 'none' ||
    value === 'spotting' ||
    value === 'light' ||
    value === 'medium' ||
    value === 'heavy'
  )
}

function isMenstruationSymptom(value: unknown): value is MenstruationSymptom {
  return (
    value === 'cramps' ||
    value === 'bloating' ||
    value === 'headache' ||
    value === 'breastTenderness' ||
    value === 'fatigue' ||
    value === 'moodChanges'
  )
}

function isHealthCondition(value: unknown): value is HealthCondition {
  return (
    value === 'great' ||
    value === 'good' ||
    value === 'fair' ||
    value === 'tired'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function cleanStringArray(value: string[] | undefined) {
  return (value ?? [])
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

function cleanWorkoutExercises(value: WorkoutExercise[] | undefined) {
  return (value ?? [])
    .filter((exercise) => typeof exercise?.name === 'string')
    .map((exercise) => {
      const name = exercise.name.trim()
      const prescription = exercise.prescription?.trim()
      const target = exercise.target?.trim()

      return {
        name,
        ...(prescription ? { prescription } : {}),
        ...(target ? { target } : {}),
      }
    })
    .filter((exercise) => exercise.name.length > 0)
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
