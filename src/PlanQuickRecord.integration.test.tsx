import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { createLocalPersonalOSData } from './data/localPersonalOSData'
import { createMemoryStorage } from './test/memoryStorage'

describe('plan quick capture', () => {
  it('records a planned task and completes it', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '计划' }))
    await user.click(screen.getByRole('button', { name: '添加计划' }))
    fireEvent.change(screen.getByLabelText('计划日期'), {
      target: { value: '2026-09-11' },
    })
    await user.type(screen.getByLabelText('计划事项'), '准备架构评审')
    await user.selectOptions(screen.getByLabelText('计划分类'), 'work')
    await user.type(screen.getByLabelText('计划时间'), '09:30')
    await user.click(screen.getByRole('button', { name: '保存计划' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('计划已保存')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: '计划任务' })).toHaveTextContent(
      '准备架构评审',
    )
    expect(data.getSnapshot().tasks.at(-1)).toMatchObject({
      title: '准备架构评审',
      date: '2026-09-11',
      category: 'work',
      time: '09:30',
    })

    await user.click(screen.getByRole('button', { name: '完成 准备架构评审' }))

    expect(
      screen.getByRole('button', { name: '完成 准备架构评审' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps the dialog open when required input is missing', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '计划' }))
    await user.click(screen.getByRole('button', { name: '添加计划' }))
    await user.click(screen.getByRole('button', { name: '保存计划' }))

    expect(screen.getByRole('dialog', { name: '添加计划' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('请输入计划事项')
    expect(data.getSnapshot().tasks).toHaveLength(3)
  })
})
