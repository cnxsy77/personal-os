import { createLocalPersonalOSData } from './localPersonalOSData'
import { defaultPersonalOSSettings } from '../utils/settings'
import type {
  AIChatInput,
  AIChatResult,
  AIPublicConfig,
  AISummary,
  AISummaryInput,
  AISummaryUpdateInput,
  BillImportInput,
  BillImportResult,
  HealthMetricInput,
  LearningLessonDraft,
  LearningLessonStatus,
  LearningLessonUpdateInput,
  LearningNoteInput,
  LearningNoteFolder,
  LearningResourceInput,
  LearningResourceStatus,
  PersonalOSData,
  PersonalOSState,
  PersonalOSSettingsInput,
  ProjectInput,
  ProjectStatus,
  RecurringTransactionInput,
  SettingsCategoryKind,
  StudyLogInput,
  TransactionInput,
  TransactionUpdateInput,
  WeeklyReviewInput,
  WorkoutInput,
  WorkoutStatus,
} from './model'

export type RemotePersonalOSDataOptions = {
  baseUrl?: string
  fetch?: typeof fetch
  onRequestError?: (error: Error) => void
}

type LocalPersonalOSData = PersonalOSData & {
  replaceState: (state: PersonalOSState) => void
}

type ApiRequest = {
  path: string
  method: 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
}

const emptyState: PersonalOSState = {
  tasks: [],
  projects: [],
  transactions: [],
  studyLogs: [],
  monthlyBudgetCents: 100000,
  learningPaths: [],
  learningResources: [],
  learningLessons: [],
  learningNoteFolders: [],
  learningNotes: [],
  weeklyReviews: [],
  workouts: [],
  healthMetrics: [],
  paymentOrders: [],
  recurringTransactions: [],
  billImports: [],
  aiSummaries: [],
  settings: defaultPersonalOSSettings,
}

type AISummaryResponse = {
  summary: AISummary
  state: PersonalOSState
}

