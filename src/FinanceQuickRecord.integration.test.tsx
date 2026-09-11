import { fireEvent, render, screen } from '@testing-library/react'
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
    await user.click(screen.getByRole('button', { name: '添加记录' }))
    await user.type(screen.getByLabelText('金额'), '12.5')
    await user.selectOptions(screen.getByLabelText('分类'), '交通')
    await user.click(screen.getByRole('button', { name: '记录' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('支出已记录')).toBeInTheDocument()
    expect(screen.getAllByText('¥48.50').length).toBeGreaterThan(0)
    expect(screen.getByText('本月支出')).toBeInTheDocument()
    expect(screen.getByText('本月收入')).toBeInTheDocument()

    const categories = screen.getByRole('list', { name: '本月分类统计' })
    expect(categories).toHaveTextContent('交通')
    expect(categories).toHaveTextContent('¥12.50')
    expect(categories).toHaveTextContent('餐饮')
    expect(categories).toHaveTextContent('¥36')

    const records = screen.getByRole('list', { name: '最近收支' })
    expect(records).toHaveTextContent('交通')
    expect(records).toHaveTextContent('-¥12.50')

    await user.click(screen.getByRole('button', { name: '概览' }))
    expect(screen.getByText('¥951.50')).toBeInTheDocument()
    expect(screen.getByLabelText('财务进度')).toHaveTextContent('5% 已使用')

    const snapshot = data.getSnapshot()
    const expenseTotal = snapshot.transactions
      .filter((item) => item.kind === 'expense')
      .reduce((total, item) => total + item.amountCents, 0)

    expect(snapshot.monthlyBudgetCents - expenseTotal).toBe(95150)
  })

  it('updates the monthly budget from the dialog', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '财务' }))
    await user.click(screen.getByRole('button', { name: '添加记录' }))
    await user.click(screen.getByRole('tab', { name: '预算' }))
    await user.clear(screen.getByLabelText('设置预算'))
    await user.type(screen.getByLabelText('设置预算'), '200')
    await user.click(screen.getByRole('button', { name: '更新' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('预算已更新')).toBeInTheDocument()
    expect(screen.getByText('¥164')).toBeInTheDocument()
    expect(screen.getByText('18%')).toBeInTheDocument()
  })

  it('keeps the dialog open when the transaction amount is invalid', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '财务' }))
    await user.click(screen.getByRole('button', { name: '添加记录' }))
    fireEvent.submit(screen.getByLabelText('金额').closest('form') as HTMLFormElement)

    expect(
      screen.getByRole('dialog', { name: '添加财务记录' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('请输入大于 0 的金额')
    expect(data.getSnapshot().transactions).toHaveLength(1)
  })
})
