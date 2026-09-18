import type {
  HealthCondition,
  HealthMetric,
  HealthMetricInput,
  LearningPath,
  LearningPathInput,
  LearningLesson,
  LearningLessonDraft,
  LearningLessonUpdateInput,
  LearningLessonStatus,
  LearningNoteFolder,
  LearningNoteInput,
  LearningNote,
  LearningResource,
  LearningResourceInput,
  LearningResourceStatus,
  MenstruationFlow,
  MenstruationSymptom,
  PersonalOSData,
  PersonalOSState,
  PersonalOSSettings,
  PersonalOSSettingsInput,
  Project,
  ProjectInput,
  ProjectStatus,
  SettingsCategoryKind,
  BillImport,
  BillImportInput,
  BillImportResult,
  BillSource,
  HealthMetricUpdateInput,
  PaymentOrder,
  PaymentStage,
  RecurringFrequency,
  RecurringTransaction,
  RecurringTransactionInput,
  TransactionTag,
  StudyLog,
  StudyLogInput,
  StudyLogUpdateInput,
  TaskCategory,
  TaskInput,
  TaskUpdateInput,
  TransactionInput,
  TransactionUpdateInput,
  Transaction,
  Task,
  WeeklyReview,
  WeeklyReviewInput,
  WeeklyReviewUpdateInput,
  Workout,
  WorkoutExercise,
  WorkoutInput,
  WorkoutKind,
  WorkoutStatus,
  SelectableWorkoutKind,
} from './model'
import { defaultPersonalOSSettings } from '../utils/settings'
import {
  isLearningPlatform,
  parseLearningSource,
} from '../utils/learningSource'

const storageKey = 'personal-os:v1'

const taskCategoryLabels: Record<TaskCategory, string> = {
  work: '工作',
  health: '健康',
  learning: '学习',
  life: '生活',
}

export type LocalPersonalOSData = PersonalOSData & {
  replaceState: (state: PersonalOSState) => void
}

export type LocalDataOptions = {
  storage?: Storage
  now?: () => Date
  seed?: PersonalOSState
}