export function createRemotePersonalOSData(
  options: RemotePersonalOSDataOptions = {},
): PersonalOSData & { ready: Promise<void> } {
  const baseUrl = options.baseUrl ?? '/api'
  const doFetch = options.fetch ?? fetch
  const mirror = createLocalPersonalOSData({
    seed: emptyState,
    storage: createNoopStorage(),
  }) as LocalPersonalOSData

  const ready = requestState()

  function requestState(): Promise<void> {
    return doFetch(`${baseUrl}/state`, { method: 'GET' })
      .then(async (response) => {
        if (!response.ok) {
          throw await createApiError(response)
        }
        mirror.replaceState((await response.json()) as PersonalOSState)
      })
      .catch((error: unknown) => {
        notify(createError(error, '无法加载本机数据'))
      })
  }

  function createNoopStorage(): Storage {
    const storage = new Map<string, string>()
    return {
      get length() {
        return storage.size
      },
      clear: () => storage.clear(),
      getItem: (key) => storage.get(key) ?? null,
      key: (index) => [...storage.keys()][index] ?? null,
      removeItem: (key) => storage.delete(key),
      setItem: (key, value) => storage.set(key, value),
    }
  }

  function notify(error: Error) {
    if (options.onRequestError) {
      options.onRequestError(error)
      return
    }
    window.dispatchEvent(
      new CustomEvent('personal-os:data-error', { detail: error.message }),
    )
  }

  function createError(error: unknown, fallback: string) {
    return error instanceof Error ? error : new Error(fallback)
  }

  async function createApiError(response: Response) {
    let message = `请求失败（${response.status}）`
    try {
      const value = (await response.json()) as { message?: unknown }
      if (typeof value.message === 'string' && value.message) {
        message = value.message
      }
    } catch {
      // Keep the status-based fallback.
    }
    return new Error(message)
  }

  async function send(request: ApiRequest) {
    let response: Response
    try {
      response = await doFetch(`${baseUrl}${request.path}`, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Personal-OS-Client': 'local',
        },
        ...(request.body === undefined
          ? {}
          : { body: JSON.stringify(request.body) }),
      })
    } catch (error: unknown) {
      throw createError(error, '无法连接本机服务')
    }

    if (!response.ok) {
      throw await createApiError(response)
    }

    if (request.path === '/bill-imports' && request.method === 'POST') {
      return (await response.json()) as BillImportResult
    }

    mirror.replaceState((await response.json()) as PersonalOSState)
  }

  function mutate(action: () => void, request: () => ApiRequest) {
    const previous = mirror.getSnapshot()
    action()

    return send(request())
      .then(async (result) => {
        if (result !== undefined) {
          await requestStateWithoutHandling()
        }
      })
      .catch((error: unknown) => {
        if (mirror.getSnapshot() !== previous) {
          mirror.replaceState(previous)
        }
        notify(createError(error, '保存失败'))
        throw error
      })
  }

  async function requestStateWithoutHandling() {
    const response = await doFetch(`${baseUrl}/state`, { method: 'GET' })
    if (!response.ok) {
      throw await createApiError(response)
    }
    mirror.replaceState((await response.json()) as PersonalOSState)
  }

  async function aiRequest<T>(
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    body?: unknown,
  ): Promise<T> {
    let response: Response
    try {
      response = await doFetch(`${baseUrl}${path}`, {
        method,
        headers: {
          ...(body === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
          'X-Personal-OS-Client': 'local',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    } catch (error: unknown) {
      throw createError(error, '无法连接本机 AI 服务')
    }

    if (!response.ok) {
      throw await createApiError(response)
    }

    return (await response.json()) as T
  }

  async function generateAISummary(input: AISummaryInput) {
    const previous = mirror.getSnapshot()

    try {
      const result = await aiRequest<AISummaryResponse>(
        '/ai/summaries',
        'POST',
        input,
      )
      mirror.replaceState(result.state)
      return result.summary
    } catch (error: unknown) {
      if (mirror.getSnapshot() !== previous) {
        mirror.replaceState(previous)
      }
      notify(createError(error, 'AI 总结生成失败'))
      throw error
    }
  }

  async function updateAISummary(id: string, input: AISummaryUpdateInput) {
    const previous = mirror.getSnapshot()

    try {
      await mirror.updateAISummary(id, input)
      const result = await aiRequest<AISummaryResponse>(
        `/ai/summaries/${encodeURIComponent(id)}`,
        'PATCH',
        input,
      )
      mirror.replaceState(result.state)
      return result.summary
    } catch (error: unknown) {
      if (mirror.getSnapshot() !== previous) {
        mirror.replaceState(previous)
      }
      notify(createError(error, 'AI 总结保存失败'))
      throw error
    }
  }

  async function deleteAISummary(id: string) {
    const previous = mirror.getSnapshot()

    try {
      await mirror.deleteAISummary(id)
      const state = await aiRequest<PersonalOSState>(
        `/ai/summaries/${encodeURIComponent(id)}`,
        'DELETE',
      )
      mirror.replaceState(state)
    } catch (error: unknown) {
      if (mirror.getSnapshot() !== previous) {
        mirror.replaceState(previous)
      }
      notify(createError(error, 'AI 总结删除失败'))
      throw error
    }
  }

  async function exportAISummary(id: string) {
    const previous = mirror.getSnapshot()

    try {
      const result = await aiRequest<AISummaryResponse>(
        `/ai/summaries/${encodeURIComponent(id)}/export`,
        'POST',
      )
      mirror.replaceState(result.state)
      return result.summary
    } catch (error: unknown) {
      if (mirror.getSnapshot() !== previous) {
        mirror.replaceState(previous)
      }
      notify(createError(error, 'AI 总结导出失败'))
      throw error
    }
  }

  async function sendAIChat(input: AIChatInput): Promise<AIChatResult> {
    const result = await aiRequest<AIChatResult>('/ai/chat', 'POST', input)
    return result
  }

  function importMutation(input: BillImportInput) {
    const previous = mirror.getSnapshot()

    try {
      mirror.importBillTransactions(input)
    } catch (error: unknown) {
      return Promise.reject(createError(error, '账单导入失败'))
    }

    return send({ path: '/bill-imports', method: 'POST', body: input })
      .then(async (result) => {
        await requestStateWithoutHandling()
        return result as BillImportResult
      })
      .catch((error: unknown) => {
        if (mirror.getSnapshot() !== previous) {
          mirror.replaceState(previous)
        }
        notify(createError(error, '账单导入失败'))
        throw error
      })
  }

  return {
    ready,
    subscribe: mirror.subscribe,
    getSnapshot: mirror.getSnapshot,
    toggleTask: (id) =>
      mutate(
        () => mirror.toggleTask(id),
        () => ({ path: `/tasks/${encodeURIComponent(id)}/toggle`, method: 'POST' }),
      ),
    addTask: (input) =>
      mutate(
        () => mirror.addTask(input),
        () => ({ path: '/tasks', method: 'POST', body: input }),
      ),
    updateTask: (id, input) =>
      mutate(
        () => mirror.updateTask(id, input),
        () => ({
          path: `/tasks/${encodeURIComponent(id)}`,
          method: 'PATCH',
          body: input,
        }),
      ),
    deleteTask: (id) =>
      mutate(
        () => mirror.deleteTask(id),
        () => ({ path: `/tasks/${encodeURIComponent(id)}`, method: 'DELETE' }),
      ),
    addQuickTask: (title) =>
      mutate(
        () => mirror.addQuickTask(title),
        () => ({ path: '/quick-task', method: 'POST', body: { title } }),
      ),
    addProject: (input: ProjectInput) =>
      mutate(
        () => mirror.addProject(input),
        () => ({ path: '/projects', method: 'POST', body: input }),
      ),
    updateProject: (id, input) =>
      mutate(
        () => mirror.updateProject(id, input),
        () => ({
          path: `/projects/${encodeURIComponent(id)}`,
          method: 'PATCH',
          body: input,
        }),
      ),
    deleteProject: (id) =>
      mutate(
        () => mirror.deleteProject(id),
        () => ({ path: `/projects/${encodeURIComponent(id)}`, method: 'DELETE' }),
      ),
    setProjectStatus: (id, status: ProjectStatus) =>
      mutate(
        () => mirror.setProjectStatus(id, status),
        () => ({
          path: `/projects/${encodeURIComponent(id)}/status`,
          method: 'PATCH',
          body: { status },
        }),
      ),
    recordTransaction: (input: TransactionInput) =>
      mutate(
        () => mirror.recordTransaction(input),
        () => ({ path: '/transactions', method: 'POST', body: input }),
      ),
    updateTransaction: (id, input: TransactionUpdateInput) =>
      mutate(
        () => mirror.updateTransaction(id, input),
        () => ({
          path: `/transactions/${encodeURIComponent(id)}`,
          method: 'PATCH',
          body: input,
        }),
      ),
    deleteTransaction: (id) =>
      mutate(
        () => mirror.deleteTransaction(id),
        () => ({
          path: `/transactions/${encodeURIComponent(id)}`,
          method: 'DELETE',
        }),
      ),
    saveRecurringTransaction: (input: RecurringTransactionInput) =>
      mutate(
        () => mirror.saveRecurringTransaction(input),
        () => ({
          path: '/recurring-transactions',
          method: 'POST',
          body: input,
        }),
      ),
    setRecurringTransactionStatus: (id, active) =>
      mutate(
        () => mirror.setRecurringTransactionStatus(id, active),
        () => ({
          path: `/recurring-transactions/${encodeURIComponent(id)}/status`,
          method: 'PATCH',
          body: { active },
        }),
      ),
    recordRecurringTransaction: (id, date) =>
      mutate(
        () => mirror.recordRecurringTransaction(id, date),
        () => ({
          path: `/recurring-transactions/${encodeURIComponent(id)}/record`,
          method: 'POST',
          body: { ...(date ? { date } : {}) },
        }),
      ),
    deleteRecurringTransaction: (id) =>
      mutate(
        () => mirror.deleteRecurringTransaction(id),
        () => ({
          path: `/recurring-transactions/${encodeURIComponent(id)}`,
          method: 'DELETE',
        }),
      ),
    updatePaymentOrder: (id, input) =>
      mutate(
        () => mirror.updatePaymentOrder(id, input),
        () => ({
          path: `/payment-orders/${encodeURIComponent(id)}`,
          method: 'PATCH',
          body: input,
        }),
      ),
    deletePaymentOrder: (id) =>
      mutate(
        () => mirror.deletePaymentOrder(id),
        () => ({
          path: `/payment-orders/${encodeURIComponent(id)}`,
          method: 'DELETE',
        }),
      ),
    importBillTransactions: (input: BillImportInput) => importMutation(input),
    undoBillImport: (importId) =>
      mutate(
        () => mirror.undoBillImport(importId),
        () => ({
          path: `/bill-imports/${encodeURIComponent(importId)}`,
          method: 'DELETE',
        }),
      ),
    recordStudyLog: (input: StudyLogInput) =>
      mutate(
        () => mirror.recordStudyLog(input),
        () => ({ path: '/study-logs', method: 'POST', body: input }),
      ),
    updateStudyLog: (id, input) =>
      mutate(
        () => mirror.updateStudyLog(id, input),
        () => ({
          path: `/study-logs/${encodeURIComponent(id)}`,
          method: 'PATCH',
          body: input,
        }),
      ),
    deleteStudyLog: (id) =>
      mutate(
        () => mirror.deleteStudyLog(id),
        () => ({
          path: `/study-logs/${encodeURIComponent(id)}`,
          method: 'DELETE',
        }),
      ),
    updateMonthlyBudget: (monthlyBudgetCents) =>
      mutate(
        () => mirror.updateMonthlyBudget(monthlyBudgetCents),
        () => ({
          path: '/settings/budget',
          method: 'PATCH',
          body: { amountCents: monthlyBudgetCents },
        }),
      ),
    addLearningPath: (input) =>
      mutate(
        () => mirror.addLearningPath(input),
        () => ({ path: '/learning-paths', method: 'POST', body: input }),
      ),
    updateLearningPath: (id, input) =>
      mutate(
        () => mirror.updateLearningPath(id, input),
        () => ({
          path: `/learning-paths/${encodeURIComponent(id)}`,
          method: 'PATCH',
          body: input,
        }),
      ),
    deleteLearningPath: (id) =>
      mutate(
        () => mirror.deleteLearningPath(id),
        () => ({
          path: `/learning-paths/${encodeURIComponent(id)}`,
          method: 'DELETE',
        }),
      ),
    addLearningResource: (input: LearningResourceInput) =>
      mutate(
        () => mirror.addLearningResource(input),
        () => ({ path: '/learning-resources', method: 'POST', body: input }),
      ),
    updateLearningResource: (id, input) =>
      mutate(
        () => mirror.updateLearningResource(id, input),
        () => ({
          path: `/learning-resources/${encodeURIComponent(id)}`,
          method: 'PATCH',
          body: input,
        }),
      ),
    deleteLearningResource: (id) =>
      mutate(
        () => mirror.deleteLearningResource(id),
        () => ({
          path: `/learning-resources/${encodeURIComponent(id)}`,
          method: 'DELETE',
        }),
      ),
    setLearningResourceStatus: (id, status: LearningResourceStatus) =>
      mutate(
        () => mirror.setLearningResourceStatus(id, status),
        () => ({
          path: `/learning-resources/${encodeURIComponent(id)}/status`,
          method: 'PATCH',
          body: { status },
        }),
      ),
    addLearningLessons: (resourceId, lessons: Array<LearningLessonDraft>) =>
      mutate(
        () => mirror.addLearningLessons(resourceId, lessons),
        () => ({
          path: `/learning-resources/${encodeURIComponent(resourceId)}/lessons`,
          method: 'POST',
          body: { resourceId, lessons },
        }),
      ),
    setLearningLessonStatus: (id, status: LearningLessonStatus) =>
      mutate(
        () => mirror.setLearningLessonStatus(id, status),
        () => ({
          path: `/learning-lessons/${encodeURIComponent(id)}/status`,
          method: 'PATCH',
          body: { status },
        }),
      ),
    updateLearningLesson: (id, input: LearningLessonUpdateInput) =>
      mutate(
        () => mirror.updateLearningLesson(id, input),
        () => ({
          path: `/learning-lessons/${encodeURIComponent(id)}`,
          method: 'PATCH',
          body: input,
        }),
      ),
    deleteLearningLesson: (id) =>
      mutate(
        () => mirror.deleteLearningLesson(id),
        () => ({
          path: `/learning-lessons/${encodeURIComponent(id)}`,
          method: 'DELETE',
        }),
      ),
    addLearningNoteFolder: (name) =>
      mutate(
        () => mirror.addLearningNoteFolder(name),
        () => ({
          path: '/learning-note-folders',
          method: 'POST',
          body: { name },
        }),
      ),
    updateLearningNoteFolder: (id: LearningNoteFolder['id'], name) =>
      mutate(
        () => mirror.updateLearningNoteFolder(id, name),
        () => ({
          path: `/learning-note-folders/${encodeURIComponent(id)}`,
          method: 'PATCH',
          body: { name },
        }),
      ),
    deleteLearningNoteFolder: (id) =>
      mutate(
        () => mirror.deleteLearningNoteFolder(id),
        () => ({
          path: `/learning-note-folders/${encodeURIComponent(id)}`,
          method: 'DELETE',
        }),
      ),
    saveLearningNote: (input: LearningNoteInput) =>
      mutate(
        () => mirror.saveLearningNote(input),
        () =>
          input.id
            ? {
                path: `/learning-notes/${encodeURIComponent(input.id)}`,
                method: 'PATCH',
                body: input,
              }
            : { path: '/learning-notes', method: 'POST', body: input },
      ),
    deleteLearningNote: (id) =>
      mutate(
        () => mirror.deleteLearningNote(id),
        () => ({
          path: `/learning-notes/${encodeURIComponent(id)}`,
          method: 'DELETE',
        }),
      ),
    saveWeeklyReview: (input: WeeklyReviewInput) =>
      mutate(
        () => mirror.saveWeeklyReview(input),
        () => ({ path: '/weekly-reviews', method: 'POST', body: input }),
      ),
    updateWeeklyReview: (id, input) =>
      mutate(
        () => mirror.updateWeeklyReview(id, input),
        () => ({
          path: `/weekly-reviews/${encodeURIComponent(id)}`,
          method: 'PATCH',
          body: input,
        }),
      ),
    deleteWeeklyReview: (id) =>
      mutate(
        () => mirror.deleteWeeklyReview(id),
        () => ({
          path: `/weekly-reviews/${encodeURIComponent(id)}`,
          method: 'DELETE',
        }),
      ),
    recordWorkout: (input: WorkoutInput) =>
      mutate(
        () => mirror.recordWorkout(input),
        () => ({ path: '/workouts', method: 'POST', body: input }),
      ),
    updateWorkout: (id, input) =>
      mutate(
        () => mirror.updateWorkout(id, input),
        () => ({
          path: `/workouts/${encodeURIComponent(id)}`,
          method: 'PATCH',
          body: input,
        }),
      ),
    deleteWorkout: (id) =>
      mutate(
        () => mirror.deleteWorkout(id),
        () => ({
          path: `/workouts/${encodeURIComponent(id)}`,
          method: 'DELETE',
        }),
      ),
    setWorkoutStatus: (id, status: WorkoutStatus) =>
      mutate(
        () => mirror.setWorkoutStatus(id, status),
        () => ({
          path: `/workouts/${encodeURIComponent(id)}/status`,
          method: 'PATCH',
          body: { status },
        }),
      ),
    saveHealthMetric: (input: HealthMetricInput) =>
      mutate(
        () => mirror.saveHealthMetric(input),
        () => ({ path: '/health-metrics', method: 'POST', body: input }),
      ),
    updateHealthMetric: (id, input) =>
      mutate(
        () => mirror.updateHealthMetric(id, input),
        () => ({
          path: `/health-metrics/${encodeURIComponent(id)}`,
          method: 'PATCH',
          body: input,
        }),
      ),
    deleteHealthMetric: (id) =>
      mutate(
        () => mirror.deleteHealthMetric(id),
        () => ({
          path: `/health-metrics/${encodeURIComponent(id)}`,
          method: 'DELETE',
        }),
      ),
    updateSettings: (input: PersonalOSSettingsInput) =>
      mutate(
        () => mirror.updateSettings(input),
        () => ({ path: '/settings', method: 'PATCH', body: input }),
      ),
    renameCategory: (kind: SettingsCategoryKind, from, to) =>
      mutate(
        () => mirror.renameCategory(kind, from, to),
        () => ({
          path: '/settings/categories/rename',
          method: 'POST',
          body: { kind, from, to },
        }),
      ),
    getAIConfig: () => aiRequest<AIPublicConfig>('/ai/config', 'GET'),
    generateAISummary,
    updateAISummary,
    deleteAISummary,
    exportAISummary,
    sendAIChat,
  }
}
