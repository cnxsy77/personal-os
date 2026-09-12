import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Plus,
  Wallet,
} from 'lucide-react'
import { RecordDialog } from '../components/RecordDialog'
import type { Transaction, TransactionInput, TransactionKind } from '../data/model'
import './FinanceQuickRecord.css'

type Props = {
  monthlyBudgetCents: number
  transactions: Transaction[]
  dialogOpen: boolean
  dialogTab?: string
  dialogOnly?: boolean
  onDialogOpen: (tab?: string) => void
  onDialogClose: () => void
  onSaved: (message: string) => void
  onSubmit: (input: TransactionInput) => void
  onBudgetSubmit: (monthlyBudgetCents: number) => void
  expenseCategories: string[]
  incomeCategories: string[]
}

export function FinanceQuickRecord({
  monthlyBudgetCents,
  transactions,
  dialogOpen,
  dialogTab = 'transaction',
  dialogOnly = false,
  onDialogOpen,
  onDialogClose,
  onSaved,
  onSubmit,
  onBudgetSubmit,
  expenseCategories,
  incomeCategories,
}: Props) {
  const [kind, setKind] = useState<TransactionKind>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('餐饮')
  const [error, setError] = useState('')
  const [budgetDraft, setBudgetDraft] = useState(
    String(monthlyBudgetCents / 100),
  )
  const [budgetError, setBudgetError] = useState('')
  const now = new Date()
  const today = toDateKey(now)
  const categories = kind === 'expense' ? expenseCategories : incomeCategories

  useEffect(() => {
    if (!categories.includes(category)) {
      setCategory(categories[0] ?? '')
    }
  }, [categories, category])
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthTransactions = transactions.filter((item) =>
    item.date.startsWith(monthPrefix),
  )
  const monthExpenseTotal = monthTransactions
    .filter((item) => item.kind === 'expense')
    .reduce((total, item) => total + item.amountCents, 0)
  const monthIncomeTotal = monthTransactions
    .filter((item) => item.kind === 'income')
    .reduce((total, item) => total + item.amountCents, 0)
  const todayTotal = transactions
    .filter((item) => item.date === today && item.kind === 'expense')
    .reduce((total, item) => total + item.amountCents, 0)
  const monthCount = transactions.filter((item) => item.date.startsWith(monthPrefix)).length
  const budgetRemaining = Math.max(0, monthlyBudgetCents - monthExpenseTotal)
  const budgetUsedPercent = Math.min(
    100,
    Math.round((monthExpenseTotal / monthlyBudgetCents) * 100),
  )
  const categoryTotals = monthTransactions
    .filter((item) => item.kind === 'expense')
    .reduce<Record<string, number>>((totals, item) => {
      totals[item.category] = (totals[item.category] ?? 0) + item.amountCents
      return totals
    }, {})
  const sortedCategoryTotals = Object.entries(categoryTotals).sort(
    ([, amountA], [, amountB]) => amountB - amountA,
  )

  function openDialog(tab = dialogTab) {
    setError('')
    setBudgetError('')
    onDialogOpen(tab)
  }

  function closeDialog() {
    setError('')
    setBudgetError('')
    onDialogClose()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const cents = Math.round(Number(amount) * 100)

    if (!Number.isFinite(cents) || cents <= 0) {
      setError('请输入大于 0 的金额')
      return
    }

    onSubmit({ kind, amountCents: cents, category, date: today })
    setAmount('')
    setError('')
    closeDialog()
    onSaved(kind === 'expense' ? '支出已记录' : '收入已记录')
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

  const financeDialog = (
    <RecordDialog
      activeTab={dialogTab}
      description="记录收支或调整月度预算。"
      onClose={closeDialog}
      onTabChange={openDialog}
      open={dialogOpen}
      tabs={[
        { id: 'transaction', label: '收支' },
        { id: 'budget', label: '预算' },
      ]}
      title="添加记账记录"
    >
      {dialogTab === 'transaction' ? (
        <form onSubmit={submit} className="finance-form">
          <div className="segmented" role="group" aria-label="记录类型">
            <button
              type="button"
              className={kind === 'expense' ? 'selected' : ''}
              aria-pressed={kind === 'expense'}
              onClick={() => {
                setKind('expense')
                setCategory('餐饮')
              }}
            >
              <ArrowDownCircle size={16} />
              支出
            </button>
            <button
              type="button"
              className={kind === 'income' ? 'selected' : ''}
              aria-pressed={kind === 'income'}
              onClick={() => {
                setKind('income')
                setCategory('工资')
              }}
            >
              <ArrowUpCircle size={16} />
              收入
            </button>
          </div>

          <div className="finance-fields">
            <div>
              <label htmlFor="finance-amount">金额</label>
              <input
                id="finance-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
              />
            </div>
            <div>
              <label htmlFor="finance-category">分类</label>
              <select
                id="finance-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {categories.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <button type="submit">记录</button>
          </div>
          {error ? <p role="alert">{error}</p> : null}
        </form>
      ) : (
        <form onSubmit={submitBudget} className="budget-form dialog-form">
          <div>
            <label htmlFor="finance-budget">设置预算</label>
            <input
              id="finance-budget"
              value={budgetDraft}
              onChange={(event) => setBudgetDraft(event.target.value)}
              inputMode="decimal"
              type="number"
              min="0.01"
              step="0.01"
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
      <section className="finance-panel" aria-labelledby="finance-title">
        <div className="panel-heading">
          <h2 id="finance-title">快速收支</h2>
          <button
            className="page-add"
            onClick={() => openDialog('transaction')}
            type="button"
          >
            <Plus size={16} />
            添加记录
          </button>
        </div>

        <div className="finance-summary">
          <div>
            <label>今日支出</label>
            <strong>{formatCents(todayTotal)}</strong>
          </div>
          <div>
            <label>本月支出</label>
            <strong>{formatCents(monthExpenseTotal)}</strong>
          </div>
          <div>
            <label>本月收入</label>
            <strong>{formatCents(monthIncomeTotal)}</strong>
          </div>
          <div>
            <label>本月记录</label>
            <strong>{monthCount} 笔</strong>
          </div>
        </div>

        <section className="category-panel" aria-labelledby="category-title">
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

        <div className="finance-list-heading">
          <h3>最近记录</h3>
        </div>
        <ul aria-label="最近收支">
          {transactions.slice(0, 8).map((item) => (
            <li key={item.id}>
              <i className={item.kind}>
                {item.kind === 'expense'
                  ? <ArrowDownCircle size={17} />
                  : <ArrowUpCircle size={17} />}
              </i>
              <div>
                <h4>{item.category}</h4>
                <p>{formatDate(item.date)}</p>
              </div>
              <b>{item.kind === 'expense' ? '-' : '+'}{formatCents(item.amountCents)}</b>
            </li>
          ))}
        </ul>
      </section>

      <aside className="finance-panel budget-side" aria-labelledby="budget-title">
        <h2 id="budget-title">月度预算</h2>
        <div className="budget-status">
          <div>
            <label>剩余预算</label>
            <strong>{formatCents(budgetRemaining)}</strong>
          </div>
          <div>
            <label>已使用</label>
            <strong>{budgetUsedPercent}%</strong>
          </div>
        </div>
        <progress
          aria-label="预算使用进度"
          max={100}
          value={budgetUsedPercent}
        />
        <p>
          <Wallet size={15} />
          预算快照会随每笔支出自动更新。
        </p>
      </aside>

      {financeDialog}
    </div>
  )
}

function formatCents(cents: number) {
  return `¥${(cents / 100).toFixed(2).replace(/\.00$/, '')}`
}

function formatDate(date: string) {
  return date.replaceAll('-', '.')
}

function toDateKey(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}
