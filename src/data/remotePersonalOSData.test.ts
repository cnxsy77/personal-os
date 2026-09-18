import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRemotePersonalOSData } from './remotePersonalOSData'
import type { PersonalOSState } from './model'

const remoteState: PersonalOSState = {
  tasks: [
    {
      id: 'server-task',
      title: '服务端任务',
      meta: '工作 · 今天',
      done: false,
      date: '2026-09-18',
      category: 'work',
    },
  ],
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
  settings: {
    weeklyWorkoutTarget: 4,
    expenseCategories: ['餐饮'],
    incomeCategories: ['工资'],
    fontScale: 'default',
    reducedMotion: false,
  },
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('remote personal OS data', () => {
  it('loads state from the local API', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(remoteState))
    const data = createRemotePersonalOSData({
      baseUrl: '/api',
      fetch: fetchMock as unknown as typeof fetch,
    })

    await data.ready

    expect(fetchMock).toHaveBeenCalledWith('/api/state', { method: 'GET' })
    expect(data.getSnapshot().tasks[0]?.title).toBe('服务端任务')
    expect(data.getSnapshot().settings.weeklyWorkoutTarget).toBe(4)
  })

  it('applies an optimistic change and replaces it with server state', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/state') {
        return jsonResponse(remoteState)
      }
      if (url === '/api/tasks') {
        const saved = clone(remoteState)
        saved.tasks.unshift({
          id: 'server-created',
          title: '新任务',
          meta: '工作 · 今天',
          done: false,
          date: '2026-09-18',
          time: '09:30',
          category: 'work',
        })
        return jsonResponse(saved, 201)
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    const data = createRemotePersonalOSData({
      baseUrl: '/api',
      fetch: fetchMock as unknown as typeof fetch,
    })
    await data.ready

    await data.addTask({
      title: '新任务',
      date: '2026-09-18',
      time: '09:30',
      category: 'work',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Personal-OS-Client': 'local',
      },
      body: expect.any(String),
    })
    expect(data.getSnapshot().tasks[0]?.id).toBe('server-created')
  })

  it('rolls back and reports a Chinese API error', async () => {
    const errors: Error[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/state') {
        return jsonResponse(remoteState)
      }
      if (url === '/api/tasks') {
        return jsonResponse(
          { code: 'invalid_input', message: '计划日期不能为空' },
          400,
        )
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    const data = createRemotePersonalOSData({
      baseUrl: '/api',
      fetch: fetchMock as unknown as typeof fetch,
      onRequestError: (error) => errors.push(error),
    })
    await data.ready
    const before = data.getSnapshot()

    await expect(
      data.addTask({
        title: '失败任务',
        date: '2026-09-19',
        category: 'life',
      }),
    ).rejects.toThrow('计划日期不能为空')

    expect(errors[0]?.message).toBe('计划日期不能为空')
    expect(data.getSnapshot()).toBe(before)
  })

  it('imports bills, refreshes state, and returns the import result', async () => {
    const importInput = {
      source: 'alipay' as const,
      fileName: 'alipay.csv',
      transactions: [
        {
          kind: 'expense' as const,
          amountCents: 2500,
          category: '交通',
          date: '2026-09-17',
          source: 'alipay' as const,
          sourceTradeNo: 'TP-1',
        },
      ],
    }
    const importedState = clone(remoteState)
    importedState.billImports = [
      {
        id: 'import-1',
        source: 'alipay',
        fileName: 'alipay.csv',
        importedAt: '2026-09-18T08:00:00.000Z',
        transactionIds: ['transaction-1'],
      },
    ]
    importedState.transactions = [
      {
        id: 'transaction-1',
        ...importInput.transactions[0],
        importId: 'import-1',
      },
    ]
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/state') {
        return jsonResponse(importedState)
      }
      if (url === '/api/bill-imports') {
        return jsonResponse({
          importedCount: 1,
          duplicateCount: 0,
          importId: 'import-1',
        })
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    const data = createRemotePersonalOSData({
      baseUrl: '/api',
      fetch: fetchMock as unknown as typeof fetch,
    })
    await data.ready

    const result = await data.importBillTransactions(importInput)

    expect(result).toEqual({
      importedCount: 1,
      duplicateCount: 0,
      importId: 'import-1',
    })
    expect(data.getSnapshot().billImports[0]?.id).toBe('import-1')
    expect(data.getSnapshot().transactions[0]?.sourceTradeNo).toBe('TP-1')
  })
})
