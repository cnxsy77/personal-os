import type {
  PaymentOrder,
  RecurringTransaction,
  Transaction,
  TransactionKind,
} from '../data/model'

export type TransactionFilters = {
  kind: TransactionKind | 'all'
  source: 'all' | 'manual' | 'alipay' | 'wechat'
  query: string
}

export type FinanceSummary = {
  todayExpenseCents: number
  monthExpenseCents: number
  monthIncomeCents: number
  monthRefundCents: number
  monthTransferCents: number
  monthCount: number
  budgetRemainingCents: number
  budgetUsedPercent: number
}

export type DateGroup = {
  date: string
  transactions: Transaction[]
}

export type OrderProgress = {
  order: PaymentOrder
  paidCents: number
  remainingCents: number
  percent: number
}

const sourceLabels: Record<string, string> = {
  manual: '手动',
  alipay: '支付宝',
  wechat: '微信',
}

const stageLabels: Record<string, string> = {
  deposit: '定金',
  final: '尾款',
  full: '全款',
}

const recurringFrequencyLabels: Record<string, string> = {
  weekly: '每周',
  monthly: '每月',
  yearly: '每年',
}

export function getTransactionTitle(transaction: Transaction) {
  return transaction.counterparty || transaction.category
}

export function getTransactionSourceLabel(transaction: Transaction) {
  return sourceLabels[transaction.source ?? 'manual'] ?? '手动'
}

export function getPaymentStageLabel(transaction: Transaction) {
  return transaction.stage ? stageLabels[transaction.stage] : undefined
}

export function getRecurringFrequencyLabel(frequency: RecurringTransaction['frequency']) {
  return recurringFrequencyLabels[frequency] ?? frequency
}

function isRefund(transaction: Transaction) {
  return transaction.tag === 'refund'
}

function isSameMonth(transaction: Transaction, monthPrefix: string) {
  return transaction.date.startsWith(monthPrefix)
}

export function summarizeFinance(
  transactions: Transaction[],
  monthlyBudgetCents: number,
  now = new Date(),
): FinanceSummary {
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const todayKey = toDateKey(now)
  const monthTransactions = transactions.filter((item) =>
    isSameMonth(item, monthPrefix),
  )
  const grossExpenseCents = sumAmount(
    monthTransactions.filter((item) => item.kind === 'expense'),
  )
  const refundCents = sumAmount(
    monthTransactions.filter((item) => item.kind === 'income' && isRefund(item)),
  )
  const expenseCents = Math.max(0, grossExpenseCents - refundCents)
  const incomeCents = sumAmount(
    monthTransactions.filter(
      (item) => item.kind === 'income' && !isRefund(item),
    ),
  )
  const transferCents = sumAmount(
    monthTransactions.filter((item) => item.kind === 'transfer'),
  )
  const todayExpenseCents = Math.max(
    0,
    sumAmount(
      transactions.filter(
        (item) =>
          item.date === todayKey &&
          item.kind === 'expense' &&
          !isRefund(item),
      ),
    ) -
      sumAmount(
        transactions.filter(
          (item) =>
            item.date === todayKey &&
            item.kind === 'income' &&
            isRefund(item),
        ),
      ),
  )

  return {
    todayExpenseCents,
    monthExpenseCents: expenseCents,
    monthIncomeCents: incomeCents,
    monthRefundCents: refundCents,
    monthTransferCents: transferCents,
    monthCount: monthTransactions.length,
    budgetRemainingCents: Math.max(0, monthlyBudgetCents - expenseCents),
    budgetUsedPercent: monthlyBudgetCents
      ? Math.min(100, Math.round((expenseCents / monthlyBudgetCents) * 100))
      : 0,
  }
}

export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters,
) {
  const query = filters.query.trim().toLowerCase()
  return transactions.filter((item) => {
    if (filters.kind !== 'all' && item.kind !== filters.kind) {
      return false
    }

    if (filters.source !== 'all' && (item.source ?? 'manual') !== filters.source) {
      return false
    }

    if (!query) {
      return true
    }

    return [
      item.category,
      item.counterparty,
      item.note,
      item.sourceTradeNo,
    ]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(query))
  })
}

export function groupTransactionsByDate(transactions: Transaction[]) {
  const groups = new Map<string, Transaction[]>()

  for (const transaction of transactions) {
    const group = groups.get(transaction.date) ?? []
    group.push(transaction)
    groups.set(transaction.date, group)
  }

  return [...groups.entries()]
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .map(([date, items]) => ({
      date,
      transactions: items.sort((itemA, itemB) =>
        getTransactionTimeValue(itemB).localeCompare(
          getTransactionTimeValue(itemA),
        ),
      ),
    }))
}

export function calculateOrderProgress(
  orders: PaymentOrder[],
  transactions: Transaction[],
): OrderProgress[] {
  return orders
    .map((order) => {
      const paidCents = sumAmount(
        transactions.filter(
          (item) => item.orderId === order.id && item.kind === 'expense',
        ),
      )

      return {
        order,
        paidCents,
        remainingCents: Math.max(0, order.expectedTotalCents - paidCents),
        percent: Math.min(
          100,
          Math.round((paidCents / order.expectedTotalCents) * 100),
        ),
      }
    })
    .sort((itemA, itemB) => itemB.order.createdAt.localeCompare(itemA.order.createdAt))
}

function sumAmount(transactions: Transaction[]) {
  return transactions.reduce((total, item) => total + item.amountCents, 0)
}

function getTransactionTimeValue(transaction: Transaction) {
  return transaction.occurredAt || transaction.date
}

function toDateKey(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}
