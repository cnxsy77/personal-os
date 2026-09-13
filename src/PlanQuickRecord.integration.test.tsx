import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createLocalPersonalOSData } from './data/localPersonalOSData'
import { createMemoryStorage } from './test/memoryStorage'

const now = new Date('2026-09-14T10:00:00')

beforeEach(() => {
  vi.useFakeTimers({
    now,
    shouldAdvanceTime: true,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

function createTestData() {
  return createLocalPersonalOSData({
    now: () => now,
    storage: createMemoryStorage(),
  })
}

describe('plan quick capture', () => {
  it('records a planned task, completes it, and refreshes summaries', async () => {
    const user = userEvent.setup()
    const data = createTestData()
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '计划' }))
    await user.click(screen.getByRole('button', { name: '添加计划' }))
    fireEvent.change(screen.getByLabelText('计划日期'), {
      target: { value: '2026-09-15' },
    })
    await user.type(screen.getByLabelText('计划事项'), '准备架构评审')
    await user.selectOptions(screen.getByLabelText('计划分类'), 'work')
    await user.type(screen.getByLabelText('计划时间'), '09:30')
    await user.click(screen.getByRole('button', { name: '保存计划' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('计划已保存')).toBeInTheDocument()
    expect(screen.getAllByText('准备架构评审')[0]).toBeInTheDocument()
    expect(data.getSnapshot().tasks.at(-1)).toMatchObject({
      title: '准备架构评审',
      date: '2026-09-15',
      category: 'work',
      time: '09:30',
    })

    await user.click(screen.getByRole('button', { name: '完成 准备架构评审' }))
    await user.selectOptions(screen.getByLabelText('状态'), '已完成')
    const completedGroup = screen
      .getByRole('heading', { name: '已完成' })
      .closest('section') as HTMLElement

    expect(
      within(completedGroup).getByText('准备架构评审'),
    ).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('keeps the dialog open when required input is missing', async () => {
    const user = userEvent.setup()
    const data = createTestData()
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '计划' }))
    await user.click(screen.getByRole('button', { name: '添加计划' }))
    await user.click(screen.getByRole('button', { name: '保存计划' }))

    expect(screen.getByRole('dialog', { name: '添加计划' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('请输入计划事项')
    expect(data.getSnapshot().tasks).toHaveLength(3)
  })

  it('groups tasks by time and filters the plan stream', async () => {
    const user = userEvent.setup()
    const data = createTestData()

    data.addTask({
      title: '归档上月账单',
      date: '2026-09-07',
      category: 'life',
    })
    data.addTask({
      title: '安排锻炼计划',
      date: '2026-09-15',
      category: 'health',
      time: '08:00',
    })
    data.addTask({
      title: '更新周报',
      date: '2026-09-17',
      category: 'work',
    })
    data.addTask({
      title: '年度复盘',
      date: '2026-09-27',
      category: 'life',
    })
    data.addQuickTask('整理想法')

    render(<App data={data} />)
    await user.click(screen.getByRole('button', { name: '计划' }))
    await user.selectOptions(screen.getByLabelText('状态'), '全部状态')
    await user.click(screen.getByRole('button', { name: '全部' }))

    const groupNames = ['逾期', '今天', '明天', '本周后续', '更远', '未排期']

    for (const name of groupNames) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }

    const overdueGroup = screen
      .getByRole('heading', { name: '逾期' })
      .closest('section') as HTMLElement
    expect(
      within(overdueGroup).getByText('归档上月账单'),
    ).toBeInTheDocument()
    expect(overdueGroup.querySelector('.task-tag.alert')).toHaveTextContent(
      '逾期',
    )

    await user.selectOptions(screen.getByLabelText('分类'), '锻炼')
    const healthGroup = screen
      .getByRole('heading', { name: '明天' })
      .closest('section') as HTMLElement

    expect(
      within(healthGroup).getByText('安排锻炼计划'),
    ).toBeInTheDocument()
    expect(screen.queryByText('年度复盘')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('搜索'), '不存在的任务')
    expect(screen.getByText('没有匹配的计划')).toBeInTheDocument()
  })
})
