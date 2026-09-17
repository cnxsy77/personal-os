import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { createLocalPersonalOSData } from './data/localPersonalOSData'
import { createMemoryStorage } from './test/memoryStorage'

function toDateKey(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

describe('finance quick capture', () => {
  it('records an expense and updates the dashboard summary', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    const today = toDateKey(new Date())
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '记账' }))
    await user.click(screen.getByRole('button', { name: '添加记录' }))
    await user.type(screen.getByLabelText('金额'), '12.5')
    await user.selectOptions(screen.getByLabelText('分类'), '交通')
    await user.type(screen.getByLabelText('备注'), '地铁通勤')
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

    const records = screen.getByRole('list', {
      name: `${today.replaceAll('-', '.')} 收支流水`,
    })
    expect(records).toHaveTextContent('交通')
    expect(records).toHaveTextContent('-¥12.50')
    expect(records).toHaveTextContent('地铁通勤')

    await user.click(screen.getByRole('button', { name: '概览' }))
    expect(screen.getByText('¥951.50')).toBeInTheDocument()
    expect(screen.getByLabelText('记账进度')).toHaveTextContent('5% 已使用')

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

    await user.click(screen.getByRole('button', { name: '记账' }))
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

    await user.click(screen.getByRole('button', { name: '记账' }))
    await user.click(screen.getByRole('button', { name: '添加记录' }))
    fireEvent.submit(screen.getByLabelText('金额').closest('form') as HTMLFormElement)

    expect(
      screen.getByRole('dialog', { name: '添加记账记录' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('请输入大于 0 的金额')
    expect(data.getSnapshot().transactions).toHaveLength(1)
  })

  it('edits and deletes a transaction with confirmation', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '记账' }))
    await user.click(screen.getByRole('button', { name: '编辑 餐饮' }))
    expect(
      screen.getByRole('dialog', { name: '编辑记账记录' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('金额')).toHaveValue(36)

    await user.clear(screen.getByLabelText('金额'))
    await user.type(screen.getByLabelText('金额'), '40')
    await user.click(screen.getByRole('button', { name: '更新记录' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('支出已更新')).toBeInTheDocument()
    expect(data.getSnapshot().transactions[0].amountCents).toBe(4000)

    await user.click(screen.getByRole('button', { name: '删除 餐饮' }))
    expect(
      screen.getByRole('alertdialog', { name: '删除记账记录' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(data.getSnapshot().transactions).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: '删除 餐饮' }))
    await user.click(screen.getByRole('button', { name: '确认删除' }))
    expect(data.getSnapshot().transactions).toHaveLength(0)
    expect(screen.getByText('记账记录已删除')).toBeInTheDocument()
  })

  it('links payment stages to one order and shows its progress', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '记账' }))
    await user.click(screen.getByRole('button', { name: '添加记录' }))
    await user.type(screen.getByLabelText('金额'), '1000')
    await user.selectOptions(screen.getByLabelText('分类'), '购物')
    await user.selectOptions(screen.getByLabelText('订单关联'), 'new')
    await user.type(screen.getByLabelText('订单名称'), '相机')
    await user.type(screen.getByLabelText('订单总额'), '3000')
    await user.selectOptions(screen.getByLabelText('支付阶段'), 'full')
    await user.click(screen.getByRole('button', { name: '记录' }))

    expect(screen.getByText('支出已记录')).toBeInTheDocument()
    let orderProgress = screen.getByRole('list', { name: '订单进度' })
    expect(orderProgress).toHaveTextContent('相机')
    expect(orderProgress).toHaveTextContent('¥1000 / ¥3000')
    expect(screen.getByText('全款')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '添加记录' }))
    await user.type(screen.getByLabelText('金额'), '2000')
    await user.selectOptions(screen.getByLabelText('分类'), '购物')
    await user.selectOptions(screen.getByLabelText('订单关联'), 'existing')
    await user.selectOptions(screen.getByLabelText('支付阶段'), 'final')
    await user.click(screen.getByRole('button', { name: '记录' }))

    orderProgress = screen.getByRole('list', { name: '订单进度' })
    expect(orderProgress).toHaveTextContent('¥3000 / ¥3000')
    expect(orderProgress).toHaveTextContent('未付 ¥0 · 100%')
    expect(screen.getByText('尾款')).toBeInTheDocument()

    const snapshot = data.getSnapshot()
    expect(snapshot.paymentOrders).toHaveLength(1)
    expect(snapshot.transactions.filter((item) => item.orderId)).toHaveLength(2)
  })

  it('keeps transfers out of income while refunds reduce expenses', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    const expense = {
      kind: 'expense' as const,
      amountCents: 8000,
      category: '购物',
      date: toDateKey(new Date()),
      note: '运动鞋',
      counterparty: '运动品牌店',
    }
    data.recordTransaction(expense)
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '记账' }))
    await user.click(screen.getByRole('button', { name: '添加记录' }))
    await user.click(screen.getByRole('button', { name: '转账' }))
    await user.type(screen.getByLabelText('金额'), '50')
    await user.click(screen.getByRole('button', { name: '记录' }))

    expect(screen.getByText('转账已记录')).toBeInTheDocument()
    expect(screen.getByLabelText('记账摘要')).toHaveTextContent('本月支出')
    expect(screen.getByLabelText('记账摘要')).toHaveTextContent('¥116')
    expect(screen.getByLabelText('记账摘要')).toHaveTextContent('转账')
    expect(screen.getByLabelText('记账摘要')).toHaveTextContent('¥50')

    await user.click(screen.getByRole('button', { name: '添加记录' }))
    await user.click(screen.getByRole('button', { name: '收入' }))
    await user.type(screen.getByLabelText('金额'), '30')
    await user.selectOptions(screen.getByLabelText('记录类型'), 'refund')
    await user.selectOptions(
      screen.getByLabelText('关联原支出'),
      data.getSnapshot().transactions.find((item) => item.kind === 'expense')!
        .id,
    )
    await user.click(screen.getByRole('button', { name: '记录' }))

    expect(screen.getByText('收入已记录')).toBeInTheDocument()
    expect(screen.getByLabelText('记账摘要')).toHaveTextContent('¥50')
    expect(screen.getByLabelText('记账摘要')).toHaveTextContent('¥30')
    expect(screen.getByLabelText('记账摘要')).toHaveTextContent('¥86')

    const snapshot = data.getSnapshot()
    expect(snapshot.transactions).toHaveLength(4)
    expect(snapshot.transactions.find((item) => item.tag === 'refund')).toMatchObject({
      amountCents: 3000,
      relatedTransactionId: expect.any(String),
    })
  })

  it('imports alipay bills with preview, duplicate skip and undo', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    data.recordTransaction({
      kind: 'expense',
      amountCents: 1850,
      category: '餐饮',
      date: '2026-09-10',
      source: 'alipay',
      sourceTradeNo: 'ALI-DUP',
      counterparty: '咖啡店',
    })
    render(<App data={data} />)

    const csv = [
      '交易时间,交易分类,交易对方,商品说明,收/支,金额,交易状态,交易订单号,备注',
      '2026-09-10 12:30:00,餐饮美食,咖啡店,拿铁,支出,¥18.50,交易成功,ALI-DUP,重复账单',
      '2026-09-11 15:20:00,数码,电器商店,机械键盘,支出,¥399.00,交易成功,ALI-NEW,主力键盘',
    ].join('\n')
    const file = new File([csv], 'alipay.csv', { type: 'text/csv' })

    await user.click(screen.getByRole('button', { name: '记账' }))
    await user.click(screen.getByRole('button', { name: '添加记录' }))
    await user.click(screen.getByRole('tab', { name: '导入' }))
    await user.upload(screen.getByLabelText('选择账单文件'), file)

    expect(await screen.findByText('支付宝 · 2 行')).toBeInTheDocument()
    expect(screen.getByText('可导入 1 笔，重复 1 笔')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认导入 1 笔' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: '确认导入 1 笔' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('已导入 1 笔账单')).toBeInTheDocument()
    const importedGroup = screen.getByRole('list', { name: '2026.09.11 收支流水' })
    expect(importedGroup).toHaveTextContent('电器商店')
    expect(importedGroup).toHaveTextContent('主力键盘')
    expect(screen.getByLabelText('账单导入历史')).toHaveTextContent('alipay.csv')

    await user.click(screen.getByRole('button', { name: '撤销alipay.csv' }))
    expect(screen.queryByRole('list', { name: '2026.09.11 收支流水' })).not.toBeInTheDocument()
    expect(screen.getByText('暂无导入批次')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: '2026.09.10 收支流水' })).toHaveTextContent('咖啡店')
    expect(data.getSnapshot().billImports).toHaveLength(0)
  })

  it('records, advances and disables a recurring transaction', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '记账' }))
    await user.click(screen.getByRole('button', { name: '添加记录' }))
    await user.click(screen.getByRole('tab', { name: '周期' }))
    await user.type(screen.getByLabelText('名称'), '视频会员')
    await user.type(screen.getByLabelText('金额'), '25')
    fireEvent.change(screen.getByLabelText('下次日期'), {
      target: { value: '2026-10-01' },
    })
    await user.click(screen.getByRole('button', { name: '保存周期' }))

    expect(screen.getByText('周期记录已保存')).toBeInTheDocument()
    expect(screen.getByLabelText('周期记录列表')).toHaveTextContent('视频会员')
    expect(screen.getByLabelText('周期记录列表')).toHaveTextContent('2026.10.01')

    await user.click(screen.getByRole('button', { name: '记一笔' }))
    const recordGroup = screen.getByRole('list', { name: '2026.10.01 收支流水' })
    expect(recordGroup).toHaveTextContent('视频会员')
    expect(data.getSnapshot().recurringTransactions[0]).toMatchObject({
      nextDate: '2026-11-01',
      active: true,
    })

    await user.click(screen.getByRole('button', { name: '停用视频会员' }))
    expect(screen.getByRole('button', { name: '记一笔' })).toBeDisabled()
    expect(data.getSnapshot().recurringTransactions[0]).toMatchObject({ active: false })
  })
})
