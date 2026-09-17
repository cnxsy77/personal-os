import { useState, type FormEvent } from 'react'
import { CalendarClock } from 'lucide-react'
import type {
  RecurringFrequency,
  RecurringTransaction,
  RecurringTransactionInput,
} from '../data/model'

type Props = {
  expenseCategories: string[]
  incomeCategories: string[]
  editingRecurring?: RecurringTransaction | null
  onSubmit: (input: RecurringTransactionInput, recurringId?: string) => void
}

export function FinanceRecurringForm({
  expenseCategories,
  incomeCategories,
  editingRecurring,
  onSubmit,
}: Props) {
  const [kind, setKind] = useState<'expense' | 'income'>(editingRecurring?.kind ?? 'expense')
  const [name, setName] = useState(editingRecurring?.name ?? '')
  const [amount, setAmount] = useState(editingRecurring ? String(editingRecurring.amountCents / 100) : '')
  const [category, setCategory] = useState(editingRecurring?.category ?? '订阅')
  const [frequency, setFrequency] = useState<RecurringFrequency>(editingRecurring?.frequency ?? 'monthly')
  const [nextDate, setNextDate] = useState(editingRecurring?.nextDate ?? toDateKey(new Date()))
  const [note, setNote] = useState(editingRecurring?.note ?? '')
  const [error, setError] = useState('')

  const categories = kind === 'expense' ? expenseCategories : incomeCategories
  const activeCategory = categories.includes(category)
    ? category
    : categories[0] ?? ''

  function submit(event: FormEvent) {
    event.preventDefault()
    const amountCents = Math.round(Number(amount) * 100)

    if (!name.trim()) {
      setError('周期记录名称不能为空')
      return
    }

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError('周期金额必须大于 0')
      return
    }

    try {
      const input: RecurringTransactionInput = {
        name: name.trim(),
        kind,
        amountCents,
        category: activeCategory,
        frequency,
        nextDate,
        ...(note.trim() ? { note: note.trim() } : {}),
      }
      onSubmit(input, editingRecurring?.id)
      setName('')
      setAmount('')
      setNote('')
      setError('')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存失败')
    }
  }

  return (
    <form className="finance-form recurring-form" onSubmit={submit}>
      <div aria-label="周期记录类型" className="segmented" role="group">
        <button
          aria-pressed={kind === 'expense'}
          className={kind === 'expense' ? 'selected' : ''}
          onClick={() => {
            setKind('expense')
            setCategory('订阅')
          }}
          type="button"
        >
          支出
        </button>
        <button
          aria-pressed={kind === 'income'}
          className={kind === 'income' ? 'selected' : ''}
          onClick={() => {
            setKind('income')
            setCategory('工资')
          }}
          type="button"
        >
          收入
        </button>
      </div>

      <div className="finance-fields">
        <div>
          <label htmlFor="recurring-name">名称</label>
          <input
            id="recurring-name"
            onChange={(event) => setName(event.target.value)}
            placeholder="视频会员"
            value={name}
          />
        </div>
        <div>
          <label htmlFor="recurring-amount">金额</label>
          <input
            id="recurring-amount"
            inputMode="decimal"
            min="0.01"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            step="0.01"
            type="number"
            value={amount}
          />
        </div>
        <div>
          <label htmlFor="recurring-category">分类</label>
          <select
            id="recurring-category"
            onChange={(event) => setCategory(event.target.value)}
            value={activeCategory}
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="recurring-frequency">频率</label>
          <select
            id="recurring-frequency"
            onChange={(event) =>
              setFrequency(event.target.value as RecurringFrequency)
            }
            value={frequency}
          >
            <option value="weekly">每周</option>
            <option value="monthly">每月</option>
            <option value="yearly">每年</option>
          </select>
        </div>
        <div>
          <label htmlFor="recurring-date">下次日期</label>
          <input
            id="recurring-date"
            onChange={(event) => setNextDate(event.target.value)}
            type="date"
            value={nextDate}
          />
        </div>
        <div className="form-field-full">
          <label htmlFor="recurring-note">备注</label>
          <textarea
            id="recurring-note"
            onChange={(event) => setNote(event.target.value)}
            placeholder="自动扣款提醒、用途等"
            rows={3}
            value={note}
          />
        </div>
        <button type="submit">
          <CalendarClock size={16} />
          {editingRecurring ? '更新周期' : '保存周期'}
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  )
}

function toDateKey(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}
