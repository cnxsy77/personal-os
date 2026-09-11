import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { createLocalPersonalOSData } from './data/localPersonalOSData'
import { createMemoryStorage } from './test/memoryStorage'

describe('finance quick capture', () => {
  it('records an expense and updates the dashboard summary', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '财务' }))
    await user.type(screen.getByLabelText('金额'), '12.5')
    await user.selectOptions(screen.getByLabelText('分类'), '交通')
    await user.click(screen.getByRole('button', { name: '记录' }))

    expect(screen.getByText('¥48.50')).toBeInTheDocument()
    const records = screen.getByRole('list')
    expect(records).toHaveTextContent('交通')
    expect(records).toHaveTextContent('-¥12.50')
    expect(screen.getByText('本月记录')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '概览' }))
    expect(screen.getByText('¥48.50')).toBeInTheDocument()
  })
})
