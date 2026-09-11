import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { createLocalPersonalOSData } from './data/localPersonalOSData'
import { createMemoryStorage } from './test/memoryStorage'

describe('learning quick capture', () => {
  it('records a study log and updates the dashboard summary', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '学习' }))
    await user.click(screen.getByRole('button', { name: '添加学习记录' }))
    await user.type(screen.getByLabelText('学习主题'), 'React 渲染模型')
    await user.type(screen.getByLabelText('时长'), '45')
    await user.click(screen.getByRole('button', { name: '记录' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('学习记录已保存')).toBeInTheDocument()
    expect(screen.getAllByText('1 小时 30 分').length).toBeGreaterThan(0)
    const records = screen.getByRole('list', { name: '学习记录' })
    expect(records).toHaveTextContent('React 渲染模型')

    await user.click(screen.getByRole('button', { name: '概览' }))
    expect(screen.getByText('1 小时 30 分')).toBeInTheDocument()
  })

  it('creates a learning path and tracks study progress', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '学习' }))
    await user.click(screen.getByRole('button', { name: '添加学习记录' }))
    await user.click(screen.getByRole('tab', { name: '学习路径' }))
    await user.type(screen.getByLabelText('新路径名称'), 'TypeScript 工程化')
    await user.type(screen.getByLabelText('目标时长'), '600')
    await user.click(screen.getByRole('button', { name: '创建路径' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('学习路径已创建')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '添加学习记录' }))

    const pathSelect = screen.getByLabelText('学习路径')
    await user.selectOptions(
      pathSelect,
      within(pathSelect).getByRole('option', { name: 'TypeScript 工程化' }),
    )
    await user.type(screen.getByLabelText('学习主题'), '类型体操')
    await user.type(screen.getByLabelText('时长'), '30')
    await user.click(screen.getByRole('button', { name: '记录' }))

    expect(screen.getByText('30 / 600 分钟')).toBeInTheDocument()
    expect(data.getSnapshot().studyLogs[0]).toMatchObject({
      topic: '类型体操',
      pathId: data.getSnapshot().learningPaths[0].id,
    })
  })

  it('adds a learning resource and changes its status', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '学习' }))
    await user.click(screen.getByRole('button', { name: '添加学习记录' }))
    await user.click(screen.getByRole('tab', { name: '学习资料' }))
    await user.type(screen.getByLabelText('资料名称'), 'React 官方课程')
    await user.selectOptions(screen.getByLabelText('资料类型'), 'course')
    await user.click(screen.getByRole('button', { name: '添加资料' }))

    const statusSelect = screen.getByLabelText('React 官方课程 状态')
    expect(statusSelect).toHaveValue('todo')

    await user.selectOptions(statusSelect, 'doing')

    expect(data.getSnapshot().learningResources[0]).toMatchObject({
      title: 'React 官方课程',
      status: 'doing',
    })
  })

  it('saves a weekly review and replaces the same week on resave', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '学习' }))
    await user.click(screen.getByRole('button', { name: '添加学习记录' }))
    await user.click(screen.getByRole('tab', { name: '周复盘' }))
    await user.type(screen.getByLabelText('本周收获'), '完成学习路径设计')
    await user.type(screen.getByLabelText('本周阻碍'), '晚上时间不足')
    await user.type(screen.getByLabelText('下周重点'), '补齐项目测试')
    await user.click(screen.getByRole('button', { name: '保存复盘' }))

    const reviews = screen.getByRole('list', { name: '周复盘记录' })
    expect(reviews).toHaveTextContent('完成学习路径设计')

    fireEvent.click(screen.getByRole('button', { name: '添加学习记录' }))
    await screen.findByRole('dialog', { name: '添加学习记录' })
    await user.click(screen.getByRole('tab', { name: '周复盘' }))

    await user.clear(screen.getByLabelText('本周收获'))
    await user.type(screen.getByLabelText('本周收获'), '完成学习路径和复盘')
    await user.clear(screen.getByLabelText('本周阻碍'))
    await user.type(screen.getByLabelText('本周阻碍'), '晚上时间仍然不足')
    await user.clear(screen.getByLabelText('下周重点'))
    await user.type(screen.getByLabelText('下周重点'), '完成学习计划联调')
    await user.click(screen.getByRole('button', { name: '保存复盘' }))

    expect(data.getSnapshot().weeklyReviews).toHaveLength(1)
    expect(data.getSnapshot().weeklyReviews[0].wins).toBe('完成学习路径和复盘')
  })

  it('keeps the dialog open when the study log is invalid', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '学习' }))
    await user.click(screen.getByRole('button', { name: '添加学习记录' }))
    await user.click(screen.getByRole('button', { name: '记录' }))

    expect(screen.getByRole('dialog', { name: '添加学习记录' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('请填写学习主题')
    expect(data.getSnapshot().studyLogs).toHaveLength(1)
  })
})
