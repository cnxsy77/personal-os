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
  pathId?: string
}

export type StudyLogInput = Omit<StudyLog, 'id'>

export type LearningPath = {
  id: string
  title: string
  targetMinutes: number
}

export type LearningPathInput = Omit<LearningPath, 'id'>

export type LearningResourceKind = 'course' | 'book' | 'article' | 'video' | 'docs'

export type LearningResourceStatus = 'todo' | 'doing' | 'done'

export type LearningResource = {
  id: string
  pathId: string | null
  title: string
  kind: LearningResourceKind
  status: LearningResourceStatus
}

export type LearningResourceInput = Omit<LearningResource, 'id'>

export type WeeklyReview = {
  id: string
  weekStartDate: string
  wins: string
  blockers: string
  nextFocus: string
}

export type WeeklyReviewInput = Omit<WeeklyReview, 'id'>

export type PersonalOSState = {
  tasks: Task[]
  transactions: Transaction[]
  studyLogs: StudyLog[]
  monthlyBudgetCents: number
  learningPaths: LearningPath[]
  learningResources: LearningResource[]
  weeklyReviews: WeeklyReview[]
}

export type PersonalOSData = {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => PersonalOSState
  toggleTask: (id: string) => void
  addQuickTask: (title: string) => void
  recordTransaction: (input: TransactionInput) => void
  recordStudyLog: (input: StudyLogInput) => void
  updateMonthlyBudget: (monthlyBudgetCents: number) => void
  addLearningPath: (input: LearningPathInput) => void
  addLearningResource: (input: LearningResourceInput) => void
  setLearningResourceStatus: (id: string, status: LearningResourceStatus) => void
  saveWeeklyReview: (input: WeeklyReviewInput) => void
}
