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
})
