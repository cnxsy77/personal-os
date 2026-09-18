import { useState, type FormEvent } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Repeat } from 'lucide-react'
import type {
  PaymentOrder,
  Transaction,
  TransactionInput,
  TransactionKind,
  TransactionTag,
} from '../data/model'

type Props = {
  expenseCategories: string[]
  incomeCategories: string[]
  orders: PaymentOrder[]
  transactions: Transaction[]
  editingTransaction?: Transaction | null
  onSubmit: (input: TransactionInput, transactionId?: string) => void
}

export function FinanceTransactionForm({
  expenseCategories,
  incomeCategories,
  orders,
  transactions,
  editingTransaction,
  onSubmit,
}: Props) {
  const now = new Date()
  const today = toDateKey(now)
  const [kind, setKind] = useState<TransactionKind>(editingTransaction?.kind ?? 'expense')
  const [date, setDate] = useState(editingTransaction?.date ?? today)
  const [amount, setAmount] = useState(editingTransaction ? String(editingTransaction.amountCents / 100) : '')
  const [category, setCategory] = useState(editingTransaction?.category ?? '餐饮')
  const [tag, setTag] = useState<TransactionTag>(editingTransaction?.tag ?? 'normal')
  const [note, setNote] = useState(editingTransaction?.note ?? '')
  const [orderMode, setOrderMode] = useState<'none' | 'new' | 'existing'>(
    editingTransaction?.orderId ? 'existing' : 'none',
  )
  const [orderName, setOrderName] = useState('')
  const [orderTotal, setOrderTotal] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState(editingTransaction?.orderId ?? orders[0]?.id ?? '')
  const [stage, setStage] = useState<'deposit' | 'final' | 'full'>(editingTransaction?.stage ?? 'full')
  const [relatedTransactionId, setRelatedTransactionId] = useState('')
  const [error, setError] = useState('')

  const categories =
    kind === 'expense' ? expenseCategories : kind === 'income' ? incomeCategories : ['转账']
  const activeCategory = categories.includes(category)
    ? category
    : categories[0] ?? ''
  const selectedOrder = orders.find((order) => order.id === selectedOrderId)
  const expenseRecords = transactions.filter((item) => item.kind === 'expense')

  function changeKind(nextKind: TransactionKind) {
    setKind(nextKind)
    setTag('normal')
    setCategory(nextKind === 'expense' ? '餐饮' : nextKind === 'income' ? '工资' : '转账')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const cents = Math.round(Number(amount) * 100)

    if (!Number.isFinite(cents) || cents <= 0) {
      setError('请输入大于 0 的金额')
      return
    }

    if (!date) {
      setError('请选择记账日期')
      return
    }

    if (orderMode === 'new') {
      const totalCents = Math.round(Number(orderTotal) * 100)
      if (!orderName.trim()) {
        setError('订单名称不能为空')
        return
      }

      if (!Number.isFinite(totalCents) || totalCents <= 0) {
        setError('订单总额必须大于 0')
        return
      }
    }

    try {
      const input: TransactionInput = {
        kind,
        amountCents: cents,
        category: activeCategory,
        date,
        source: 'manual',
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(kind !== 'transfer' && tag !== 'normal' ? { tag } : {}),
        ...(kind === 'income' && tag === 'refund' && relatedTransactionId
          ? { relatedTransactionId }
          : {}),
        ...(orderMode === 'new'
          ? {
              newOrder: {
                name: orderName.trim(),
                expectedTotalCents: Math.round(Number(orderTotal) * 100),
              },
              stage,
            }
          : {}),
        ...(orderMode === 'existing' && selectedOrderId
          ? { orderId: selectedOrderId, stage }
          : {}),
      }
      await onSubmit(input, editingTransaction?.id)
      setAmount('')
      setNote('')
      setError('')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存失败')
    }
  }

  return (
    <form className="finance-form" onSubmit={submit}>
      <div aria-label="收支类型" className="segmented" role="group">
        <button
          aria-pressed={kind === 'expense'}
          className={kind === 'expense' ? 'selected' : ''}
          onClick={() => changeKind('expense')}
          type="button"
        >
          <ArrowDownCircle size={16} />
          支出
        </button>
        <button
          aria-pressed={kind === 'income'}
          className={kind === 'income' ? 'selected' : ''}
          onClick={() => changeKind('income')}
          type="button"
        >
          <ArrowUpCircle size={16} />
          收入
        </button>
        <button
          aria-pressed={kind === 'transfer'}
          className={kind === 'transfer' ? 'selected' : ''}
          onClick={() => changeKind('transfer')}
          type="button"
        >
          <Repeat size={16} />
          转账
        </button>
      </div>

      <div className="finance-fields">
        <div>
          <label htmlFor="finance-date">日期</label>
          <input
            id="finance-date"
            onChange={(event) => setDate(event.target.value)}
            type="date"
            value={date}
          />
        </div>
        <div>
          <label htmlFor="finance-amount">金额</label>
          <input
            id="finance-amount"
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
          <label htmlFor="finance-category">分类</label>
          <select
            id="finance-category"
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
          <label htmlFor="finance-tag">记录类型</label>
          <select
            id="finance-tag"
            onChange={(event) => setTag(event.target.value as TransactionTag)}
            value={tag}
          >
            <option value="normal">普通</option>
            {kind !== 'transfer' ? <option value="subscription">订阅</option> : null}
            {kind === 'income' ? <option value="refund">退款</option> : null}
          </select>
        </div>

        {kind === 'income' && tag === 'refund' ? (
          <div className="form-field-full">
            <label htmlFor="finance-related-expense">关联原支出</label>
            <select
              id="finance-related-expense"
              onChange={(event) => setRelatedTransactionId(event.target.value)}
              value={relatedTransactionId}
            >
              <option value="">暂不关联</option>
              {expenseRecords.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.date} {item.counterparty || item.category} ¥
                  {(item.amountCents / 100).toFixed(2)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="form-field-full">
          <label htmlFor="finance-order-mode">订单关联</label>
          <select
            id="finance-order-mode"
            onChange={(event) =>
              setOrderMode(event.target.value as typeof orderMode)
            }
            value={orderMode}
          >
            <option value="none">不关联</option>
            <option value="new">新建订单</option>
            {orders.length ? <option value="existing">关联已有订单</option> : null}
          </select>
        </div>

        {orderMode === 'new' ? (
          <>
            <div>
              <label htmlFor="finance-order-name">订单名称</label>
              <input
                id="finance-order-name"
                onChange={(event) => setOrderName(event.target.value)}
                placeholder="微单相机"
                value={orderName}
              />
            </div>
            <div>
              <label htmlFor="finance-order-total">订单总额</label>
              <input
                id="finance-order-total"
                inputMode="decimal"
                min="0.01"
                onChange={(event) => setOrderTotal(event.target.value)}
                placeholder="0.00"
                step="0.01"
                type="number"
                value={orderTotal}
              />
            </div>
          </>
        ) : null}

        {orderMode === 'existing' && selectedOrder ? (
          <div>
            <label htmlFor="finance-order-existing">已有订单</label>
            <select
              id="finance-order-existing"
              onChange={(event) => setSelectedOrderId(event.target.value)}
              value={selectedOrderId}
            >
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.name} · ¥{(order.expectedTotalCents / 100).toFixed(2)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {orderMode !== 'none' ? (
          <div>
            <label htmlFor="finance-payment-stage">支付阶段</label>
            <select
              id="finance-payment-stage"
              onChange={(event) =>
                setStage(event.target.value as typeof stage)
              }
              value={stage}
            >
              <option value="deposit">定金</option>
              <option value="final">尾款</option>
              <option value="full">全款</option>
            </select>
          </div>
        ) : null}

        <div className="form-field-full">
          <label htmlFor="finance-note">备注</label>
          <textarea
            id="finance-note"
            onChange={(event) => setNote(event.target.value)}
            placeholder="商品、用途、订单说明等"
            rows={3}
            value={note}
          />
        </div>

        <button type="submit">{editingTransaction ? '更新记录' : '记录'}</button>
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
