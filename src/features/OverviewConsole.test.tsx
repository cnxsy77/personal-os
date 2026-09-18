import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createLocalPersonalOSData } from '../data/localPersonalOSData'
import { createMemoryStorage } from '../test/memoryStorage'
import { OverviewConsole } from './OverviewConsole'
import type { PersonalOSState } from '../data/model'

function createAppData() {
  return createLocalPersonalOSData({ storage: createMemoryStorage() })
}

describe('OverviewConsole', () => {
  it('renders KPI values and four domain progress bars from current data', () => {
    const data = createAppData()

    render(
      <OverviewConsole
        data={data}
        state={data.getSnapshot()}
        onTaskToggle={data.toggleTask}
        onTaskDelete={data.deleteTask}
      />,
    )

    expect(screen.getByText('今日待办')).toBeInTheDocument()
    expect(screen.getAllByText('3')[0]).toBeInTheDocument()
    expect(screen.getAllByText('0/4')).toHaveLength(2)
    expect(screen.getByText('¥964')).toBeInTheDocument()
    expect(screen.getAllByText('45 分钟')).toHaveLength(2)

    expect(screen.getByLabelText('锻炼进度')).toHaveTextContent('0/4')
    expect(screen.getByLabelText('记账进度')).toHaveTextContent('4% 已使用')
    expect(screen.getByLabelText('学习进度')).toHaveTextContent('4% 平均进度')
    expect(screen.getByLabelText('工作台进度')).toHaveTextContent('0/1 项目已完成')
  })

  it('filters the record table by domain', async () => {
    const user = userEvent.setup()
    const data = createAppData()

    render(
      <OverviewConsole
        data={data}
        state={data.getSnapshot()}
        onTaskToggle={data.toggleTask}
        onTaskDelete={data.deleteTask}
      />,
    )

    const table = screen.getByRole('table')

    expect(within(table).getByText('完成 Personal OS 仪表盘 MVP')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '筛选学习' }))
    expect(within(table).getByText('React 架构设计')).toBeInTheDocument()
    expect(
      within(table).queryByText('完成 Personal OS 仪表盘 MVP'),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '筛选学习' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('keeps task completion available in the record table', async () => {
    const user = userEvent.setup()
    const data = createAppData()

    const view = render(
      <OverviewConsole
        data={data}
        state={data.getSnapshot()}
        onTaskToggle={data.toggleTask}
        onTaskDelete={data.deleteTask}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: '完成 完成 Personal OS 仪表盘 MVP' }),
    )

    view.rerender(
      <OverviewConsole
        data={data}
        state={data.getSnapshot()}
        onTaskToggle={data.toggleTask}
        onTaskDelete={data.deleteTask}
      />,
    )

    expect(
      screen.getByRole('img', { name: '已完成 1 / 3' }),
    ).toBeInTheDocument()
    expect(screen.getByText('2 项剩余')).toBeInTheDocument()
  })

  it('builds decisions from overdue, blocked, and budget signals', () => {
    const data = createAppData()
    const projectId = data.getSnapshot().projects[0].id
    data.setProjectStatus(projectId, 'blocked')
    data.recordTransaction({
      kind: 'expense',
      amountCents: 103600,
      category: '设备',
      date: '2026-09-11',
    })
    const state: PersonalOSState = {
      ...data.getSnapshot(),
      monthlyBudgetCents: 100000,
    }

    render(
      <OverviewConsole
        data={data}
        state={state}
        onTaskToggle={data.toggleTask}
        onTaskDelete={data.deleteTask}
      />,
    )

    const decisionList = screen.getByRole('list', { name: '需要决策' })

    expect(within(decisionList).getByText('Personal OS 项目受阻')).toBeInTheDocument()
    expect(within(decisionList).getByText('下一步：完成项目工作台')).toBeInTheDocument()
    expect(within(decisionList).getByText('预算已超支 ¥72')).toBeInTheDocument()
    expect(within(decisionList).getByText('请复核本月支出')).toBeInTheDocument()
  })

  it('opens task edit and deletes a task after confirmation', async () => {
    const user = userEvent.setup()
    const data = createAppData()
    const onTaskEdit = vi.fn()
    const task = data.getSnapshot().tasks[0]!

    const view = render(
      <OverviewConsole
        data={data}
        state={data.getSnapshot()}
        onTaskToggle={data.toggleTask}
        onTaskEdit={onTaskEdit}
        onTaskDelete={data.deleteTask}
      />,
    )

    await user.click(screen.getByRole('button', { name: `编辑${task.title}` }))
    expect(onTaskEdit).toHaveBeenCalledWith(task)

    await user.click(screen.getByRole('button', { name: `删除${task.title}` }))
    expect(screen.getByRole('alertdialog', { name: '删除任务' })).toBeInTheDocument()
    expect(data.getSnapshot().tasks).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(data.getSnapshot().tasks).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: `删除${task.title}` }))
    await user.click(screen.getByRole('button', { name: '确认删除' }))

    view.rerender(
      <OverviewConsole
        data={data}
        state={data.getSnapshot()}
        onTaskToggle={data.toggleTask}
        onTaskEdit={onTaskEdit}
        onTaskDelete={data.deleteTask}
      />,
    )
    expect(data.getSnapshot().tasks).toHaveLength(2)
    expect(screen.queryByText(task.title)).not.toBeInTheDocument()
  })
})
