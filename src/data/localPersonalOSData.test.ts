import { describe, expect, it } from 'vitest'
import { createLocalPersonalOSData } from './localPersonalOSData'
import { createMemoryStorage } from '../test/memoryStorage'

describe('local Personal OS data', () => {
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
})
