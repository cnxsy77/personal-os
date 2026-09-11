import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('Personal OS dashboard', () => {
  it('updates the focus counter when a task is completed', async () => {
    const user = userEvent.setup()
    render(<App />)

    const firstTask = '完成 Personal OS 仪表盘 MVP'
    await user.click(screen.getByRole('button', { name: `完成 ${firstTask}` }))

    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  it('creates a task from quick capture', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /快速记录/ }))

    expect(screen.getByText('新建待办事项')).toBeInTheDocument()
    expect(screen.getByText('0/4')).toBeInTheDocument()
  })
})
