import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { AIDrawer } from './components/AIDrawer'
import { createLocalPersonalOSData } from './data/localPersonalOSData'
import type { AIPublicConfig, AISummary, PersonalOSData } from './data/model'
import { createMemoryStorage } from './test/memoryStorage'
import { getISOWeekKey } from './utils/isoWeek'

const summary: AISummary = {
  id: 'summary-1',
  period: 'weekly',
  scope: 'finance',
  periodKey: getISOWeekKey(new Date()),
  title: '每周记账总结',
  content: '## 当前状态\n- 餐饮支出正常\n\n## 下一步行动\n- 复核订阅',
  model: 'test-model',
  promptTokens: 20,
  completionTokens: 10,
  totalTokens: 30,
  generatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
}

function createAIData(overrides: Partial<PersonalOSData> = {}) {
  const base = createLocalPersonalOSData({ storage: createMemoryStorage() })
  return { data: { ...base, ...overrides } as PersonalOSData, base }
}

function renderDrawer(data: PersonalOSData, summaries: AISummary[] = []) {
  return render(
    <AIDrawer data={data} onClose={vi.fn()} open summaries={summaries} />,
  )
}

describe('AI drawer', () => {
  it('opens from the app header and closes with Escape', async () => {
    const user = userEvent.setup()
    const { data } = createAIData()
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: 'AI 助手' }))
    expect(screen.getByRole('dialog', { name: 'AI 助手' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'AI 助手' })).not.toBeInTheDocument()
  })

  it('shows configuration, generates, exports, edits, chats, and deletes a summary', async () => {
    const user = userEvent.setup()
    const config: AIPublicConfig = {
      configured: true,
      baseUrl: 'http://127.0.0.1/v1',
      model: 'test-model',
      maxOutputTokens: 1200,
      timeoutSeconds: 60,
    }
    const getAIConfig = vi.fn(async () => config)
    const generateAISummary = vi.fn(async () => summary)
    const exportAISummary = vi.fn(async () => summary)
    const sendAIChat = vi.fn(async () => ({
      answer: '优先复核订阅支出。',
      model: 'test-model',
      promptTokens: 10,
      completionTokens: 4,
      totalTokens: 14,
    }))
    const { data } = createAIData({
      getAIConfig,
      generateAISummary,
      exportAISummary,
      sendAIChat,
    })

    const view = renderDrawer(data)
    expect(await screen.findByText(/已连接 · test-model/)).toBeInTheDocument()

    await user.click(screen.getByLabelText('选择每周总结'))
    await user.click(screen.getByRole('button', { name: '刷新总结' }))
    await waitFor(() => expect(generateAISummary).toHaveBeenCalledWith({
      period: 'weekly',
      scope: 'all',
    }))

    view.rerender(
      <AIDrawer data={data} onClose={vi.fn()} open summaries={[summary]} />,
    )
    expect(await screen.findByText('每周记账总结')).toBeInTheDocument()
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'SPAN' &&
          element.textContent?.includes('30 tokens') === true,
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '查看' }))

    await user.click(screen.getByRole('button', { name: /保存文档/ }))
    await waitFor(() => expect(exportAISummary).toHaveBeenCalledWith('summary-1'))

    await user.type(screen.getByLabelText('追问内容'), '消费有什么风险？')
    await user.click(screen.getByRole('button', { name: '发送追问' }))
    expect(await screen.findByText('优先复核订阅支出。')).toBeInTheDocument()
    expect(sendAIChat).toHaveBeenCalledWith(expect.objectContaining({
      question: '消费有什么风险？',
      scope: 'finance',
      summaryId: 'summary-1',
    }))

    await user.click(screen.getByRole('button', { name: /删除/ }))
    expect(screen.getByRole('alertdialog', { name: '删除 AI 总结' })).toBeInTheDocument()
  })

  it('shows a clear error when local AI is not configured', async () => {
    const { data } = createAIData()
    renderDrawer(data)

    expect(
      await screen.findByText(/未配置 API Key/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '刷新总结' })).toBeDisabled()
  })
})
