import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { createLocalPersonalOSData } from './data/localPersonalOSData'
import { createMemoryStorage } from './test/memoryStorage'

describe('workbench quick capture', () => {
  it('records a project and updates its status', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '工作台' }))
    await user.type(screen.getByLabelText('项目名称'), 'CLI 同步工具')
    await user.type(screen.getByLabelText('项目目标'), '让本地记录自动同步')
    await user.selectOptions(screen.getByLabelText('项目状态'), 'active')
    await user.type(screen.getByLabelText('下一步动作'), '设计同步协议')
    fireEvent.change(screen.getByLabelText('截止日期'), {
      target: { value: '2026-09-18' },
    })
    await user.click(screen.getByRole('button', { name: '保存项目' }))

    expect(screen.getByRole('list', { name: '项目列表' })).toHaveTextContent(
      'CLI 同步工具',
    )
    expect(data.getSnapshot().projects[0]).toMatchObject({
      name: 'CLI 同步工具',
      goal: '让本地记录自动同步',
      status: 'active',
      nextAction: '设计同步协议',
      dueDate: '2026-09-18',
    })

    await user.selectOptions(
      screen.getByLabelText('CLI 同步工具 项目状态'),
      'blocked',
    )

    expect(data.getSnapshot().projects[0].status).toBe('blocked')
  })
})
