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

  it('edits a planned task with its current values', async () => {
    const user = userEvent.setup()
    const data = createTestData()

    data.addTask({
      title: '准备架构评审',
      date: '2026-09-15',
      category: 'work',
      time: '09:30',
    })
    const taskId = data.getSnapshot().tasks.at(-1)?.id
    expect(taskId).toBeTruthy()
    data.toggleTask(taskId!)

    render(<App data={data} />)
    await user.click(screen.getByRole('button', { name: '计划' }))
    await user.selectOptions(screen.getByLabelText('状态'), '全部状态')
    await user.click(screen.getByRole('button', { name: '全部' }))
    await user.click(screen.getByRole('button', { name: '编辑 准备架构评审' }))

    expect(screen.getByRole('dialog', { name: '编辑计划' })).toBeInTheDocument()
    expect(screen.getByLabelText('计划事项')).toHaveValue('准备架构评审')
    expect(screen.getByLabelText('计划日期')).toHaveValue('2026-09-15')
    expect(screen.getByLabelText('计划分类')).toHaveValue('work')
    expect(screen.getByLabelText('计划时间')).toHaveValue('09:30')

    await user.clear(screen.getByLabelText('计划事项'))
    await user.type(screen.getByLabelText('计划事项'), '主持架构评审')
    fireEvent.change(screen.getByLabelText('计划日期'), {
      target: { value: '2026-09-16' },
    })
    fireEvent.change(screen.getByLabelText('计划时间'), {
      target: { value: '14:00' },
    })
    await user.click(screen.getByRole('button', { name: '更新计划' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('计划已更新')).toBeInTheDocument()
    expect(screen.getByText('主持架构评审')).toBeInTheDocument()
    expect(data.getSnapshot().tasks.at(-1)).toMatchObject({
      id: taskId,
      title: '主持架构评审',
      date: '2026-09-16',
      time: '14:00',
      category: 'work',
      done: true,
    })
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

  it('deletes a planned task only after confirmation', async () => {
    const user = userEvent.setup()
    const data = createTestData()
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '计划' }))
    await user.click(screen.getByRole('button', { name: '全部' }))
    await user.click(
      screen.getByRole('button', { name: '删除 学习 React 架构设计 45 分钟' }),
    )

    expect(screen.getByRole('alertdialog', { name: '删除计划' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(data.getSnapshot().tasks).toHaveLength(3)

    await user.click(
      screen.getByRole('button', { name: '删除 学习 React 架构设计 45 分钟' }),
    )
    await user.click(screen.getByRole('button', { name: '确认删除' }))

    expect(data.getSnapshot().tasks).toHaveLength(2)
    expect(screen.getByText('计划已删除')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: '删除 学习 React 架构设计 45 分钟',
      }),
    ).not.toBeInTheDocument()
  })
})
