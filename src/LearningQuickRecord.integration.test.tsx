import { render, screen } from '@testing-library/react'
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
    await user.type(screen.getByLabelText('学习主题'), 'React 渲染模型')
    await user.type(screen.getByLabelText('时长'), '45')
    await user.click(screen.getByRole('button', { name: '记录' }))

    expect(screen.getAllByText('1 小时 30 分').length).toBeGreaterThan(0)
    const records = screen.getByRole('list', { name: '学习记录' })
    expect(records).toHaveTextContent('React 渲染模型')

    await user.click(screen.getByRole('button', { name: '概览' }))
    expect(screen.getByText('1 小时 30 分')).toBeInTheDocument()
  })
})
