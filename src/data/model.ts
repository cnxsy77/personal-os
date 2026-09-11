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

export type StudyLog = {
  id: string
  topic: string
  minutes: number
  date: string
}

export type StudyLogInput = Omit<StudyLog, 'id'>

export type PersonalOSState = {
  tasks: Task[]
  transactions: Transaction[]
  studyLogs: StudyLog[]
}

export type PersonalOSData = {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => PersonalOSState
  toggleTask: (id: string) => void
  addQuickTask: (title: string) => void
  recordTransaction: (input: TransactionInput) => void
  recordStudyLog: (input: StudyLogInput) => void
}
