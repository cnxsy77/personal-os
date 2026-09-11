export type Task = {
  id: string
  title: string
  meta: string
  done: boolean
}

export type TransactionKind = 'expense' | 'income'

export type Transaction = {
  id: string
  kind: TransactionKind
  amountCents: number
  category: string
  date: string
}

export type TransactionInput = Omit<Transaction, 'id'>

export type PersonalOSState = {
  tasks: Task[]
  transactions: Transaction[]
}

export type PersonalOSData = {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => PersonalOSState
  toggleTask: (id: string) => void
  addQuickTask: (title: string) => void
  recordTransaction: (input: TransactionInput) => void
}
