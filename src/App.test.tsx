import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { createLocalPersonalOSData } from './data/localPersonalOSData'
import { createMemoryStorage } from './test/memoryStorage'

describe('Personal OS dashboard', () => {
  it('updates the focus counter when a task is completed', async () => {
    const user = userEvent.setup()
    render(
      <App data={createLocalPersonalOSData({ storage: createMemoryStorage() })} />,
    )

    const firstTask = '完成 Personal OS 仪表盘 MVP'
    await user.click(screen.getByRole('button', { name: `完成 ${firstTask}` }))

    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  it('creates a task from quick capture', async () => {
    const user = userEvent.setup()
    render(
      <App data={createLocalPersonalOSData({ storage: createMemoryStorage() })} />,
    )

    await user.click(screen.getByRole('button', { name: /快速记录/ }))

    expect(
      screen.getByRole('dialog', { name: '选择记录领域' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '选择计划' }))
    await user.type(screen.getByLabelText('计划事项'), '同步个人记录')
    await user.click(screen.getByRole('button', { name: '保存计划' }))

    expect(
      screen.queryByRole('dialog', { name: '选择记录领域' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('计划已保存')).toBeInTheDocument()
    const table = screen.getByRole('table')

    expect(within(table).getByText('同步个人记录')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '已完成 0 / 4' })).toBeInTheDocument()
  })
})
