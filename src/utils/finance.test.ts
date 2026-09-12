import { describe, expect, it } from 'vitest'
import type { PaymentOrder, Transaction } from '../data/model'
import {
  calculateOrderProgress,
  groupTransactionsByDate,
  summarizeFinance,
} from './finance'

describe('finance views', () => {
  const transactions: Transaction[] = [
    {
      id: 'expense',
      kind: 'expense',
      amountCents: 10000,
      category: '购物',
      date: '2026-09-10',
      counterparty: '家用百货',
      source: 'wechat',
      sourceTradeNo: 'WX-1',
    },
    {
      id: 'refund',
      kind: 'income',
      amountCents: 2000,
      category: '购物',
      date: '2026-09-10',
      tag: 'refund',
      source: 'wechat',
    },
    {
      id: 'income',
      kind: 'income',
      amountCents: 3000,
      category: '工资',
      date: '2026-09-10',
    },
    {
      id: 'transfer',
      kind: 'transfer',
      amountCents: 500,
      category: '转账',
      date: '2026-09-09',
    },
  ]

  it('nets refunds out of expenses and excludes transfers from income', () => {
    const summary = summarizeFinance(transactions, 100000, new Date('2026-09-12T12:00:00'))

    expect(summary).toMatchObject({
      monthExpenseCents: 8000,
      monthIncomeCents: 3000,
      monthRefundCents: 2000,
      monthTransferCents: 500,
      monthCount: 4,
      budgetRemainingCents: 92000,
      budgetUsedPercent: 8,
    })
  })

  it('groups transactions by date from newest to oldest', () => {
    const groups = groupTransactionsByDate(transactions)

    expect(groups.map((group) => group.date)).toEqual([
      '2026-09-10',
      '2026-09-09',
    ])
    expect(groups[0]?.transactions.map((item) => item.id)).toEqual([
      'expense',
      'refund',
      'income',
    ])
  })

  it('calculates order payment progress', () => {
    const order: PaymentOrder = {
      id: 'camera',
      name: '微单相机',
      expectedTotalCents: 30000,
      createdAt: '2026-09-01',
    }

    expect(
      calculateOrderProgress([order], [
        {
          id: 'deposit',
          kind: 'expense',
          amountCents: 12000,
          category: '数码',
          date: '2026-09-01',
          orderId: 'camera',
        },
      ]),
    ).toMatchObject([
      {
        paidCents: 12000,
        remainingCents: 18000,
        percent: 40,
      },
    ])
  })
})
