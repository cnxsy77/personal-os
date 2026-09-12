export type Task = {
  id: string
  title: string
  meta: string
  done: boolean
  date?: string
  time?: string
  category?: TaskCategory
}

export type TaskCategory = 'work' | 'health' | 'learning' | 'life'

export type TaskInput = {
  title: string
  date: string
  category: TaskCategory
  time?: string
}

export type ProjectStatus = 'planned' | 'active' | 'blocked' | 'done'

export type Project = {
  id: string
  name: string
  goal: string
  status: ProjectStatus
  nextAction: string
  dueDate?: string
}

export type ProjectInput = Omit<Project, 'id'>

export type TransactionKind = 'expense' | 'income' | 'transfer'

export type TransactionTag = 'normal' | 'subscription' | 'refund'

export type PaymentStage = 'deposit' | 'final' | 'full'

export type BillSource = 'manual' | 'alipay' | 'wechat'

export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly'

export type Transaction = {
  id: string
  kind: TransactionKind
  amountCents: number
  category: string
  date: string
  note?: string
  tag?: TransactionTag
  orderId?: string
  stage?: PaymentStage
  recurringId?: string
  relatedTransactionId?: string
  counterparty?: string
  source?: BillSource
  sourceTradeNo?: string
  occurredAt?: string
  importId?: string
}

export type NewPaymentOrderInput = {
  name: string
  expectedTotalCents: number
}

export type TransactionInput = Omit<Transaction, 'id'> & {
  newOrder?: NewPaymentOrderInput
}

export type PaymentOrder = {
  id: string
  name: string
  expectedTotalCents: number
  createdAt: string
}

export type RecurringTransaction = {
  id: string
  name: string
  kind: Exclude<TransactionKind, 'transfer'>
  amountCents: number
  category: string
  frequency: RecurringFrequency
  nextDate: string
  note?: string
  active: boolean
}

export type RecurringTransactionInput = Omit<
  RecurringTransaction,
  'id' | 'active'
> & {
  id?: string
  active?: boolean
}

export type BillImportTransactionInput = Omit<Transaction, 'id' | 'importId'>

export type BillImportInput = {
  source: Exclude<BillSource, 'manual'>
  fileName: string
  transactions: BillImportTransactionInput[]
}

export type BillImportResult = {
  importedCount: number
  duplicateCount: number
  importId?: string
}

export type BillImport = {
  id: string
  source: Exclude<BillSource, 'manual'>
  fileName: string
  importedAt: string
  transactionIds: string[]
}

export type FontScale = 'default' | 'large' | 'xlarge'

export type PersonalOSSettings = {
  weeklyWorkoutTarget: number
  expenseCategories: string[]
  incomeCategories: string[]
  fontScale: FontScale
  reducedMotion: boolean
}

export type PersonalOSSettingsInput = Partial<PersonalOSSettings>

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

export type WorkoutKind =
  | 'glutes'
  | 'legs'
  | 'shoulders'
  | 'chest'
  | 'back'
  | 'cardio'
  // Legacy values stay readable for records saved before the type update.
  | 'push'
  | 'pull'
  | 'rest'

export type SelectableWorkoutKind = Exclude<
  WorkoutKind,
  'push' | 'pull' | 'rest'
>

export type MenstruationFlow = 'none' | 'spotting' | 'light' | 'medium' | 'heavy'

export type MenstruationSymptom =
  | 'cramps'
  | 'bloating'
  | 'headache'
  | 'breastTenderness'
  | 'fatigue'
  | 'moodChanges'

export type WorkoutStatus = 'planned' | 'completed' | 'skipped'

export type WorkoutExercise = {
  name: string
  prescription?: string
  target?: string
}

export type Workout = {
  id: string
  date: string
  kind: WorkoutKind
  kinds?: WorkoutKind[]
  status?: WorkoutStatus
  durationMinutes: number
  notes: string
  plan?: string[]
  focus?: string
  warmup?: string[]
  exercises?: WorkoutExercise[]
  finisher?: string[]
  sorenessAreas?: string[]
  coachNotes?: string[]
}

export type WorkoutInput = Omit<Workout, 'id'>

export type HealthCondition = 'great' | 'good' | 'fair' | 'tired'

export type HealthMetric = {
  id: string
  date: string
  sleepHours: number
  weightKg: number | null
  condition: HealthCondition
  menstruationFlow?: MenstruationFlow
  menstruationSymptoms?: MenstruationSymptom[]
  menstruationNote?: string
}

export type HealthMetricInput = Omit<HealthMetric, 'id'>

export type PersonalOSState = {
  tasks: Task[]
  projects: Project[]
  transactions: Transaction[]
  studyLogs: StudyLog[]
  monthlyBudgetCents: number
  learningPaths: LearningPath[]
  learningResources: LearningResource[]
  weeklyReviews: WeeklyReview[]
  workouts: Workout[]
  healthMetrics: HealthMetric[]
  paymentOrders: PaymentOrder[]
  recurringTransactions: RecurringTransaction[]
  billImports: BillImport[]
  settings: PersonalOSSettings
}

export type PersonalOSData = {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => PersonalOSState
  toggleTask: (id: string) => void
  addTask: (input: TaskInput) => void
  addQuickTask: (title: string) => void
  addProject: (input: ProjectInput) => void
  setProjectStatus: (id: string, status: ProjectStatus) => void
  recordTransaction: (input: TransactionInput) => void
  saveRecurringTransaction: (input: RecurringTransactionInput) => void
  setRecurringTransactionStatus: (id: string, active: boolean) => void
  recordRecurringTransaction: (id: string, date?: string) => void
  importBillTransactions: (input: BillImportInput) => BillImportResult
  undoBillImport: (importId: string) => void
  recordStudyLog: (input: StudyLogInput) => void
  updateMonthlyBudget: (monthlyBudgetCents: number) => void
  addLearningPath: (input: LearningPathInput) => void
  addLearningResource: (input: LearningResourceInput) => void
  setLearningResourceStatus: (id: string, status: LearningResourceStatus) => void
  saveWeeklyReview: (input: WeeklyReviewInput) => void
  recordWorkout: (input: WorkoutInput) => void
  updateWorkout: (id: string, input: WorkoutInput) => void
  setWorkoutStatus: (id: string, status: WorkoutStatus) => void
  saveHealthMetric: (input: HealthMetricInput) => void
  updateSettings: (input: PersonalOSSettingsInput) => void
}
