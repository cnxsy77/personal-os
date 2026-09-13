import { useState, type FormEvent } from 'react'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Ban,
  Check,
  Plus,
  RefreshCw,
  Repeat,
  Wallet,
} from 'lucide-react'
import { RecordDialog } from '../components/RecordDialog'
import type {
  BillImportInput,
  BillImportResult,
  PersonalOSState,
  RecurringTransactionInput,
  Transaction,
  TransactionInput,
  TransactionKind,
} from '../data/model'
import {
  calculateOrderProgress,
  filterTransactions,
  getPaymentStageLabel,
  getRecurringFrequencyLabel,
  getTransactionSourceLabel,
  getTransactionTitle,
  groupTransactionsByDate,
  summarizeFinance,
} from '../utils/finance'
import { FinanceImportForm } from './FinanceImportForm'
import { FinanceRecurringForm } from './FinanceRecurringForm'
import { FinanceTransactionForm } from './FinanceTransactionForm'
import './FinanceQuickRecord.css'

type Props = {
  monthlyBudgetCents: number
  transactions: Transaction[]
  paymentOrders: PersonalOSState['paymentOrders']
  recurringTransactions: PersonalOSState['recurringTransactions']
  billImports: PersonalOSState['billImports']
  dialogOpen: boolean
  dialogTab?: string
  dialogOnly?: boolean
  onDialogOpen: (tab?: string) => void
  onDialogClose: () => void
  onSaved: (message: string) => void
  onSubmit: (input: TransactionInput) => void
  onBudgetSubmit: (monthlyBudgetCents: number) => void
  onRecurringSubmit: (input: RecurringTransactionInput) => void
  onRecurringStatusChange: (id: string, active: boolean) => void
  onRecurringRecord: (id: string) => void
  onImportSubmit: (input: BillImportInput) => BillImportResult
  onImportUndo: (importId: string) => void
  expenseCategories: string[]
  incomeCategories: string[]
}

const tagLabels: Record<string, string> = {
  subscription: '订阅',
  refund: '退款',
}

