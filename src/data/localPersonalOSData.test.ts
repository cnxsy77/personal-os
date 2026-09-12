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
    expect(migrated.getSnapshot().weeklyReviews).toEqual([])
    expect(migrated.getSnapshot().workouts).toEqual([])
    expect(migrated.getSnapshot().healthMetrics).toEqual([])

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
      notes: ' 主项卧推 ',
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
      notes: '主项卧推',
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
})
