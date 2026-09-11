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
})