export function createLocalPersonalOSData(
  options: LocalDataOptions = {},
): LocalPersonalOSData {
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

  function deleteTask(id: string) {
    if (!state.tasks.some((task) => task.id === id)) {
      throw new Error('计划任务不存在')
    }

    commit({
      ...state,
      tasks: state.tasks.filter((task) => task.id !== id),
    })
  }

  function addProject(input: ProjectInput) {
    const validatedInput = validateProjectInput(input)

    commit({
      ...state,
      projects: [
        {
          id: createId(),
          ...validatedInput,
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

  function validateProjectInput(input: ProjectInput) {
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

    return {
      name,
      goal,
      nextAction,
      status: input.status,
      ...(input.dueDate === undefined ? {} : { dueDate: input.dueDate }),
    }
  }

  function updateProject(id: string, input: ProjectInput) {
    if (!state.projects.some((project) => project.id === id)) {
      throw new Error('项目不存在')
    }

    const validatedInput = validateProjectInput(input)

    commit({
      ...state,
      projects: state.projects.map((project) =>
        project.id === id ? { ...project, ...validatedInput } : project,
      ),
    })
  }

  function deleteProject(id: string) {
    if (!state.projects.some((project) => project.id === id)) {
      throw new Error('项目不存在')
    }

    commit({
      ...state,
      projects: state.projects.filter((project) => project.id !== id),
    })
  }

  function validateTaskInput(input: TaskInput) {
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

    return {
      title,
      date: input.date,
      category: input.category,
      time: input.time,
    }
  }

  function addTask(input: TaskInput) {
    const validatedInput = validateTaskInput(input)

    const task: Task = {
      id: createId(),
      title: validatedInput.title,
      meta: `${taskCategoryLabels[validatedInput.category]} · ${
        validatedInput.time ?? '全天'
      }`,
      done: false,
      date: validatedInput.date,
      time: validatedInput.time,
      category: validatedInput.category,
    }

    commit({ ...state, tasks: [...state.tasks, task] })
  }

  function updateTask(id: string, input: TaskUpdateInput) {
    const exists = state.tasks.some((task) => task.id === id)

    if (!exists) {
      throw new Error('计划任务不存在')
    }

    const validatedInput = validateTaskInput(input)

    commit({
      ...state,
      tasks: state.tasks.map((task) =>
        task.id === id
          ? {
              ...task,
              title: validatedInput.title,
              meta: `${taskCategoryLabels[validatedInput.category]} · ${
                validatedInput.time ?? '全天'
              }`,
              date: validatedInput.date,
              time: validatedInput.time,
              category: validatedInput.category,
            }
          : task,
      ),
    })
  }

  function recordTransaction(input: TransactionInput) {
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new Error('金额必须是大于 0 的整数金额')
    }

    const category = input.category.trim()
    if (!category) {
      throw new Error('请选择有效分类')
    }

    if (!isValidDateKey(input.date)) {
      throw new Error('请选择有效的记账日期')
    }

    if (input.kind !== 'expense' && input.kind !== 'income' && input.kind !== 'transfer') {
      throw new Error('请选择有效的收支类型')
    }

    if (
      input.stage !== undefined &&
      !isPaymentStage(input.stage)
    ) {
      throw new Error('请选择有效的支付阶段')
    }

    if (input.source !== undefined && !isBillSource(input.source)) {
      throw new Error('账单来源无效')
    }

    if (input.tag !== undefined && !isTransactionTag(input.tag)) {
      throw new Error('记录标签无效')
    }

    let paymentOrders = state.paymentOrders
    let orderId = input.orderId
    if (input.newOrder) {
      const name = input.newOrder.name.trim()
      if (!name) {
        throw new Error('订单名称不能为空')
      }

      if (
        !Number.isInteger(input.newOrder.expectedTotalCents) ||
        input.newOrder.expectedTotalCents <= 0
      ) {
        throw new Error('订单总额必须是大于 0 的整数金额')
      }

      const order: PaymentOrder = {
        id: createId(),
        name,
        expectedTotalCents: input.newOrder.expectedTotalCents,
        createdAt: toDateKey(now()),
      }
      paymentOrders = [order, ...paymentOrders]
      orderId = order.id
    } else if (
      orderId !== undefined &&
      !paymentOrders.some((order) => order.id === orderId)
    ) {
      throw new Error('关联订单不存在')
    }

    if (
      input.relatedTransactionId !== undefined &&
      !state.transactions.some((item) => item.id === input.relatedTransactionId)
    ) {
      throw new Error('退款关联的原记录不存在')
    }

    if (
      input.recurringId !== undefined &&
      !state.recurringTransactions.some((item) => item.id === input.recurringId)
    ) {
      throw new Error('周期记录不存在')
    }

    const optionalText = (value: string | undefined) => {
      const text = value?.trim()
      return text ? text : undefined
    }
    const tag = input.tag === 'normal' ? undefined : input.tag
    const transaction: Transaction = {
      id: createId(),
      kind: input.kind,
      amountCents: input.amountCents,
      category,
      date: input.date,
      ...(optionalText(input.note) ? { note: optionalText(input.note) } : {}),
      ...(tag ? { tag } : {}),
      ...(orderId ? { orderId } : {}),
      ...(input.stage ? { stage: input.stage } : {}),
      ...(input.recurringId ? { recurringId: input.recurringId } : {}),
      ...(input.relatedTransactionId
        ? { relatedTransactionId: input.relatedTransactionId }
        : {}),
      ...(optionalText(input.counterparty)
        ? { counterparty: optionalText(input.counterparty) }
        : {}),
      ...(input.source ? { source: input.source } : {}),
      ...(optionalText(input.sourceTradeNo)
        ? { sourceTradeNo: optionalText(input.sourceTradeNo) }
        : {}),
      ...(optionalText(input.occurredAt)
        ? { occurredAt: optionalText(input.occurredAt) }
        : {}),
    }

    commit({
      ...state,
      paymentOrders,
      transactions: [transaction, ...state.transactions],
    })
  }

  function validateTransactionInput(
    input: TransactionUpdateInput,
    currentId?: string,
  ) {
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new Error('金额必须是大于 0 的整数金额')
    }

    const category = input.category.trim()
    if (!category) {
      throw new Error('请选择有效分类')
    }

    if (!isValidDateKey(input.date)) {
      throw new Error('请选择有效的记账日期')
    }

    if (
      input.kind !== 'expense' &&
      input.kind !== 'income' &&
      input.kind !== 'transfer'
    ) {
      throw new Error('请选择有效的收支类型')
    }

    if (input.stage !== undefined && !isPaymentStage(input.stage)) {
      throw new Error('请选择有效的支付阶段')
    }

    if (input.source !== undefined && !isBillSource(input.source)) {
      throw new Error('账单来源无效')
    }

    if (input.tag !== undefined && !isTransactionTag(input.tag)) {
      throw new Error('记录标签无效')
    }

    if (
      input.orderId !== undefined &&
      !state.paymentOrders.some((order) => order.id === input.orderId)
    ) {
      throw new Error('关联订单不存在')
    }

    if (
      input.relatedTransactionId !== undefined &&
      !state.transactions.some(
        (item) =>
          item.id === input.relatedTransactionId &&
          item.id !== currentId,
      )
    ) {
      throw new Error('退款关联的原记录不存在')
    }

    if (
      input.recurringId !== undefined &&
      !state.recurringTransactions.some((item) => item.id === input.recurringId)
    ) {
      throw new Error('周期记录不存在')
    }

    const optionalText = (value: string | undefined) => {
      const text = value?.trim()
      return text ? text : undefined
    }
    const tag = input.tag === 'normal' ? undefined : input.tag

    return {
      kind: input.kind,
      amountCents: input.amountCents,
      category,
      date: input.date,
      ...(optionalText(input.note) ? { note: optionalText(input.note) } : {}),
      ...(tag ? { tag } : {}),
      ...(input.orderId ? { orderId: input.orderId } : {}),
      ...(input.orderId && input.stage ? { stage: input.stage } : {}),
      ...(input.recurringId ? { recurringId: input.recurringId } : {}),
      ...(input.relatedTransactionId
        ? { relatedTransactionId: input.relatedTransactionId }
        : {}),
      ...(optionalText(input.counterparty)
        ? { counterparty: optionalText(input.counterparty) }
        : {}),
      ...(input.source ? { source: input.source } : {}),
      ...(optionalText(input.sourceTradeNo)
        ? { sourceTradeNo: optionalText(input.sourceTradeNo) }
        : {}),
      ...(optionalText(input.occurredAt)
        ? { occurredAt: optionalText(input.occurredAt) }
        : {}),
    }
  }

  function updateTransaction(id: string, input: TransactionUpdateInput) {
    const existing = state.transactions.find((item) => item.id === id)

    if (!existing) {
      throw new Error('记账记录不存在')
    }

    const validatedInput = validateTransactionInput(input, id)

    commit({
      ...state,
      transactions: state.transactions.map((item) =>
        item.id === id
          ? {
              ...validatedInput,
              id,
              ...(existing.importId ? { importId: existing.importId } : {}),
            }
          : item,
      ),
    })
  }

  function deleteTransaction(id: string) {
    if (!state.transactions.some((item) => item.id === id)) {
      throw new Error('记账记录不存在')
    }

    commit({
      ...state,
      transactions: state.transactions
        .filter((item) => item.id !== id)
        .map((item) =>
          item.relatedTransactionId === id
            ? { ...item, relatedTransactionId: undefined }
            : item,
        ),
      billImports: state.billImports
        .map((item) => ({
          ...item,
          transactionIds: item.transactionIds.filter(
            (transactionId) => transactionId !== id,
          ),
        }))
        .filter((item) => item.transactionIds.length > 0),
    })
  }

  function saveRecurringTransaction(input: RecurringTransactionInput) {
    const name = input.name.trim()
    const category = input.category.trim()
    if (!name) {
      throw new Error('周期记录名称不能为空')
    }

    if (!category) {
      throw new Error('请选择有效分类')
    }

    if (
      input.kind !== 'expense' &&
      input.kind !== 'income'
    ) {
      throw new Error('周期记录类型无效')
    }

    if (
      !Number.isInteger(input.amountCents) ||
      input.amountCents <= 0
    ) {
      throw new Error('周期金额必须是大于 0 的整数金额')
    }

    if (!isRecurringFrequency(input.frequency)) {
      throw new Error('请选择有效的重复频率')
    }

    if (!isValidDateKey(input.nextDate)) {
      throw new Error('请选择有效的下次记录日期')
    }

    const note = input.note?.trim()
    const active = input.active ?? true
    if (input.id) {
      const exists = state.recurringTransactions.some(
        (item) => item.id === input.id,
      )
      if (!exists) {
        throw new Error('周期记录不存在')
      }

      commit({
        ...state,
        recurringTransactions: state.recurringTransactions.map((item) =>
          item.id === input.id
            ? {
                ...item,
                name,
                kind: input.kind,
                amountCents: input.amountCents,
                category,
                frequency: input.frequency,
                nextDate: input.nextDate,
                ...(note ? { note } : {}),
                active,
              }
            : item,
        ),
      })
      return
    }

    const recurring: RecurringTransaction = {
      id: createId(),
      name,
      kind: input.kind,
      amountCents: input.amountCents,
      category,
      frequency: input.frequency,
      nextDate: input.nextDate,
      ...(note ? { note } : {}),
      active,
    }
    commit({
      ...state,
      recurringTransactions: [recurring, ...state.recurringTransactions],
    })
  }

  function setRecurringTransactionStatus(id: string, active: boolean) {
    const exists = state.recurringTransactions.some((item) => item.id === id)
    if (!exists) {
      throw new Error('周期记录不存在')
    }

    commit({
      ...state,
      recurringTransactions: state.recurringTransactions.map((item) =>
        item.id === id ? { ...item, active } : item,
      ),
    })
  }

  function recordRecurringTransaction(id: string, date?: string) {
    const recurring = state.recurringTransactions.find((item) => item.id === id)
    if (!recurring) {
      throw new Error('周期记录不存在')
    }

    const paidDate = date ?? recurring.nextDate
    if (!isValidDateKey(paidDate)) {
      throw new Error('请选择有效的记录日期')
    }

    const transaction: Transaction = {
      id: createId(),
      kind: recurring.kind,
      amountCents: recurring.amountCents,
      category: recurring.category,
      date: paidDate,
      counterparty: recurring.name,
      tag: 'subscription',
      recurringId: recurring.id,
      source: 'manual',
      ...(recurring.note ? { note: recurring.note } : {}),
    }
    commit({
      ...state,
      transactions: [transaction, ...state.transactions],
      recurringTransactions: state.recurringTransactions.map((item) =>
        item.id === id
          ? { ...item, nextDate: getNextRecurringDate(item.nextDate, item.frequency) }
          : item,
      ),
    })
  }

  function deleteRecurringTransaction(id: string) {
    if (!state.recurringTransactions.some((item) => item.id === id)) {
      throw new Error('周期记录不存在')
    }

    commit({
      ...state,
      recurringTransactions: state.recurringTransactions.filter(
        (item) => item.id !== id,
      ),
      transactions: state.transactions.map((item) =>
        item.recurringId === id
          ? { ...item, recurringId: undefined }
          : item,
      ),
    })
  }

  function updatePaymentOrder(
    id: string,
    input: { name: string; expectedTotalCents: number },
  ) {
    const name = input.name.trim()

    if (!name) {
      throw new Error('订单名称不能为空')
    }

    if (
      !Number.isInteger(input.expectedTotalCents) ||
      input.expectedTotalCents <= 0
    ) {
      throw new Error('订单总额必须是大于 0 的整数金额')
    }

    if (!state.paymentOrders.some((order) => order.id === id)) {
      throw new Error('订单不存在')
    }

    commit({
      ...state,
      paymentOrders: state.paymentOrders.map((order) =>
        order.id === id
          ? { ...order, name, expectedTotalCents: input.expectedTotalCents }
          : order,
      ),
    })
  }

  function deletePaymentOrder(id: string) {
    if (!state.paymentOrders.some((order) => order.id === id)) {
      throw new Error('订单不存在')
    }

    commit({
      ...state,
      paymentOrders: state.paymentOrders.filter((order) => order.id !== id),
      transactions: state.transactions.map((item) =>
        item.orderId === id
          ? {
              ...item,
              orderId: undefined,
              stage: undefined,
            }
          : item,
      ),
    })
  }

  function importBillTransactions(input: BillImportInput): BillImportResult {
    if (!isExternalBillSource(input.source)) {
      throw new Error('账单来源无效')
    }

    const fileName = input.fileName.trim()
    if (!fileName) {
      throw new Error('账单文件名不能为空')
    }

    if (!Array.isArray(input.transactions)) {
      throw new Error('账单数据格式无效')
    }

    const seen = new Set(
      state.transactions
        .map((item) => getBillDuplicateKey(item))
        .filter(Boolean),
    )
    const imported: Transaction[] = []
    const transactionIds: string[] = []
    let duplicateCount = 0

    for (const draft of input.transactions) {
      if (
        !Number.isInteger(draft.amountCents) ||
        draft.amountCents <= 0 ||
        !isValidDateKey(draft.date) ||
        (draft.kind !== 'expense' &&
          draft.kind !== 'income' &&
          draft.kind !== 'transfer') ||
        !draft.category.trim()
      ) {
        throw new Error('账单中存在无效记录')
      }

      const tradeNo = draft.sourceTradeNo?.trim()
      const duplicateKey = tradeNo
        ? `${draft.source}:${tradeNo}`
        : `${draft.source}:${draft.date}:${draft.counterparty ?? ''}:${draft.amountCents}:${draft.kind}`
      if (seen.has(duplicateKey)) {
        duplicateCount += 1
        continue
      }

      seen.add(duplicateKey)
      const id = createId()
      const note = draft.note?.trim()
      const counterparty = draft.counterparty?.trim()
      const occurredAt = draft.occurredAt?.trim()
      imported.push({
        id,
        kind: draft.kind,
        amountCents: draft.amountCents,
        category: draft.category.trim(),
        date: draft.date,
        tag: draft.tag,
        source: input.source,
        ...(note ? { note } : {}),
        ...(counterparty ? { counterparty } : {}),
        ...(tradeNo ? { sourceTradeNo: tradeNo } : {}),
        ...(occurredAt ? { occurredAt } : {}),
      })
      transactionIds.push(id)
    }

    if (imported.length === 0) {
      return { importedCount: 0, duplicateCount }
    }

    const billImport: BillImport = {
      id: createId(),
      source: input.source,
      fileName,
      importedAt: now().toISOString(),
      transactionIds,
    }
    const importedTransactions = imported.map((item) => ({
      ...item,
      importId: billImport.id,
    }))
    commit({
      ...state,
      transactions: [...importedTransactions, ...state.transactions],
      billImports: [billImport, ...state.billImports],
    })
    return {
      importedCount: imported.length,
      duplicateCount,
      importId: billImport.id,
    }
  }

  function undoBillImport(importId: string) {
    const billImport = state.billImports.find((item) => item.id === importId)
    if (!billImport) {
      throw new Error('导入批次不存在')
    }

    commit({
      ...state,
      transactions: state.transactions.filter(
        (item) => item.importId !== importId,
      ),
      billImports: state.billImports.filter((item) => item.id !== importId),
    })
  }

  function recordStudyLog(input: StudyLogInput) {
    const topic = input.topic.trim()
    if (!topic) {
      throw new Error('学习主题不能为空')
    }

    if (
      !Number.isInteger(input.minutes) ||
      input.minutes <= 0
    ) {
      throw new Error('学习时长必须大于 0 分钟')
    }

    if (!isValidDateKey(input.date)) {
      throw new Error('请选择有效的学习日期')
    }

    if (
      input.pathId !== undefined &&
      !state.learningPaths.some((path) => path.id === input.pathId)
    ) {
      throw new Error('学习路径不存在')
    }

    if (
      input.platform !== undefined &&
      !isLearningPlatform(input.platform)
    ) {
      throw new Error('学习来源无效')
    }

    if (
      input.resourceId !== undefined &&
      !state.learningResources.some((resource) => resource.id === input.resourceId)
    ) {
      throw new Error('学习课程不存在')
    }

    const lesson = input.lessonId === undefined
      ? undefined
      : state.learningLessons.find((item) => item.id === input.lessonId)

    if (input.lessonId !== undefined && !lesson) {
      throw new Error('学习课时不存在')
    }

    if (lesson && lesson.resourceId !== input.resourceId) {
      throw new Error('学习课时与课程不匹配')
    }

    const note = input.note?.trim()
    const studyLog: StudyLog = {
      id: createId(),
      topic,
      minutes: input.minutes,
      date: input.date,
      ...(input.pathId ? { pathId: input.pathId } : {}),
      ...(input.platform ? { platform: input.platform } : {}),
      ...(input.resourceId ? { resourceId: input.resourceId } : {}),
      ...(lesson ? { lessonId: lesson.id } : {}),
      ...(note ? { note } : {}),
    }

    commit({
      ...state,
      studyLogs: [studyLog, ...state.studyLogs],
    })
  }

  function validateStudyLogInput(input: StudyLogInput) {
    const topic = input.topic.trim()

    if (!topic) {
      throw new Error('学习主题不能为空')
    }

    if (!Number.isInteger(input.minutes) || input.minutes <= 0) {
      throw new Error('学习时长必须大于 0 分钟')
    }

    if (!isValidDateKey(input.date)) {
      throw new Error('请选择有效的学习日期')
    }

    if (
      input.pathId !== undefined &&
      !state.learningPaths.some((path) => path.id === input.pathId)
    ) {
      throw new Error('学习路径不存在')
    }

    if (
      input.platform !== undefined &&
      !isLearningPlatform(input.platform)
    ) {
      throw new Error('学习来源无效')
    }

    if (
      input.resourceId !== undefined &&
      !state.learningResources.some((resource) => resource.id === input.resourceId)
    ) {
      throw new Error('学习课程不存在')
    }

    const lesson =
      input.lessonId === undefined
        ? undefined
        : state.learningLessons.find((item) => item.id === input.lessonId)

    if (input.lessonId !== undefined && !lesson) {
      throw new Error('学习课时不存在')
    }

    if (lesson && lesson.resourceId !== input.resourceId) {
      throw new Error('学习课时与课程不匹配')
    }

    const note = input.note?.trim()

    return {
      topic,
      minutes: input.minutes,
      date: input.date,
      ...(input.pathId ? { pathId: input.pathId } : {}),
      ...(input.platform ? { platform: input.platform } : {}),
      ...(input.resourceId ? { resourceId: input.resourceId } : {}),
      ...(lesson ? { lessonId: lesson.id } : {}),
      ...(note ? { note } : {}),
    }
  }

  function updateStudyLog(id: string, input: StudyLogUpdateInput) {
    if (!state.studyLogs.some((item) => item.id === id)) {
      throw new Error('学习记录不存在')
    }

    const validatedInput = validateStudyLogInput(input)

    commit({
      ...state,
      studyLogs: state.studyLogs.map((item) =>
        item.id === id ? { ...item, ...validatedInput } : item,
      ),
    })
  }

  function deleteStudyLog(id: string) {
    if (!state.studyLogs.some((item) => item.id === id)) {
      throw new Error('学习记录不存在')
    }

    commit({
      ...state,
      studyLogs: state.studyLogs.filter((item) => item.id !== id),
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

  function validateLearningPathInput(input: LearningPathInput) {
    const title = input.title.trim()

    if (!title) {
      throw new Error('学习路径名称不能为空')
    }

    if (!Number.isInteger(input.targetMinutes) || input.targetMinutes <= 0) {
      throw new Error('学习目标必须大于 0 分钟')
    }

    return { title, targetMinutes: input.targetMinutes }
  }

  function updateLearningPath(id: string, input: LearningPathInput) {
    if (!state.learningPaths.some((path) => path.id === id)) {
      throw new Error('学习路径不存在')
    }

    const validatedInput = validateLearningPathInput(input)

    commit({
      ...state,
      learningPaths: state.learningPaths.map((path) =>
        path.id === id ? { ...path, ...validatedInput } : path,
      ),
    })
  }

  function deleteLearningPath(id: string) {
    if (!state.learningPaths.some((path) => path.id === id)) {
      throw new Error('学习路径不存在')
    }

    commit({
      ...state,
      learningPaths: state.learningPaths.filter((path) => path.id !== id),
      learningResources: state.learningResources.map((resource) =>
        resource.pathId === id ? { ...resource, pathId: null } : resource,
      ),
      studyLogs: state.studyLogs.map((item) =>
        item.pathId === id ? { ...item, pathId: undefined } : item,
      ),
    })
  }

  function validateLearningResourceInput(input: LearningResourceInput) {
    const title = input.title.trim()

    if (!title) {
      throw new Error('资料名称不能为空')
    }

    if (
      input.pathId !== null &&
      !state.learningPaths.some((path) => path.id === input.pathId)
    ) {
      throw new Error('学习路径不存在')
    }

    if (input.sourceUrl !== undefined && !isHttpUrl(input.sourceUrl.trim())) {
      throw new Error('请输入有效的课程链接')
    }

    if (
      input.platform !== undefined &&
      !isLearningPlatform(input.platform)
    ) {
      throw new Error('学习来源无效')
    }

    if (
      input.targetMinutes !== undefined &&
      (!Number.isInteger(input.targetMinutes) || input.targetMinutes <= 0)
    ) {
      throw new Error('课程目标必须大于 0 分钟')
    }

    const sourceUrl = input.sourceUrl?.trim()
    const parsedSource = sourceUrl ? parseLearningSource(sourceUrl) : undefined
    const externalId = input.externalId?.trim() || parsedSource?.externalId

    return {
      pathId: input.pathId,
      title,
      kind: input.kind,
      status: input.status,
      ...(input.platform ? { platform: input.platform } : parsedSource?.platform ? { platform: parsedSource.platform } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(externalId ? { externalId } : {}),
      ...(input.targetMinutes ? { targetMinutes: input.targetMinutes } : {}),
    }
  }

  function addLearningResource(input: LearningResourceInput) {
    const validatedInput = validateLearningResourceInput(input)

    commit({
      ...state,
      learningResources: [
        {
          id: createId(),
          ...validatedInput,
        },
        ...state.learningResources,
      ],
    })
  }

  function updateLearningResource(id: string, input: LearningResourceInput) {
    if (!state.learningResources.some((resource) => resource.id === id)) {
      throw new Error('学习资料不存在')
    }

    const validatedInput = validateLearningResourceInput(input)

    commit({
      ...state,
      learningResources: state.learningResources.map((resource) =>
        resource.id === id ? { ...resource, ...validatedInput } : resource,
      ),
    })
  }

  function deleteLearningResource(id: string) {
    if (!state.learningResources.some((resource) => resource.id === id)) {
      throw new Error('学习资料不存在')
    }

    const removedLessonIds = new Set(
      state.learningLessons
        .filter((lesson) => lesson.resourceId === id)
        .map((lesson) => lesson.id),
    )

    commit({
      ...state,
      learningResources: state.learningResources.filter(
        (resource) => resource.id !== id,
      ),
      learningLessons: state.learningLessons.filter(
        (lesson) => lesson.resourceId !== id,
      ),
      studyLogs: state.studyLogs.map((item) =>
        item.resourceId === id
          ? { ...item, resourceId: undefined, lessonId: undefined }
          : item,
      ),
      learningNotes: state.learningNotes.map((note) =>
        note.resourceId === id
          ? {
              ...note,
              resourceId: null,
              lessonId:
                note.lessonId && removedLessonIds.has(note.lessonId)
                  ? null
                  : note.lessonId,
            }
          : note,
      ),
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

  function addLearningLessons(
    resourceId: string,
    drafts: Array<LearningLessonDraft>,
  ) {
    const resource = state.learningResources.find(
      (item) => item.id === resourceId,
    )

    if (!resource) {
      throw new Error('学习课程不存在')
    }

    if (drafts.length === 0) {
      throw new Error('请输入至少一个课时')
    }

    const existingCount = state.learningLessons.filter(
      (item) => item.resourceId === resourceId,
    ).length
    const lessons = drafts.map((draft, index) => {
      const title = draft.title.trim()
      if (!title) {
        throw new Error('课时名称不能为空')
      }

      if (
        draft.expectedMinutes !== undefined &&
        (!Number.isInteger(draft.expectedMinutes) || draft.expectedMinutes <= 0)
      ) {
        throw new Error('课时预计时长必须大于 0 分钟')
      }

      if (
        draft.status !== undefined &&
        !isLearningLessonStatus(draft.status)
      ) {
        throw new Error('课时状态无效')
      }

      if (
        draft.sourceUrl !== undefined &&
        !isHttpUrl(draft.sourceUrl.trim())
      ) {
        throw new Error('请输入有效的课时链接')
      }

      return {
        id: createId(),
        resourceId,
        title,
        sortOrder: existingCount + index + 1,
        status: draft.status ?? 'todo',
        ...(draft.expectedMinutes
          ? { expectedMinutes: draft.expectedMinutes }
          : {}),
        ...(draft.sourceUrl?.trim()
          ? { sourceUrl: draft.sourceUrl.trim() }
          : {}),
      }
    })

    commit({
      ...state,
      learningLessons: [...state.learningLessons, ...lessons],
    })
  }

  function setLearningLessonStatus(id: string, status: LearningLessonStatus) {
    const exists = state.learningLessons.some((lesson) => lesson.id === id)

    if (!exists) {
      throw new Error('学习课时不存在')
    }

    if (!isLearningLessonStatus(status)) {
      throw new Error('课时状态无效')
    }

    commit({
      ...state,
      learningLessons: state.learningLessons.map((lesson) =>
        lesson.id === id ? { ...lesson, status } : lesson,
      ),
    })
  }

  function updateLearningLesson(
    id: string,
    input: LearningLessonUpdateInput,
  ) {
    const existing = state.learningLessons.find((lesson) => lesson.id === id)

    if (!existing) {
      throw new Error('学习课时不存在')
    }

    const title = input.title.trim()
    if (!title) {
      throw new Error('课时名称不能为空')
    }

    if (
      input.expectedMinutes !== undefined &&
      (!Number.isInteger(input.expectedMinutes) || input.expectedMinutes <= 0)
    ) {
      throw new Error('课时预计时长必须大于 0 分钟')
    }

    if (!isLearningLessonStatus(input.status)) {
      throw new Error('课时状态无效')
    }

    if (
      input.sourceUrl !== undefined &&
      !isHttpUrl(input.sourceUrl.trim())
    ) {
      throw new Error('请输入有效的课时链接')
    }

    const sourceUrl = input.sourceUrl?.trim()

    commit({
      ...state,
      learningLessons: state.learningLessons.map((lesson) =>
        lesson.id === id
          ? {
              ...lesson,
              title,
              status: input.status,
              ...(input.expectedMinutes
                ? { expectedMinutes: input.expectedMinutes }
                : {}),
              ...(sourceUrl ? { sourceUrl } : {}),
            }
          : lesson,
      ),
    })
  }

  function deleteLearningLesson(id: string) {
    if (!state.learningLessons.some((lesson) => lesson.id === id)) {
      throw new Error('学习课时不存在')
    }

    commit({
      ...state,
      learningLessons: state.learningLessons.filter(
        (lesson) => lesson.id !== id,
      ),
      studyLogs: state.studyLogs.map((item) =>
        item.lessonId === id ? { ...item, lessonId: undefined } : item,
      ),
      learningNotes: state.learningNotes.map((note) =>
        note.lessonId === id ? { ...note, lessonId: null } : note,
      ),
    })
  }

  function addLearningNoteFolder(name: string) {
    const folderName = name.trim()

    if (!folderName) {
      throw new Error('笔记文件夹名称不能为空')
    }

    const folder: LearningNoteFolder = {
      id: createId(),
      name: folderName,
      createdAt: toDateKey(now()),
    }

    commit({
      ...state,
      learningNoteFolders: [folder, ...state.learningNoteFolders],
    })
  }

  function updateLearningNoteFolder(id: string, name: string) {
    const folderName = name.trim()

    if (!folderName) {
      throw new Error('笔记文件夹名称不能为空')
    }

    if (!state.learningNoteFolders.some((folder) => folder.id === id)) {
      throw new Error('笔记文件夹不存在')
    }

    commit({
      ...state,
      learningNoteFolders: state.learningNoteFolders.map((folder) =>
        folder.id === id ? { ...folder, name: folderName } : folder,
      ),
    })
  }

  function deleteLearningNoteFolder(id: string) {
    if (!state.learningNoteFolders.some((folder) => folder.id === id)) {
      throw new Error('笔记文件夹不存在')
    }

    commit({
      ...state,
      learningNoteFolders: state.learningNoteFolders.filter(
        (folder) => folder.id !== id,
      ),
      learningNotes: state.learningNotes.map((note) =>
        note.folderId === id ? { ...note, folderId: null } : note,
      ),
    })
  }

  function saveLearningNote(input: LearningNoteInput) {
    const title = input.title.trim()

    if (!title) {
      throw new Error('笔记标题不能为空')
    }

    const content = input.content.trim()

    if (!content) {
      throw new Error('笔记内容不能为空')
    }

    if (
      input.folderId !== null &&
      input.folderId !== undefined &&
      !state.learningNoteFolders.some((folder) => folder.id === input.folderId)
    ) {
      throw new Error('笔记文件夹不存在')
    }

    if (
      input.resourceId !== null &&
      input.resourceId !== undefined &&
      !state.learningResources.some(
        (resource) => resource.id === input.resourceId,
      )
    ) {
      throw new Error('学习课程不存在')
    }

    const lesson = input.lessonId === undefined || input.lessonId === null
      ? undefined
      : state.learningLessons.find((item) => item.id === input.lessonId)

    if (input.lessonId && !lesson) {
      throw new Error('学习课时不存在')
    }

    if (lesson && lesson.resourceId !== input.resourceId) {
      throw new Error('学习课时与课程不匹配')
    }

    const tags = [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))]
    const updatedAt = now().toISOString()

    if (input.id) {
      const exists = state.learningNotes.some((note) => note.id === input.id)

      if (!exists) {
        throw new Error('学习笔记不存在')
      }

      commit({
        ...state,
        learningNotes: state.learningNotes.map((note) =>
          note.id === input.id
            ? {
                ...note,
                folderId: input.folderId ?? null,
                title,
                content,
                tags,
                resourceId: input.resourceId ?? null,
                lessonId: lesson?.id ?? null,
                updatedAt,
              }
            : note,
        ),
      })
      return
    }

    const note: LearningNote = {
      id: createId(),
      folderId: input.folderId ?? null,
      title,
      content,
      tags,
      resourceId: input.resourceId ?? null,
      lessonId: lesson?.id ?? null,
      updatedAt,
    }

    commit({
      ...state,
      learningNotes: [note, ...state.learningNotes],
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

  function deleteLearningNote(id: string) {
    if (!state.learningNotes.some((note) => note.id === id)) {
      throw new Error('学习笔记不存在')
    }

    commit({
      ...state,
      learningNotes: state.learningNotes.filter((note) => note.id !== id),
    })
  }

  function updateWeeklyReview(id: string, input: WeeklyReviewUpdateInput) {
    const weekStartDate = input.weekStartDate.trim()

    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)) {
      throw new Error('请选择有效的周复盘日期')
    }

    if (
      state.weeklyReviews.some(
        (item) =>
          item.weekStartDate === weekStartDate &&
          item.id !== id,
      )
    ) {
      throw new Error('该周复盘已存在')
    }

    if (!state.weeklyReviews.some((item) => item.id === id)) {
      throw new Error('周复盘不存在')
    }

    commit({
      ...state,
      weeklyReviews: state.weeklyReviews.map((item) =>
        item.id === id
          ? {
              ...item,
              weekStartDate,
              wins: input.wins.trim(),
              blockers: input.blockers.trim(),
              nextFocus: input.nextFocus.trim(),
            }
          : item,
      ),
    })
  }

  function deleteWeeklyReview(id: string) {
    if (!state.weeklyReviews.some((item) => item.id === id)) {
      throw new Error('周复盘不存在')
    }

    commit({
      ...state,
      weeklyReviews: state.weeklyReviews.filter((item) => item.id !== id),
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

    const plan = cleanStringArray(input.plan)

    if (plan.length > 0) {
      workout.plan = plan
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

  function deleteWorkout(id: string) {
    if (!state.workouts.some((workout) => workout.id === id)) {
      throw new Error('训练记录不存在')
    }

    commit({
      ...state,
      workouts: state.workouts.filter((workout) => workout.id !== id),
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
    const metric = buildHealthMetric(createId(), input)
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

  function buildHealthMetric(id: string, input: HealthMetricInput): HealthMetric {
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

    return {
      id,
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
  }

  function updateHealthMetric(id: string, input: HealthMetricUpdateInput) {
    if (!state.healthMetrics.some((metric) => metric.id === id)) {
      throw new Error('身体指标记录不存在')
    }

    const metric = buildHealthMetric(id, input)
    const duplicate = state.healthMetrics.some(
      (item) => item.date === metric.date && item.id !== id,
    )

    if (duplicate) {
      throw new Error('该日期的身体指标记录已存在')
    }

    commit({
      ...state,
      healthMetrics: state.healthMetrics.map((item) =>
        item.id === id ? { ...metric, id } : item,
      ),
    })
  }

  function deleteHealthMetric(id: string) {
    if (!state.healthMetrics.some((metric) => metric.id === id)) {
      throw new Error('身体指标记录不存在')
    }

    commit({
      ...state,
      healthMetrics: state.healthMetrics.filter((metric) => metric.id !== id),
    })
  }

  function updateSettings(input: PersonalOSSettingsInput) {
    const nextSettings: PersonalOSSettings = { ...state.settings }

    if (input.weeklyWorkoutTarget !== undefined) {
      if (
        !Number.isInteger(input.weeklyWorkoutTarget) ||
        input.weeklyWorkoutTarget < 1 ||
        input.weeklyWorkoutTarget > 14
      ) {
        throw new Error('锻炼周目标必须在 1 到 14 次之间')
      }

      nextSettings.weeklyWorkoutTarget = input.weeklyWorkoutTarget
    }

    if (input.expenseCategories !== undefined) {
      nextSettings.expenseCategories = normalizeCategoryInput(
        input.expenseCategories,
        '支出分类',
      )
    }

    if (input.incomeCategories !== undefined) {
      nextSettings.incomeCategories = normalizeCategoryInput(
        input.incomeCategories,
        '收入分类',
      )
    }

    if (input.fontScale !== undefined) {
      if (
        input.fontScale !== 'default' &&
        input.fontScale !== 'large' &&
        input.fontScale !== 'xlarge'
      ) {
        throw new Error('请选择有效的界面字号')
      }

      nextSettings.fontScale = input.fontScale
    }

    if (input.reducedMotion !== undefined) {
      nextSettings.reducedMotion = input.reducedMotion
    }

    commit({ ...state, settings: nextSettings })
  }

  function renameCategory(kind: SettingsCategoryKind, from: string, to: string) {
    const nextName = to.trim()
    const currentName = from.trim()

    if (!nextName) {
      throw new Error('分类名称不能为空')
    }

    const label = kind === 'expense' ? '支出分类' : '收入分类'
    const categories = kind === 'expense'
      ? state.settings.expenseCategories
      : state.settings.incomeCategories

    if (!categories.includes(currentName)) {
      throw new Error(`${label}不存在`)
    }

    if (nextName !== currentName && categories.includes(nextName)) {
      throw new Error(`${label}已存在`)
    }

    const nextCategories = [
      ...new Set(
        categories.map((category) =>
          category === currentName ? nextName : category,
        ),
      ),
    ]

    const renamedRecordCategory = <
      T extends { kind: Transaction['kind']; category: string },
    >(
      record: T,
    ): T =>
      record.kind === kind && record.category === currentName
        ? { ...record, category: nextName }
        : record

    commit({
      ...state,
      transactions: state.transactions.map(renamedRecordCategory),
      recurringTransactions: state.recurringTransactions.map(
        renamedRecordCategory,
      ),
      settings:
        kind === 'expense'
          ? { ...state.settings, expenseCategories: nextCategories }
          : { ...state.settings, incomeCategories: nextCategories },
    })
  }

  return {
    subscribe,
    getSnapshot,
    replaceState(nextState: PersonalOSState) {
      state = nextState
      snapshot = nextState
      storage.setItem(storageKey, JSON.stringify(nextState))
      listeners.forEach((listener) => listener())
    },
    toggleTask,
    addTask,
    updateTask,
    deleteTask,
    addQuickTask,
    addProject,
    updateProject,
    deleteProject,
    setProjectStatus,
    recordTransaction,
    updateTransaction,
    deleteTransaction,
    saveRecurringTransaction,
    setRecurringTransactionStatus,
    recordRecurringTransaction,
    deleteRecurringTransaction,
    updatePaymentOrder,
    deletePaymentOrder,
    importBillTransactions,
    undoBillImport,
    recordStudyLog,
    updateStudyLog,
    deleteStudyLog,
    updateMonthlyBudget,
    addLearningPath,
    updateLearningPath,
    deleteLearningPath,
    addLearningResource,
    updateLearningResource,
    deleteLearningResource,
    setLearningResourceStatus,
    addLearningLessons,
    setLearningLessonStatus,
    updateLearningLesson,
    deleteLearningLesson,
    addLearningNoteFolder,
    updateLearningNoteFolder,
    deleteLearningNoteFolder,
    saveLearningNote,
    deleteLearningNote,
    saveWeeklyReview,
    updateWeeklyReview,
    deleteWeeklyReview,
    recordWorkout,
    updateWorkout,
    deleteWorkout,
    setWorkoutStatus,
    saveHealthMetric,
    updateHealthMetric,
    deleteHealthMetric,
    updateSettings,
    renameCategory,
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
    learningLessons: [],
    learningNoteFolders: [],
    learningNotes: [],
    weeklyReviews: [],
    workouts: [],
    healthMetrics: [],
    paymentOrders: [],
    recurringTransactions: [],
    billImports: [],
    settings: defaultPersonalOSSettings,
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
    learningLessons: Array.isArray(value.learningLessons)
      ? value.learningLessons.filter(isLearningLesson)
      : [],
    learningNoteFolders: Array.isArray(value.learningNoteFolders)
      ? value.learningNoteFolders.filter(isLearningNoteFolder)
      : [],
    learningNotes: Array.isArray(value.learningNotes)
      ? value.learningNotes.filter(isLearningNote)
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
    paymentOrders: Array.isArray(value.paymentOrders)
      ? value.paymentOrders.filter(isPaymentOrder)
      : [],
    recurringTransactions: Array.isArray(value.recurringTransactions)
      ? value.recurringTransactions.filter(isRecurringTransaction)
      : [],
    billImports: Array.isArray(value.billImports)
      ? value.billImports.filter(isBillImport)
      : [],
    settings: normalizeSettings(value.settings, fallback.settings),
  }
}

function normalizeSettings(
  value: unknown,
  fallback: PersonalOSSettings,
): PersonalOSSettings {
  if (!isRecord(value)) {
    return fallback
  }

  return {
    weeklyWorkoutTarget:
      typeof value.weeklyWorkoutTarget === 'number' &&
      Number.isInteger(value.weeklyWorkoutTarget) &&
      value.weeklyWorkoutTarget >= 1 &&
      value.weeklyWorkoutTarget <= 14
        ? value.weeklyWorkoutTarget
        : fallback.weeklyWorkoutTarget,
    expenseCategories: normalizeSavedCategories(
      value.expenseCategories,
      fallback.expenseCategories,
    ),
    incomeCategories: normalizeSavedCategories(
      value.incomeCategories,
      fallback.incomeCategories,
    ),
    fontScale:
      value.fontScale === 'default' ||
      value.fontScale === 'large' ||
      value.fontScale === 'xlarge'
        ? value.fontScale
        : fallback.fontScale,
    reducedMotion:
      typeof value.reducedMotion === 'boolean'
        ? value.reducedMotion
        : fallback.reducedMotion,
  }
}

function normalizeSavedCategories(value: unknown, fallback: string[]) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    return fallback
  }

  const categories = [...new Set(value.map((item) => item.trim()))].filter(
    Boolean,
  )
  return categories.length > 0 ? categories : fallback
}

function normalizeCategoryInput(value: string[], label: string) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`${label}格式无效`)
  }

  const categories = [...new Set(value.map((item) => item.trim()))].filter(
    Boolean,
  )

  if (categories.length === 0) {
    throw new Error(`${label}至少保留一项`)
  }

  return categories
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
    (value.kind === 'expense' ||
      value.kind === 'income' ||
      value.kind === 'transfer') &&
    typeof value.amountCents === 'number' &&
    Number.isInteger(value.amountCents) &&
    value.amountCents > 0 &&
    typeof value.category === 'string' &&
    typeof value.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.date)
  ) && (
    (value.note === undefined || typeof value.note === 'string') &&
    (value.tag === undefined || isTransactionTag(value.tag)) &&
    (value.orderId === undefined || typeof value.orderId === 'string') &&
    (value.stage === undefined || isPaymentStage(value.stage)) &&
    (value.recurringId === undefined ||
      typeof value.recurringId === 'string') &&
    (value.relatedTransactionId === undefined ||
      typeof value.relatedTransactionId === 'string') &&
    (value.counterparty === undefined ||
      typeof value.counterparty === 'string') &&
    (value.source === undefined || isBillSource(value.source)) &&
    (value.sourceTradeNo === undefined ||
      typeof value.sourceTradeNo === 'string') &&
    (value.occurredAt === undefined ||
      typeof value.occurredAt === 'string') &&
    (value.importId === undefined || typeof value.importId === 'string')
  )
}

function isPaymentStage(value: unknown): value is PaymentStage {
  return value === 'deposit' || value === 'final' || value === 'full'
}

function isBillSource(value: unknown): value is BillSource {
  return (
    value === 'manual' || value === 'alipay' || value === 'wechat'
  )
}

function isExternalBillSource(
  value: unknown,
): value is Exclude<BillSource, 'manual'> {
  return value === 'alipay' || value === 'wechat'
}

function isTransactionTag(value: unknown): value is TransactionTag {
  return (
    value === 'normal' ||
    value === 'subscription' ||
    value === 'refund'
  )
}

function isRecurringFrequency(value: unknown): value is RecurringFrequency {
  return value === 'weekly' || value === 'monthly' || value === 'yearly'
}

function isValidDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isPaymentOrder(value: unknown): value is PaymentOrder {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof value.expectedTotalCents === 'number' &&
    Number.isInteger(value.expectedTotalCents) &&
    value.expectedTotalCents > 0 &&
    typeof value.createdAt === 'string' &&
    isValidDateKey(value.createdAt)
  )
}

function isRecurringTransaction(
  value: unknown,
): value is RecurringTransaction {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    (value.kind === 'expense' || value.kind === 'income') &&
    typeof value.amountCents === 'number' &&
    Number.isInteger(value.amountCents) &&
    value.amountCents > 0 &&
    typeof value.category === 'string' &&
    value.category.trim().length > 0 &&
    isRecurringFrequency(value.frequency) &&
    typeof value.nextDate === 'string' &&
    isValidDateKey(value.nextDate) &&
    typeof value.active === 'boolean' &&
    (value.note === undefined || typeof value.note === 'string')
  )
}

function isBillImport(value: unknown): value is BillImport {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isExternalBillSource(value.source) &&
    typeof value.fileName === 'string' &&
    value.fileName.trim().length > 0 &&
    typeof value.importedAt === 'string' &&
    value.importedAt.length > 0 &&
    Array.isArray(value.transactionIds) &&
    value.transactionIds.every((item) => typeof item === 'string')
  )
}

function getBillDuplicateKey(transaction: Transaction) {
  if (!transaction.source || transaction.source === 'manual') {
    return ''
  }

  return transaction.sourceTradeNo
    ? `${transaction.source}:${transaction.sourceTradeNo}`
    : `${transaction.source}:${transaction.date}:${transaction.counterparty ?? ''}:${transaction.amountCents}:${transaction.kind}`
}

function getNextRecurringDate(dateKey: string, frequency: RecurringFrequency) {
  const date = new Date(`${dateKey}T00:00:00Z`)

  if (frequency === 'weekly') {
    date.setUTCDate(date.getUTCDate() + 7)
  } else if (frequency === 'monthly') {
    date.setUTCMonth(date.getUTCMonth() + 1)
  } else {
    date.setUTCFullYear(date.getUTCFullYear() + 1)
  }

  const nextYear = date.getUTCFullYear()
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0')
  const nextDay = String(date.getUTCDate()).padStart(2, '0')
  return `${nextYear}-${nextMonth}-${nextDay}`
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
    (value.pathId === undefined || typeof value.pathId === 'string') &&
    (value.platform === undefined || isLearningPlatform(value.platform)) &&
    (value.resourceId === undefined || typeof value.resourceId === 'string') &&
    (value.lessonId === undefined || typeof value.lessonId === 'string') &&
    (value.note === undefined ||
      (typeof value.note === 'string' && value.note.trim().length > 0))
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
    isLearningResourceStatus(value.status) &&
    (value.platform === undefined || isLearningPlatform(value.platform)) &&
    (value.sourceUrl === undefined ||
      (typeof value.sourceUrl === 'string' && value.sourceUrl.trim().length > 0)) &&
    (value.externalId === undefined ||
      (typeof value.externalId === 'string' && value.externalId.trim().length > 0)) &&
    (value.targetMinutes === undefined ||
      (typeof value.targetMinutes === 'number' &&
        Number.isInteger(value.targetMinutes) &&
        value.targetMinutes > 0))
)
}

function isLearningResourceKind(value: unknown): value is LearningResource['kind'] {
  return value === 'course' || value === 'book' || value === 'article' || value === 'video' || value === 'docs'
}

function isLearningResourceStatus(value: unknown): value is LearningResource['status'] {
  return value === 'todo' || value === 'doing' || value === 'done'
}

function isLearningLesson(value: unknown): value is LearningLesson {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.resourceId === 'string' &&
    typeof value.title === 'string' &&
    value.title.trim().length > 0 &&
    typeof value.sortOrder === 'number' &&
    Number.isInteger(value.sortOrder) &&
    value.sortOrder > 0 &&
    isLearningResourceStatus(value.status) &&
    (value.expectedMinutes === undefined ||
      (typeof value.expectedMinutes === 'number' &&
        Number.isInteger(value.expectedMinutes) &&
        value.expectedMinutes > 0)) &&
    (value.sourceUrl === undefined ||
      (typeof value.sourceUrl === 'string' && value.sourceUrl.trim().length > 0))
  )
}

function isLearningLessonStatus(
  value: unknown,
): value is LearningLessonStatus {
  return value === 'todo' || value === 'doing' || value === 'done'
}

function isLearningNoteFolder(value: unknown): value is LearningNoteFolder {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof value.createdAt === 'string' &&
    isValidDateKey(value.createdAt)
  )
}

function isLearningNote(value: unknown): value is LearningNote {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    (value.folderId === null || typeof value.folderId === 'string') &&
    typeof value.title === 'string' &&
    value.title.trim().length > 0 &&
    typeof value.content === 'string' &&
    value.content.trim().length > 0 &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === 'string') &&
    (value.resourceId === null || typeof value.resourceId === 'string') &&
    (value.lessonId === null || typeof value.lessonId === 'string') &&
    typeof value.updatedAt === 'string' &&
    value.updatedAt.length > 0
  )
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
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
    (value.plan === undefined || isStringArray(value.plan)) &&
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
