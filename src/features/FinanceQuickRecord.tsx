import { useState, type FormEvent } from 'react'
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import type { Transaction, TransactionInput, TransactionKind } from '../data/model'
import './FinanceQuickRecord.css'

const expenseCategories = ['餐饮', '交通', '购物', '住房', '其他']
const incomeCategories = ['工资', '奖金', '理财', '其他']

type Props = {
  transactions: Transaction[]
  onSubmit: (input: TransactionInput) => void
}

export function FinanceQuickRecord({ transactions, onSubmit }: Props) {
  const [kind, setKind] = useState<TransactionKind>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('餐饮')
  const [error, setError] = useState('')
  const now = new Date()
  const today = toDateKey(now)
  const categories = kind === 'expense' ? expenseCategories : incomeCategories
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const todayTotal = transactions
    .filter((item) => item.date === today && item.kind === 'expense')
    .reduce((total, item) => total + item.amountCents, 0)
  const monthCount = transactions.filter((item) => item.date.startsWith(monthPrefix)).length

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
  }

  return (
    <section className="finance-panel" aria-labelledby="finance-title">
      <h2 id="finance-title">快速收支</h2>
      <div className="finance-summary">
        <div>
          <label>今日支出</label>
          <strong>{formatCents(todayTotal)}</strong>
        </div>
        <div>
          <label>本月记录</label>
          <strong>{monthCount} 笔</strong>
        </div>
      </div>

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

      <div className="finance-list-heading">
        <h3>最近记录</h3>
      </div>
      <ul>
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
