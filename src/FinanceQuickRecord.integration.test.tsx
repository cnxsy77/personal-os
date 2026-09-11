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

    expect(screen.getAllByText('¥48.50').length).toBeGreaterThan(0)
    expect(screen.getByText('本月支出')).toBeInTheDocument()
    expect(screen.getByText('本月收入')).toBeInTheDocument()

    const categories = screen.getByRole('list', { name: '本月分类统计' })
    expect(categories).toHaveTextContent('交通')
    expect(categories).toHaveTextContent('¥12.50')
    expect(categories).toHaveTextContent('餐饮')
    expect(categories).toHaveTextContent('¥36')

    await user.clear(screen.getByLabelText('设置预算'))
    await user.type(screen.getByLabelText('设置预算'), '200')
    await user.click(screen.getByRole('button', { name: '更新' }))

    expect(screen.getByText('¥151.50')).toBeInTheDocument()
    expect(screen.getByText('24%')).toBeInTheDocument()
    const records = screen.getByRole('list', { name: '最近收支' })
    expect(records).toHaveTextContent('交通')
    expect(records).toHaveTextContent('-¥12.50')
    expect(screen.getByText('本月记录')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '概览' }))
    expect(screen.getByText('¥48.50')).toBeInTheDocument()
    expect(screen.getByText(/预算剩余 ¥151\.50/)).toBeInTheDocument()
  })
})
