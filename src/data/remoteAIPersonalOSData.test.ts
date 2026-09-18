import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRemotePersonalOSData } from './remotePersonalOSData'
import type { AIPublicConfig, AISummary, PersonalOSState } from './model'

const remoteState: PersonalOSState = {
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
  settings: {
    weeklyWorkoutTarget: 3,
    expenseCategories: ['餐饮'],
    incomeCategories: ['工资'],
    fontScale: 'default',
    reducedMotion: false,
  },
}

const summary: AISummary = {
  id: 'summary-1',
  period: 'daily',
  scope: 'all',
  periodKey: '2026-09-18',
  title: '每日总结',
  content: '## 当前状态',
  model: 'test-model',
  promptTokens: 7,
  completionTokens: 3,
  totalTokens: 10,
  generatedAt: '2026-09-18T00:00:00.000Z',
  createdAt: '2026-09-18T00:00:00.000Z',
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('remote AI data', () => {
  it('loads config, generates summaries, updates state, and chats', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, request?: RequestInit) => {
      const path = String(input).replace('/api', '')
      if (path === '/state') {
        return response(remoteState)
      }
      if (path === '/ai/config') {
        const value: AIPublicConfig = {
          configured: true,
          baseUrl: 'http://127.0.0.1/v1',
          model: 'test-model',
          maxOutputTokens: 1200,
          timeoutSeconds: 60,
        }
        return response(value)
      }
      if (path === '/ai/summaries') {
        expect(request?.method).toBe('POST')
        return response({
          summary,
          state: { ...remoteState, aiSummaries: [summary] },
        })
      }
      if (path === '/ai/chat') {
        return response({
          answer: '回答',
          model: 'test-model',
          promptTokens: 1,
          completionTokens: 2,
          totalTokens: 3,
        })
      }
      throw new Error(`unexpected path: ${path}`)
    })

    const data = createRemotePersonalOSData({
      baseUrl: '/api',
      fetch: fetchMock as typeof fetch,
    })
    await data.ready

    expect(await data.getAIConfig()).toMatchObject({ configured: true })
    expect(await data.generateAISummary({ period: 'daily', scope: 'all' })).toEqual(summary)
    expect(data.getSnapshot().aiSummaries).toEqual([summary])
    expect(await data.sendAIChat({ question: '问题' })).toMatchObject({ answer: '回答' })
  })
})