export function FinanceQuickRecord({
  monthlyBudgetCents,
  transactions,
  paymentOrders,
  recurringTransactions,
  billImports,
  dialogOpen,
  dialogTab = 'transaction',
  dialogOnly = false,
  onDialogOpen,
  onDialogClose,
  onSaved,
  onSubmit,
  onBudgetSubmit,
  onRecurringSubmit,
  onRecurringStatusChange,
  onRecurringRecord,
  onImportSubmit,
  onImportUndo,
  expenseCategories,
  incomeCategories,
}: Props) {
  const now = new Date()
  const [kindFilter, setKindFilter] = useState<TransactionKind | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState<
    'all' | 'manual' | 'alipay' | 'wechat'
  >('all')
  const [search, setSearch] = useState('')
  const [budgetDraft, setBudgetDraft] = useState(
    String(monthlyBudgetCents / 100),
  )
  const [budgetError, setBudgetError] = useState('')

  const summary = summarizeFinance(transactions, monthlyBudgetCents, now)
  const visibleTransactions = filterTransactions(transactions, {
    kind: kindFilter,
    source: sourceFilter,
    query: search,
  })
  const dateGroups = groupTransactionsByDate(visibleTransactions)
  const orderProgress = calculateOrderProgress(paymentOrders, transactions)
  const categoryTotals = getCategoryTotals(transactions, now)
  const sortedCategoryTotals = Object.entries(categoryTotals).sort(
    ([, amountA], [, amountB]) => amountB - amountA,
  )

  function openDialog(tab = dialogTab) {
    setBudgetError('')
    onDialogOpen(tab)
  }

  function closeDialog() {
    setBudgetError('')
    onDialogClose()
  }

  function submitBudget(event: FormEvent) {
    event.preventDefault()
    const cents = Math.round(Number(budgetDraft) * 100)

    if (!Number.isInteger(cents) || cents <= 0) {
      setBudgetError('请输入大于 0 的月度预算')
      return
    }

    onBudgetSubmit(cents)
    setBudgetDraft(String(cents / 100))
    setBudgetError('')
    closeDialog()
    onSaved('预算已更新')
  }

  function handleTransactionSubmit(input: TransactionInput) {
    onSubmit(input)
    closeDialog()
    onSaved(
      input.kind === 'expense'
        ? '支出已记录'
        : input.kind === 'income'
          ? '收入已记录'
          : '转账已记录',
    )
  }

  function handleRecurringSubmit(input: RecurringTransactionInput) {
    onRecurringSubmit(input)
    closeDialog()
    onSaved('周期记录已保存')
  }

  function handleImportSubmit(input: BillImportInput) {
    const result = onImportSubmit(input)
    if (result.importedCount > 0) {
      closeDialog()
      onSaved(`已导入 ${result.importedCount} 笔账单`)
    }

    return result
  }

  const financeDialog = (
    <RecordDialog
      activeTab={dialogTab}
      description="记录收支、导入账单、管理周期记录或调整预算。"
      onClose={closeDialog}
      onTabChange={openDialog}
      open={dialogOpen}
      tabs={[
        { id: 'transaction', label: '收支' },
        { id: 'import', label: '导入' },
        { id: 'recurring', label: '周期' },
        { id: 'budget', label: '预算' },
      ]}
      title="添加记账记录"
    >
      {dialogTab === 'transaction' ? (
        <FinanceTransactionForm
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          onSubmit={handleTransactionSubmit}
          orders={paymentOrders}
          transactions={transactions}
        />
      ) : dialogTab === 'import' ? (
        <FinanceImportForm
          onSubmit={handleImportSubmit}
          transactions={transactions}
        />
      ) : dialogTab === 'recurring' ? (
        <FinanceRecurringForm
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          onSubmit={handleRecurringSubmit}
        />
      ) : (
        <form className="budget-form dialog-form" onSubmit={submitBudget}>
          <div>
            <label htmlFor="finance-budget">设置预算</label>
            <input
              id="finance-budget"
              inputMode="decimal"
              min="0.01"
              onChange={(event) => setBudgetDraft(event.target.value)}
              step="0.01"
              type="number"
              value={budgetDraft}
            />
          </div>
          <button type="submit">更新</button>
          {budgetError ? <p role="alert">{budgetError}</p> : null}
        </form>
      )}
    </RecordDialog>
  )

  if (dialogOnly) {
    return financeDialog
  }

  return (
    <div className="finance-page">
      <section aria-labelledby="finance-title" className="finance-panel">
        <div className="panel-heading">
          <h2 id="finance-title">收支流水</h2>
          <button
            className="page-add"
            onClick={() => openDialog('transaction')}
            type="button"
          >
            <Plus size={16} />
            添加记录
          </button>
        </div>

        <div aria-label="记账摘要" className="finance-summary">
          <div>
            <label>今日支出</label>
            <strong>{formatCents(summary.todayExpenseCents)}</strong>
          </div>
          <div>
            <label>本月支出</label>
            <strong>{formatCents(summary.monthExpenseCents)}</strong>
          </div>
          <div>
            <label>本月收入</label>
            <strong>{formatCents(summary.monthIncomeCents)}</strong>
          </div>
          <div>
            <label>退款</label>
            <strong>{formatCents(summary.monthRefundCents)}</strong>
          </div>
          <div>
            <label>转账</label>
            <strong>{formatCents(summary.monthTransferCents)}</strong>
          </div>
        </div>

        <div aria-label="流水筛选" className="finance-filters">
          <select
            aria-label="记录类型筛选"
            onChange={(event) =>
              setKindFilter(event.target.value as TransactionKind | 'all')
            }
            value={kindFilter}
          >
            <option value="all">全部类型</option>
            <option value="expense">支出</option>
            <option value="income">收入</option>
            <option value="transfer">转账</option>
          </select>
          <select
            aria-label="来源筛选"
            onChange={(event) =>
              setSourceFilter(event.target.value as typeof sourceFilter)
            }
            value={sourceFilter}
          >
            <option value="all">全部来源</option>
            <option value="manual">手动</option>
            <option value="alipay">支付宝</option>
            <option value="wechat">微信</option>
          </select>
          <input
            aria-label="搜索流水"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索分类、备注、商户或单号"
            type="search"
            value={search}
          />
        </div>

        <div aria-live="polite" className="transaction-groups">
          {dateGroups.length === 0 ? (
            <p className="empty-transactions">没有符合条件的流水</p>
          ) : (
            dateGroups.map((group) => (
              <section className="transaction-date-group" key={group.date}>
                <h3>{formatDate(group.date)}</h3>
                <ul aria-label={`${formatDate(group.date)} 收支流水`}>
                  {group.transactions.map((item) => (
                    <li key={item.id}>
                      <i className={item.kind}>
                        {item.kind === 'expense' ? (
                          <ArrowDownCircle size={17} />
                        ) : item.kind === 'income' ? (
                          <ArrowUpCircle size={17} />
                        ) : (
                          <Repeat size={17} />
                        )}
                      </i>
                      <div>
                        <h4>{getTransactionTitle(item)}</h4>
                        <p>
                          <span>{item.category}</span>
                          <span>{getTransactionSourceLabel(item)}</span>
                          {item.note ? <span>{item.note}</span> : null}
                          {getPaymentStageLabel(item) ? (
                            <span>{getPaymentStageLabel(item)}</span>
                          ) : null}
                          {item.tag ? <span>{tagLabels[item.tag]}</span> : null}
                        </p>
                      </div>
                      <b className={item.kind}>
                        {item.kind === 'expense'
                          ? '-'
                          : item.kind === 'income'
                            ? '+'
                            : ''}
                        {formatCents(item.amountCents)}
                      </b>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </section>

      <aside aria-labelledby="budget-title" className="finance-side">
        <section aria-labelledby="budget-title" className="finance-panel">
          <h2 id="budget-title">月度预算</h2>
          <div className="budget-status">
            <div>
              <label>剩余预算</label>
              <strong>{formatCents(summary.budgetRemainingCents)}</strong>
            </div>
            <div>
              <label>已使用</label>
              <strong>{summary.budgetUsedPercent}%</strong>
            </div>
          </div>
          <progress
            aria-label="预算使用进度"
            max={100}
            value={summary.budgetUsedPercent}
          />
          <p>
            <Wallet size={15} />
            退款会冲减支出，转账不计入预算。
          </p>
        </section>

        <section aria-labelledby="category-title" className="finance-panel">
          <h3 id="category-title">本月分类</h3>
          <ul aria-label="本月分类统计">
            {sortedCategoryTotals.map(([name, amountCents]) => (
              <li key={name}>
                <span>{name}</span>
                <b>{formatCents(amountCents)}</b>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="order-progress-title" className="finance-panel">
          <h3 id="order-progress-title">订单进度</h3>
          {orderProgress.length === 0 ? (
            <p className="side-empty">暂无订单</p>
          ) : (
            <ul aria-label="订单进度">
              {orderProgress.map(({ order, paidCents, remainingCents, percent }) => (
                <li key={order.id} className="order-progress">
                  <div>
                    <strong>{order.name}</strong>
                    <span>
                      {formatCents(paidCents)} / {formatCents(order.expectedTotalCents)}
                    </span>
                  </div>
                  <progress aria-label={`${order.name}支付进度`} max={100} value={percent} />
                  <p>未付 {formatCents(remainingCents)} · {percent}%</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recurring-title" className="finance-panel">
          <h3 id="recurring-title">周期记录</h3>
          {recurringTransactions.length === 0 ? (
            <p className="side-empty">暂无周期记录</p>
          ) : (
            <ul aria-label="周期记录列表">
              {recurringTransactions.map((item) => (
                <li key={item.id} className="recurring-item">
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {formatCents(item.amountCents)} ·{' '}
                      {getRecurringFrequencyLabel(item.frequency)} ·{' '}
                      {formatDate(item.nextDate)}
                    </span>
                  </div>
                  <div className="recurring-actions">
                    <button
                      disabled={!item.active}
                      onClick={() => onRecurringRecord(item.id)}
                      type="button"
                    >
                      <Check size={14} />
                      记一笔
                    </button>
                    <button
                      aria-label={`${item.active ? '停用' : '启用'}${item.name}`}
                      onClick={() =>
                        onRecurringStatusChange(item.id, !item.active)
                      }
                      type="button"
                    >
                      {item.active ? <Ban size={14} /> : <RefreshCw size={14} />}
                      {item.active ? '停用' : '启用'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="import-history-title" className="finance-panel">
          <h3 id="import-history-title">导入历史</h3>
          {billImports.length === 0 ? (
            <p className="side-empty">暂无导入批次</p>
          ) : (
            <ul aria-label="账单导入历史">
              {billImports.map((item) => (
                <li key={item.id} className="import-item">
                  <div>
                    <strong>{item.fileName}</strong>
                    <span>
                      {item.source === 'alipay' ? '支付宝' : '微信'} ·{' '}
                      {item.transactionIds.length} 笔
                    </span>
                  </div>
                  <button
                    aria-label={`撤销${item.fileName}`}
                    onClick={() => onImportUndo(item.id)}
                    type="button"
                  >
                    撤销
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      {financeDialog}
    </div>
  )
}

function getCategoryTotals(transactions: Transaction[], now: Date) {
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const totals: Record<string, number> = {}

  for (const item of transactions) {
    if (!item.date.startsWith(monthPrefix) || item.kind !== 'expense') {
      continue
    }

    totals[item.category] = (totals[item.category] ?? 0) + item.amountCents
  }

  for (const item of transactions) {
    if (
      !item.date.startsWith(monthPrefix) ||
      item.kind !== 'income' ||
      item.tag !== 'refund'
    ) {
      continue
    }

    totals[item.category] = Math.max(
      0,
      (totals[item.category] ?? 0) - item.amountCents,
    )
  }

  return totals
}

function formatCents(cents: number) {
  return `¥${(cents / 100).toFixed(2).replace(/\.00$/, '')}`
}

function formatDate(date: string) {
  return date.replaceAll('-', '.')
}
