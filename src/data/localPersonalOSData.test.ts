import { describe, expect, it } from 'vitest'
import { createLocalPersonalOSData } from './localPersonalOSData'
import { createMemoryStorage } from '../test/memoryStorage'

describe('local Personal OS data', () => {
  it('persists planned tasks for the next session', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })

    data.addTask({
      title: ' 准备架构评审 ',
      date: '2026-09-11',
      category: 'work',
      time: '09:30',
    })

    const reloaded = createLocalPersonalOSData({ storage })
    const latest = reloaded.getSnapshot().tasks.at(-1)

    expect(latest).toMatchObject({
      title: '准备架构评审',
      meta: '工作 · 09:30',
      done: false,
      date: '2026-09-11',
      time: '09:30',
      category: 'work',
    })
  })

  it('rejects invalid planned tasks without changing state', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })
    const before = data.getSnapshot()

    expect(() => data.addTask({
      title: '  ',
      date: '2026-09-11',
      category: 'work',
    })).toThrow('计划内容不能为空')
    expect(() => data.addTask({
      title: '无效日期',
      date: '09-11',
      category: 'work',
    })).toThrow('请选择有效的计划日期')
    expect(() => data.addTask({
      title: '无效时间',
      date: '2026-09-11',
      category: 'work',
      time: '9:30',
    })).toThrow('请选择有效的计划时间')

    expect(data.getSnapshot()).toBe(before)
  })

  it('updates planned tasks and keeps their completion state', () => {
    const data = createLocalPersonalOSData({
      now: () => new Date('2026-09-14T10:00:00'),
      storage: createMemoryStorage(),
    })

    data.addTask({
      title: '准备架构评审',
      date: '2026-09-15',
      category: 'work',
      time: '09:30',
    })
    const taskId = data.getSnapshot().tasks.at(-1)?.id
    expect(taskId).toBeTruthy()
    data.toggleTask(taskId!)

    data.updateTask(taskId!, {
      title: '  主持架构评审  ',
      date: '2026-09-16',
      category: 'work',
      time: '14:00',
    })

    const updatedTask = data.getSnapshot().tasks.at(-1)
    expect(updatedTask).toMatchObject({
      id: taskId,
      title: '主持架构评审',
      meta: '工作 · 14:00',
      date: '2026-09-16',
      time: '14:00',
      category: 'work',
      done: true,
    })
    expect(() => data.updateTask('missing-task', {
      title: '不存在的任务',
      date: '2026-09-16',
      category: 'work',
    })).toThrow('计划任务不存在')
  })

  it('persists workbench projects and status changes', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })

    data.addProject({
      name: ' CLI 同步工具 ',
      goal: '让本地记录自动同步到云端',
      status: 'active',
      nextAction: '设计同步协议',
      dueDate: '2026-09-18',
    })
    const projectId = data.getSnapshot().projects[0].id
    data.setProjectStatus(projectId, 'blocked')

    const reloaded = createLocalPersonalOSData({ storage })

    expect(reloaded.getSnapshot().projects[0]).toMatchObject({
      name: 'CLI 同步工具',
      goal: '让本地记录自动同步到云端',
      status: 'blocked',
      nextAction: '设计同步协议',
      dueDate: '2026-09-18',
    })
  })

  it('rejects invalid projects without changing state', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })
    const before = data.getSnapshot()

    expect(() => data.addProject({
      name: '  ',
      goal: '有效目标',
      status: 'active',
      nextAction: '有效动作',
    })).toThrow('项目名称不能为空')
    expect(() => data.addProject({
      name: '无效目标',
      goal: '  ',
      status: 'active',
      nextAction: '有效动作',
    })).toThrow('项目目标不能为空')
    expect(() => data.addProject({
      name: '无效日期',
      goal: '有效目标',
      status: 'active',
      nextAction: '有效动作',
      dueDate: '09-18',
    })).toThrow('请选择有效的截止日期')

    expect(data.getSnapshot()).toBe(before)
  })

  it('persists quick finance records for the next session', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })

    data.recordTransaction({
      kind: 'expense',
      amountCents: 1250,
      category: '交通',
      date: '2026-09-11',
    })

    const reloaded = createLocalPersonalOSData({ storage })
    const latest = reloaded.getSnapshot().transactions[0]

    expect(latest).toMatchObject({
      kind: 'expense',
      amountCents: 1250,
      category: '交通',
      date: '2026-09-11',
    })
  })

  it('persists finance notes, orders, refunds, and recurring records', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })

    data.recordTransaction({
      kind: 'expense',
      amountCents: 200000,
      category: '数码',
      date: '2026-09-01',
      note: '相机定金',
      newOrder: { name: '微单相机', expectedTotalCents: 300000 },
      stage: 'deposit',
    })
    const orderId = data.getSnapshot().paymentOrders[0].id
    const expenseId = data.getSnapshot().transactions[0].id

    data.recordTransaction({
      kind: 'expense',
      amountCents: 100000,
      category: '数码',
      date: '2026-09-20',
      orderId,
      stage: 'final',
      note: '相机尾款',
    })
    data.recordTransaction({
      kind: 'income',
      amountCents: 5000,
      category: '数码',
      date: '2026-09-21',
      tag: 'refund',
      relatedTransactionId: expenseId,
      note: '配件退款',
    })
    data.saveRecurringTransaction({
      name: '云存储订阅',
      kind: 'expense',
      amountCents: 2100,
      category: '订阅',
      frequency: 'monthly',
      nextDate: '2026-10-01',
      note: '自动续费前手动确认',
    })
    const recurringId = data.getSnapshot().recurringTransactions[0].id
    data.recordRecurringTransaction(recurringId, '2026-10-01')

    const reloaded = createLocalPersonalOSData({ storage })
    expect(reloaded.getSnapshot().paymentOrders).toHaveLength(1)
    expect(reloaded.getSnapshot().paymentOrders[0]).toMatchObject({
      name: '微单相机',
      expectedTotalCents: 300000,
    })
    expect(reloaded.getSnapshot().transactions).toHaveLength(5)
    expect(reloaded.getSnapshot().transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          note: '相机定金',
          orderId,
          stage: 'deposit',
        }),
        expect.objectContaining({
          tag: 'refund',
          relatedTransactionId: expenseId,
        }),
        expect.objectContaining({
          tag: 'subscription',
          recurringId,
          date: '2026-10-01',
        }),
      ]),
    )
    expect(reloaded.getSnapshot().recurringTransactions[0]).toMatchObject({
      nextDate: '2026-11-01',
      active: true,
    })
  })

  it('updates and deletes records while retaining linked descendants', () => {
    const data = createLocalPersonalOSData({
      now: () => new Date('2026-09-17T10:00:00'),
      storage: createMemoryStorage(),
    })

    data.addProject({
      name: '原项目',
      goal: '原目标',
      status: 'active',
      nextAction: '原动作',
      dueDate: '2026-09-20',
    })
    const projectId = data.getSnapshot().projects[0].id
    data.updateProject(projectId, {
      name: '更新项目',
      goal: '更新目标',
      status: 'blocked',
      nextAction: '更新动作',
      dueDate: '2026-09-21',
    })
    expect(data.getSnapshot().projects[0]).toMatchObject({
      name: '更新项目',
      status: 'blocked',
    })
    data.deleteProject(projectId)
    expect(data.getSnapshot().projects).not.toContainEqual(
      expect.objectContaining({ id: projectId }),
    )
    expect(() => data.deleteProject(projectId)).toThrow('项目不存在')

    data.recordTransaction({
      kind: 'expense',
      amountCents: 10000,
      category: '数码',
      date: '2026-09-01',
      newOrder: { name: '相机订单', expectedTotalCents: 20000 },
      stage: 'deposit',
      source: 'manual',
    })
    const orderId = data.getSnapshot().paymentOrders[0].id
    const expense = data.getSnapshot().transactions[0]
    data.recordTransaction({
      kind: 'income',
      amountCents: 1000,
      category: '退款',
      date: '2026-09-02',
      tag: 'refund',
      relatedTransactionId: expense.id,
      source: 'manual',
    })

    data.updateTransaction(expense.id, {
      kind: expense.kind,
      amountCents: 12000,
      category: '电子',
      date: expense.date,
      orderId,
      stage: 'deposit',
      note: '更新后的支出',
      source: 'manual',
    })
    expect(
      data.getSnapshot().transactions.find((item) => item.id === expense.id),
    ).toMatchObject({
      amountCents: 12000,
      note: '更新后的支出',
      category: '电子',
      orderId,
      stage: 'deposit',
    })

    data.deleteTransaction(expense.id)
    const refund = data.getSnapshot().transactions[0]
    expect(refund.relatedTransactionId).toBeUndefined()

    data.saveRecurringTransaction({
      name: '订阅',
      kind: 'expense',
      amountCents: 2000,
      category: '软件',
      frequency: 'monthly',
      nextDate: '2026-10-01',
    })
    const recurringId = data.getSnapshot().recurringTransactions[0].id
    data.recordRecurringTransaction(recurringId, '2026-10-01')
    data.deleteRecurringTransaction(recurringId)
    expect(data.getSnapshot().transactions[0].recurringId).toBeUndefined()

    data.updatePaymentOrder(orderId, {
      name: '相机订单更新',
      expectedTotalCents: 24000,
    })
    data.deletePaymentOrder(orderId)
    expect(data.getSnapshot().paymentOrders).toHaveLength(0)
  })

  it('updates and deletes learning records while preserving linked notes and logs', () => {
    const data = createLocalPersonalOSData({
      storage: createMemoryStorage(),
    })

    data.addLearningPath({ title: '前端路径', targetMinutes: 600 })
    const pathId = data.getSnapshot().learningPaths[0].id
    data.addLearningResource({
      pathId,
      title: 'React 课程',
      kind: 'course',
      status: 'doing',
      platform: 'bilibili',
      sourceUrl: 'https://www.bilibili.com/video/BV1q5YL69E44/',
    })
    const resourceId = data.getSnapshot().learningResources[0].id
    data.addLearningLessons(resourceId, [
      { title: '第一课', expectedMinutes: 20 },
    ])
    const lessonId = data.getSnapshot().learningLessons[0].id
    data.recordStudyLog({
      topic: 'React',
      minutes: 20,
      date: '2026-09-17',
      pathId,
      resourceId,
      lessonId,
    })
    const logId = data.getSnapshot().studyLogs[0].id
    data.addLearningNoteFolder('React')
    const folderId = data.getSnapshot().learningNoteFolders[0].id
    data.saveLearningNote({
      folderId,
      title: 'Hooks',
      content: 'useState',
      tags: ['react'],
      resourceId,
      lessonId,
    })
    const noteId = data.getSnapshot().learningNotes[0].id

    data.updateLearningPath(pathId, { title: '前端进阶', targetMinutes: 800 })
    data.updateLearningResource(resourceId, {
      pathId,
      title: 'React 进阶',
      kind: 'course',
      status: 'doing',
      platform: 'bilibili',
    })
    data.updateLearningLesson(lessonId, {
      title: '第一课更新',
      status: 'done',
      expectedMinutes: 30,
    })
    data.updateStudyLog(logId, {
      topic: 'React 进阶',
      minutes: 30,
      date: '2026-09-17',
      pathId,
      resourceId,
      lessonId,
    })
    data.updateLearningNoteFolder(folderId, 'React 笔记')

    expect(data.getSnapshot().learningPaths[0]).toMatchObject({
      title: '前端进阶',
      targetMinutes: 800,
    })
    expect(data.getSnapshot().learningResources[0]).toMatchObject({
      title: 'React 进阶',
    })
    expect(data.getSnapshot().learningLessons[0]).toMatchObject({
      title: '第一课更新',
      status: 'done',
      expectedMinutes: 30,
    })

    data.deleteLearningResource(resourceId)
    expect(data.getSnapshot().learningLessons).toHaveLength(0)
    expect(data.getSnapshot().studyLogs[0]).toMatchObject({
      topic: 'React 进阶',
      minutes: 30,
    })
    expect(data.getSnapshot().studyLogs[0].resourceId).toBeUndefined()
    expect(data.getSnapshot().studyLogs[0].lessonId).toBeUndefined()
    expect(data.getSnapshot().learningNotes[0].resourceId).toBeNull()

    data.saveWeeklyReview({
      weekStartDate: '2026-09-14',
      wins: '完成课程',
      blockers: '',
      nextFocus: '练习',
    })
    const reviewId = data.getSnapshot().weeklyReviews[0].id
    data.updateWeeklyReview(reviewId, {
      weekStartDate: '2026-09-14',
      wins: '完成进阶课程',
      blockers: '',
      nextFocus: '练习',
    })
    data.deleteLearningNote(data.getSnapshot().learningNotes[0].id)
    data.deleteStudyLog(logId)
    data.deleteWeeklyReview(reviewId)

    expect(data.getSnapshot().learningNotes).not.toContainEqual(
      expect.objectContaining({ id: noteId }),
    )
    expect(data.getSnapshot().studyLogs).not.toContainEqual(
      expect.objectContaining({ id: logId }),
    )
    expect(data.getSnapshot().weeklyReviews).not.toContainEqual(
      expect.objectContaining({ id: reviewId }),
    )
  })

  it('updates, deletes health records, and renames settings categories', () => {
    const data = createLocalPersonalOSData({
      storage: createMemoryStorage(),
    })

    data.recordWorkout({
      date: '2026-09-17',
      kind: 'chest',
      kinds: ['chest', 'shoulders'],
      durationMinutes: 60,
      notes: '',
      focus: '胸肩',
    })
    const workoutId = data.getSnapshot().workouts[0].id
    data.updateWorkout(workoutId, {
      date: '2026-09-17',
      kind: 'back',
      kinds: ['back'],
      durationMinutes: 45,
      notes: '更新',
      status: 'completed',
    })
    expect(data.getSnapshot().workouts[0]).toMatchObject({
      kinds: ['back'],
      durationMinutes: 45,
    })
    data.deleteWorkout(workoutId)
    expect(data.getSnapshot().workouts).toHaveLength(0)

    data.saveHealthMetric({
      date: '2026-09-17',
      sleepHours: 7,
      weightKg: 70,
      condition: 'good',
      menstruationFlow: 'light',
      menstruationSymptoms: ['fatigue'],
    })
    const metricId = data.getSnapshot().healthMetrics[0].id
    data.updateHealthMetric(metricId, {
      date: '2026-09-17',
      sleepHours: 8,
      weightKg: 69,
      condition: 'great',
      menstruationFlow: 'medium',
      menstruationSymptoms: ['fatigue', 'cramps'],
    })
    expect(data.getSnapshot().healthMetrics[0]).toMatchObject({
      sleepHours: 8,
      weightKg: 69,
      menstruationSymptoms: ['fatigue', 'cramps'],
    })
    data.deleteHealthMetric(metricId)
    expect(data.getSnapshot().healthMetrics).toHaveLength(0)

    const oldExpenseCategory =
      data.getSnapshot().settings.expenseCategories[0]
    data.renameCategory('expense', oldExpenseCategory, '日常开销')
    expect(data.getSnapshot().settings.expenseCategories).toContain('日常开销')
    expect(data.getSnapshot().settings.expenseCategories).not.toContain(
      oldExpenseCategory,
    )
  })

  it('imports bills, skips duplicates, and undoes only the imported batch', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })

    data.recordTransaction({
      kind: 'expense',
      amountCents: 4500,
      category: '餐饮',
      date: '2026-09-10',
      source: 'alipay',
      sourceTradeNo: 'ALI-1',
    })

    const first = data.importBillTransactions({
      source: 'alipay',
      fileName: 'alipay.csv',
      transactions: [
        {
          kind: 'expense',
          amountCents: 4500,
          category: '餐饮',
          date: '2026-09-10',
          source: 'alipay',
          sourceTradeNo: 'ALI-1',
        },
        {
          kind: 'expense',
          amountCents: 8800,
          category: '交通',
          date: '2026-09-11',
          source: 'alipay',
          sourceTradeNo: 'ALI-2',
        },
      ],
    })
    const second = data.importBillTransactions({
      source: 'alipay',
      fileName: 'alipay.csv',
      transactions: [
        {
          kind: 'expense',
          amountCents: 8800,
          category: '交通',
          date: '2026-09-11',
          source: 'alipay',
          sourceTradeNo: 'ALI-2',
        },
      ],
    })

    expect(first).toMatchObject({ importedCount: 1, duplicateCount: 1 })
    expect(second).toEqual({ importedCount: 0, duplicateCount: 1 })
    expect(data.getSnapshot().transactions).toHaveLength(3)
    expect(data.getSnapshot().billImports).toHaveLength(1)

    const importId = data.getSnapshot().billImports[0].id
    data.undoBillImport(importId)

    expect(data.getSnapshot().transactions).toHaveLength(2)
    expect(data.getSnapshot().transactions[0]).toMatchObject({
      source: 'alipay',
      sourceTradeNo: 'ALI-1',
    })
    expect(data.getSnapshot().billImports).toEqual([])
  })

  it('persists learning logs for the next session', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })

    data.recordStudyLog({
      topic: 'React 架构设计',
      minutes: 45,
      date: '2026-09-11',
    })

    const reloaded = createLocalPersonalOSData({ storage })
    const latest = reloaded.getSnapshot().studyLogs[0]

    expect(latest).toMatchObject({
      topic: 'React 架构设计',
      minutes: 45,
      date: '2026-09-11',
    })
  })

  it('upgrades saved state that predates learning logs', () => {
    const storage = createMemoryStorage()
    const existing = createLocalPersonalOSData({ storage })
    existing.recordTransaction({
      kind: 'expense',
      amountCents: 1250,
      category: '交通',
      date: '2026-09-11',
    })
    const savedState = existing.getSnapshot()

    storage.setItem(
      'personal-os:v1',
      JSON.stringify({
        tasks: savedState.tasks,
        transactions: savedState.transactions,
      }),
    )

    const migrated = createLocalPersonalOSData({ storage })
    expect(migrated.getSnapshot().studyLogs).toEqual([])
    expect(migrated.getSnapshot().learningPaths).toEqual([])
    expect(migrated.getSnapshot().learningResources).toEqual([])
    expect(migrated.getSnapshot().learningLessons).toEqual([])
    expect(migrated.getSnapshot().learningNoteFolders).toEqual([])
    expect(migrated.getSnapshot().learningNotes).toEqual([])
    expect(migrated.getSnapshot().weeklyReviews).toEqual([])
    expect(migrated.getSnapshot().workouts).toEqual([])
    expect(migrated.getSnapshot().healthMetrics).toEqual([])
    expect(migrated.getSnapshot().paymentOrders).toEqual([])
    expect(migrated.getSnapshot().recurringTransactions).toEqual([])
    expect(migrated.getSnapshot().billImports).toEqual([])

    migrated.recordStudyLog({
      topic: 'TypeScript 泛型',
      minutes: 30,
      date: '2026-09-11',
    })

    expect(migrated.getSnapshot().studyLogs[0]).toMatchObject({
      topic: 'TypeScript 泛型',
      minutes: 30,
    })
  })

  it('persists monthly budgets for the next session', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })

    data.updateMonthlyBudget(200000)

    const reloaded = createLocalPersonalOSData({ storage })

    expect(reloaded.getSnapshot().monthlyBudgetCents).toBe(200000)
  })

  it('adds a default monthly budget when upgrading older saved state', () => {
    const storage = createMemoryStorage()
    const existing = createLocalPersonalOSData({ storage })
    existing.recordTransaction({
      kind: 'expense',
      amountCents: 3600,
      category: '餐饮',
      date: '2026-09-11',
    })
    const savedState = existing.getSnapshot()

    storage.setItem(
      'personal-os:v1',
      JSON.stringify({
        tasks: savedState.tasks,
        transactions: savedState.transactions,
        studyLogs: savedState.studyLogs,
      }),
    )

    const migrated = createLocalPersonalOSData({ storage })

    expect(migrated.getSnapshot().monthlyBudgetCents).toBe(100000)
  })

  it('rejects invalid monthly budgets without changing state', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })
    const before = data.getSnapshot()

    expect(() => data.updateMonthlyBudget(0)).toThrow('月度预算必须是大于 0 的整数金额')
    expect(() => data.updateMonthlyBudget(12.5)).toThrow('月度预算必须是大于 0 的整数金额')
    expect(data.getSnapshot()).toBe(before)
  })

  it('persists learning paths, resources, and weekly reviews', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })

    data.addLearningPath({
      title: 'TypeScript 工程化路径',
      targetMinutes: 900,
    })
    const pathId = data.getSnapshot().learningPaths[0].id

    data.addLearningResource({
      pathId,
      title: 'TypeScript 手册',
      kind: 'docs',
      status: 'todo',
    })
    const resourceId = data.getSnapshot().learningResources[0].id
    data.setLearningResourceStatus(resourceId, 'doing')

    data.saveWeeklyReview({
      weekStartDate: '2026-09-07',
      wins: '完成了仪表盘',
      blockers: '时间碎片化',
      nextFocus: '补齐预算统计',
    })

    const reloaded = createLocalPersonalOSData({ storage })
    const snapshot = reloaded.getSnapshot()

    expect(snapshot.learningPaths[0]).toMatchObject({
      title: 'TypeScript 工程化路径',
      targetMinutes: 900,
    })
    expect(snapshot.learningResources[0]).toMatchObject({
      pathId,
      title: 'TypeScript 手册',
      kind: 'docs',
      status: 'doing',
    })
    expect(snapshot.weeklyReviews[0]).toMatchObject({
      weekStartDate: '2026-09-07',
      wins: '完成了仪表盘',
      blockers: '时间碎片化',
      nextFocus: '补齐预算统计',
    })
  })

  it('replaces a weekly review when the same week is saved again', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })
    const input = {
      weekStartDate: '2026-09-07',
      wins: '第一版',
      blockers: '睡眠不足',
      nextFocus: '训练记录',
    }

    data.saveWeeklyReview(input)
    data.saveWeeklyReview({ ...input, wins: '完成预算和复盘' })

    expect(data.getSnapshot().weeklyReviews).toHaveLength(1)
    expect(data.getSnapshot().weeklyReviews[0].wins).toBe('完成预算和复盘')
  })

  it('persists multi-platform courses, lessons, and linked study notes', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })

    data.addLearningResource({
      pathId: null,
      title: '前端工程化实战',
      kind: 'course',
      status: 'doing',
      targetMinutes: 300,
      sourceUrl:
        'https://www.bilibili.com/video/BV1q5YL69E44/?vd_source=test',
    })
    const courseId = data.getSnapshot().learningResources[0].id
    data.addLearningLessons(courseId, [
      { title: '工程化总览', expectedMinutes: 20 },
      { title: '构建工具对比 | 35' },
    ])
    const lessonId = data.getSnapshot().learningLessons[0].id
    data.setLearningLessonStatus(lessonId, 'done')

    data.addLearningNoteFolder('课程笔记')
    const folderId = data.getSnapshot().learningNoteFolders[0].id
    data.saveLearningNote({
      title: '第一课要点',
      content: '# 核心结论\n\n先明确构建边界。',
      tags: ['前端', '构建'],
      folderId,
      resourceId: courseId,
      lessonId,
    })

    data.recordStudyLog({
      topic: '工程化总览',
      minutes: 25,
      date: '2026-09-17',
      platform: 'bilibili',
      resourceId: courseId,
      lessonId,
      note: '重点理解依赖图',
    })

    const reloaded = createLocalPersonalOSData({ storage })
    const snapshot = reloaded.getSnapshot()

    expect(snapshot.learningResources[0]).toMatchObject({
      id: courseId,
      platform: 'bilibili',
      externalId: 'BV1q5YL69E44',
      targetMinutes: 300,
    })
    expect(snapshot.learningLessons).toHaveLength(2)
    expect(snapshot.learningLessons[0]).toMatchObject({
      title: '工程化总览',
      sortOrder: 1,
      status: 'done',
      expectedMinutes: 20,
    })
    expect(snapshot.learningNotes[0]).toMatchObject({
      title: '第一课要点',
      folderId,
      resourceId: courseId,
      lessonId,
      tags: ['前端', '构建'],
    })
    expect(snapshot.studyLogs[0]).toMatchObject({
      platform: 'bilibili',
      resourceId: courseId,
      lessonId,
      note: '重点理解依赖图',
    })
  })

  it('rejects invalid learning lessons, notes, and logs without changing state', () => {
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    const before = data.getSnapshot()

    expect(() => data.addLearningLessons('missing', [
      { title: '课时' },
    ])).toThrow('学习课程不存在')
    expect(() => data.addLearningNoteFolder('  ')).toThrow(
      '笔记文件夹名称不能为空',
    )
    expect(() => data.saveLearningNote({
      title: '空笔记',
      content: ' ',
      tags: [],
      folderId: null,
      resourceId: null,
      lessonId: null,
    })).toThrow('笔记内容不能为空')
    expect(() => data.recordStudyLog({
      topic: '无效课时',
      minutes: 30,
      date: '2026-09-17',
      lessonId: 'missing',
    })).toThrow('学习课时不存在')

    expect(data.getSnapshot()).toBe(before)
  })

  it('rejects invalid learning paths without changing state', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })
    const before = data.getSnapshot()

    expect(() => data.addLearningPath({ title: '  ', targetMinutes: 600 })).toThrow('学习路径名称不能为空')
    expect(() => data.addLearningPath({ title: '无效目标', targetMinutes: 0 })).toThrow('学习目标必须大于 0 分钟')
    expect(data.getSnapshot()).toBe(before)
  })

  it('persists workouts and health metrics', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })

    data.recordWorkout({
      date: '2026-09-11',
      kind: 'chest',
      kinds: ['chest'],
      status: 'completed',
      durationMinutes: 45,
      notes: '',
      plan: [' 哑铃飞鸟 12×4 ', ''],
    })
    data.saveHealthMetric({
      date: '2026-09-11',
      sleepHours: 7.5,
      weightKg: 72.4,
      condition: 'good',
      menstruationFlow: 'light',
      menstruationSymptoms: ['cramps'],
      menstruationNote: '周期第 1 天',
    })

    const reloaded = createLocalPersonalOSData({ storage })
    const snapshot = reloaded.getSnapshot()

    expect(snapshot.workouts[0]).toMatchObject({
      date: '2026-09-11',
      kind: 'chest',
      kinds: ['chest'],
      status: 'completed',
      durationMinutes: 45,
      notes: '',
      plan: ['哑铃飞鸟 12×4'],
    })
    expect(snapshot.healthMetrics[0]).toMatchObject({
      date: '2026-09-11',
      sleepHours: 7.5,
      weightKg: 72.4,
      condition: 'good',
      menstruationFlow: 'light',
      menstruationSymptoms: ['cramps'],
      menstruationNote: '周期第 1 天',
    })
  })

  it('persists structured coach workout data', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })

    data.recordWorkout({
      date: '2026-09-09',
      kind: 'chest',
      kinds: ['chest', 'shoulders'],
      status: 'completed',
      durationMinutes: 60,
      notes: '',
      focus: ' 胸加肩 ',
      warmup: [' 热身激活 ', ''],
      exercises: [
        { name: ' 哑铃飞鸟 ', prescription: '12×2×4', target: ' ' },
        { name: ' ', prescription: '12×4' },
      ],
      finisher: ['核心收尾'],
      sorenessAreas: [' 胸大肌 ', '', '肩前束'],
      coachNotes: ['整体强度还不错'],
    })

    const reloaded = createLocalPersonalOSData({ storage })

    expect(reloaded.getSnapshot().workouts[0]).toEqual({
      id: expect.any(String),
      date: '2026-09-09',
      kind: 'chest',
      kinds: ['chest', 'shoulders'],
      status: 'completed',
      durationMinutes: 60,
      notes: '',
      focus: '胸加肩',
      warmup: ['热身激活'],
      exercises: [{ name: '哑铃飞鸟', prescription: '12×2×4' }],
      finisher: ['核心收尾'],
      sorenessAreas: ['胸大肌', '肩前束'],
      coachNotes: ['整体强度还不错'],
    })
  })

  it('updates a workout without changing its id or order', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })

    data.recordWorkout({
      date: '2026-09-09',
      kind: 'chest',
      kinds: ['chest', 'shoulders'],
      status: 'completed',
      durationMinutes: 60,
      notes: '原始备注',
      focus: '胸加肩',
      warmup: ['热身激活'],
      exercises: [{ name: '哑铃飞鸟', prescription: '12×2×4' }],
      finisher: ['核心收尾'],
      sorenessAreas: ['胸大肌'],
      coachNotes: ['整体强度还不错'],
    })
    data.recordWorkout({
      date: '2026-09-11',
      kind: 'back',
      kinds: ['back'],
      status: 'completed',
      durationMinutes: 50,
      notes: '',
    })

    const before = data.getSnapshot().workouts
    const workoutId = before[1]?.id as string

    data.updateWorkout(workoutId, {
      date: '2026-09-10',
      kind: 'cardio',
      kinds: ['cardio', 'legs'],
      status: 'completed',
      durationMinutes: 35,
      notes: ' 更新后的备注 ',
      plan: [' 高脚杯深蹲 12×3 ', ''],
      exercises: [{ name: ' 高脚杯深蹲 ', prescription: '12×2' }],
    })

    const after = data.getSnapshot().workouts

    expect(after).toHaveLength(2)
    expect(after[1]?.id).toBe(workoutId)
    expect(after[1]).toEqual({
      id: workoutId,
      date: '2026-09-10',
      kind: 'cardio',
      kinds: ['cardio', 'legs'],
      status: 'completed',
      durationMinutes: 35,
      notes: '更新后的备注',
      plan: ['高脚杯深蹲 12×3'],
      exercises: [{ name: '高脚杯深蹲', prescription: '12×2' }],
    })
  })

  it('rejects invalid workout updates without changing state', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })

    data.recordWorkout({
      date: '2026-09-09',
      kind: 'chest',
      kinds: ['chest'],
      status: 'completed',
      durationMinutes: 60,
      notes: '',
    })
    const before = data.getSnapshot()
    const workoutId = before.workouts[0]?.id as string

    expect(() => data.updateWorkout(workoutId, {
      date: '2026-09-09',
      kind: 'chest',
      kinds: ['chest'],
      status: 'completed',
      durationMinutes: -1,
      notes: '',
    })).toThrow('训练时长必须在 0 到 600 分钟之间')
    expect(() => data.updateWorkout('missing', {
      date: '2026-09-09',
      kind: 'chest',
      kinds: ['chest'],
      status: 'completed',
      durationMinutes: 30,
      notes: '',
    })).toThrow('训练记录不存在')
    expect(data.getSnapshot()).toBe(before)
  })

  it('updates workout status and replaces a health metric on the same date', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })

    data.recordWorkout({
      date: '2026-09-11',
      kind: 'cardio',
      kinds: ['cardio'],
      status: 'planned',
      durationMinutes: 30,
      notes: '',
    })
    const workoutId = data.getSnapshot().workouts[0].id
    data.setWorkoutStatus(workoutId, 'completed')

    const metricInput = {
      date: '2026-09-11',
      sleepHours: 6,
      weightKg: 72,
      condition: 'fair',
    } as const
    data.saveHealthMetric(metricInput)
    data.saveHealthMetric({
      ...metricInput,
      sleepHours: 8,
      condition: 'great',
    })

    const snapshot = data.getSnapshot()
    expect(snapshot.workouts[0]).toMatchObject({ id: workoutId, status: 'completed' })
    expect(snapshot.healthMetrics).toHaveLength(1)
    expect(snapshot.healthMetrics[0]).toMatchObject({
      sleepHours: 8,
      weightKg: 72,
      condition: 'great',
    })
  })

  it('rejects invalid health records without changing state', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })
    const before = data.getSnapshot()

    expect(() => data.recordWorkout({
      date: '2026-09-11',
      kind: 'chest',
      kinds: ['chest'],
      status: 'completed',
      durationMinutes: -10,
      notes: '',
    })).toThrow('训练时长必须在 0 到 600 分钟之间')
    expect(() => data.saveHealthMetric({
      date: '2026-09-11',
      sleepHours: 25,
      weightKg: null,
      condition: 'good',
    })).toThrow('睡眠时长必须在 0 到 24 小时之间')

    expect(data.getSnapshot()).toBe(before)
  })

  it('adds settings when upgrading older saved state', () => {
    const storage = createMemoryStorage()
    const existing = createLocalPersonalOSData({ storage })
    const savedState = existing.getSnapshot()

    storage.setItem(
      'personal-os:v1',
      JSON.stringify({
        tasks: savedState.tasks,
        transactions: savedState.transactions,
      }),
    )

    const migrated = createLocalPersonalOSData({ storage })

    expect(migrated.getSnapshot().settings).toMatchObject({
      weeklyWorkoutTarget: 4,
      expenseCategories: ['餐饮', '交通', '购物', '住房', '订阅', '其他'],
      incomeCategories: ['工资', '奖金', '理财', '其他'],
      fontScale: 'default',
      reducedMotion: false,
    })
  })

  it('persists settings and preserves transaction categories after removal', () => {
    const storage = createMemoryStorage()
    const data = createLocalPersonalOSData({ storage })

    data.updateSettings({
      weeklyWorkoutTarget: 5,
      expenseCategories: ['餐饮', '宠物'],
      incomeCategories: ['工资', '兼职'],
      fontScale: 'large',
      reducedMotion: true,
    })

    const reloaded = createLocalPersonalOSData({ storage })
    expect(reloaded.getSnapshot().settings).toEqual({
      weeklyWorkoutTarget: 5,
      expenseCategories: ['餐饮', '宠物'],
      incomeCategories: ['工资', '兼职'],
      fontScale: 'large',
      reducedMotion: true,
    })

    reloaded.recordTransaction({
      kind: 'expense',
      amountCents: 1200,
      category: '交通',
      date: '2026-09-12',
    })
    expect(reloaded.getSnapshot().transactions[0]).toMatchObject({
      category: '交通',
    })
  })

  it('rejects invalid settings without changing state', () => {
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    const before = data.getSnapshot()

    expect(() => data.updateSettings({ weeklyWorkoutTarget: 0 })).toThrow(
      '锻炼周目标必须在 1 到 14 次之间',
    )
    expect(() => data.updateSettings({ expenseCategories: [] })).toThrow(
      '支出分类至少保留一项',
    )
    data.updateSettings({
      expenseCategories: ['餐饮', ' 餐饮 ', ''],
    })
    expect(data.getSnapshot().settings.expenseCategories).toEqual(['餐饮'])
    expect(before.settings.expenseCategories).toHaveLength(6)

    const afterCategories = data.getSnapshot()
    expect(() =>
      data.updateSettings({ fontScale: 'huge' as never }),
    ).toThrow('请选择有效的界面字号')

    expect(data.getSnapshot()).toBe(afterCategories)
  })
})
