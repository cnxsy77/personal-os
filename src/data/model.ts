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

export type TaskUpdateInput = TaskInput

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

export type ProjectUpdateInput = ProjectInput

export type TransactionKind = 'expense' | 'income' | 'transfer'

export type TransactionTag =
  | 'normal'
  | 'subscription'
  | 'installment'
  | 'refund'

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

export type TransactionUpdateInput = Omit<TransactionInput, 'newOrder'>

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
  platform?: LearningPlatform
  resourceId?: string
  lessonId?: string
  note?: string
}

export type StudyLogInput = Omit<StudyLog, 'id'>

export type StudyLogUpdateInput = StudyLogInput

export type LearningPath = {
  id: string
  title: string
  targetMinutes: number
}

export type LearningPathInput = Omit<LearningPath, 'id'>

export type LearningPathUpdateInput = LearningPathInput

export type LearningResourceKind = 'course' | 'book' | 'article' | 'video' | 'docs'

export type LearningResourceStatus = 'todo' | 'doing' | 'done'

export type LearningResource = {
  id: string
  pathId: string | null
  title: string
  kind: LearningResourceKind
  status: LearningResourceStatus
  platform?: LearningPlatform
  sourceUrl?: string
  externalId?: string
  targetMinutes?: number
}

export type LearningResourceInput = Omit<LearningResource, 'id'>

export type LearningResourceUpdateInput = LearningResourceInput

export type LearningPlatform =
  | 'bilibili'
  | 'mooc'
  | 'plaso'
  | 'xiaoe'
  | 'baiduPan'
  | 'other'

export type LearningLessonStatus = LearningResourceStatus

export type LearningLesson = {
  id: string
  resourceId: string
  title: string
  sortOrder: number
  status: LearningLessonStatus
  expectedMinutes?: number
  sourceUrl?: string
}

export type LearningLessonDraft = {
  title: string
  status?: LearningLessonStatus
  expectedMinutes?: number
  sourceUrl?: string
}

export type LearningLessonUpdateInput = {
  title: string
  status: LearningLessonStatus
  expectedMinutes?: number
  sourceUrl?: string
}

export type LearningNoteFolder = {
  id: string
  name: string
  createdAt: string
}

export type LearningNote = {
  id: string
  folderId: string | null
  title: string
  content: string
  tags: string[]
  resourceId?: string | null
  lessonId?: string | null
  updatedAt: string
}

export type LearningNoteInput = Omit<
  LearningNote,
  'id' | 'updatedAt'
> & {
  id?: string
}

export type WeeklyReview = {
  id: string
  weekStartDate: string
  wins: string
  blockers: string
  nextFocus: string
}

export type WeeklyReviewInput = Omit<WeeklyReview, 'id'>

export type WeeklyReviewUpdateInput = WeeklyReviewInput

export type HealthMetricUpdateInput = HealthMetricInput

export type SettingsCategoryKind = 'expense' | 'income'

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
  learningLessons: LearningLesson[]
  learningNoteFolders: LearningNoteFolder[]
  learningNotes: LearningNote[]
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
  updateTask: (id: string, input: TaskUpdateInput) => void
  deleteTask: (id: string) => void
  addQuickTask: (title: string) => void
  addProject: (input: ProjectInput) => void
  updateProject: (id: string, input: ProjectUpdateInput) => void
  deleteProject: (id: string) => void
  setProjectStatus: (id: string, status: ProjectStatus) => void
  recordTransaction: (input: TransactionInput) => void
  updateTransaction: (id: string, input: TransactionUpdateInput) => void
  deleteTransaction: (id: string) => void
  saveRecurringTransaction: (input: RecurringTransactionInput) => void
  setRecurringTransactionStatus: (id: string, active: boolean) => void
  recordRecurringTransaction: (id: string, date?: string) => void
  deleteRecurringTransaction: (id: string) => void
  updatePaymentOrder: (
    id: string,
    input: { name: string; expectedTotalCents: number },
  ) => void
  deletePaymentOrder: (id: string) => void
  importBillTransactions: (input: BillImportInput) => BillImportResult | Promise<BillImportResult>
  undoBillImport: (importId: string) => void
  recordStudyLog: (input: StudyLogInput) => void
  updateStudyLog: (id: string, input: StudyLogUpdateInput) => void
  deleteStudyLog: (id: string) => void
  updateMonthlyBudget: (monthlyBudgetCents: number) => void
  addLearningPath: (input: LearningPathInput) => void
  updateLearningPath: (id: string, input: LearningPathUpdateInput) => void
  deleteLearningPath: (id: string) => void
  addLearningResource: (input: LearningResourceInput) => void
  updateLearningResource: (
    id: string,
    input: LearningResourceUpdateInput,
  ) => void
  deleteLearningResource: (id: string) => void
  setLearningResourceStatus: (id: string, status: LearningResourceStatus) => void
  addLearningLessons: (
    resourceId: string,
    lessons: Array<LearningLessonDraft>,
  ) => void
  setLearningLessonStatus: (id: string, status: LearningLessonStatus) => void
  updateLearningLesson: (
    id: string,
    input: LearningLessonUpdateInput,
  ) => void
  deleteLearningLesson: (id: string) => void
  addLearningNoteFolder: (name: string) => void
  updateLearningNoteFolder: (id: string, name: string) => void
  deleteLearningNoteFolder: (id: string) => void
  saveLearningNote: (input: LearningNoteInput) => void
  deleteLearningNote: (id: string) => void
  saveWeeklyReview: (input: WeeklyReviewInput) => void
  updateWeeklyReview: (id: string, input: WeeklyReviewUpdateInput) => void
  deleteWeeklyReview: (id: string) => void
  recordWorkout: (input: WorkoutInput) => void
  updateWorkout: (id: string, input: WorkoutInput) => void
  deleteWorkout: (id: string) => void
  setWorkoutStatus: (id: string, status: WorkoutStatus) => void
  saveHealthMetric: (input: HealthMetricInput) => void
  updateHealthMetric: (id: string, input: HealthMetricUpdateInput) => void
  deleteHealthMetric: (id: string) => void
  updateSettings: (input: PersonalOSSettingsInput) => void
  renameCategory: (
    kind: SettingsCategoryKind,
    from: string,
    to: string,
  ) => void
}
