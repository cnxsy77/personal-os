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

export type WorkoutKind = 'push' | 'pull' | 'legs' | 'cardio' | 'rest'

export type WorkoutStatus = 'planned' | 'completed' | 'skipped'

export type Workout = {
  id: string
  date: string
  kind: WorkoutKind
  status: WorkoutStatus
  durationMinutes: number
  notes: string
}

export type WorkoutInput = Omit<Workout, 'id'>

export type HealthCondition = 'great' | 'good' | 'fair' | 'tired'

export type HealthMetric = {
  id: string
  date: string
  sleepHours: number
  weightKg: number | null
  condition: HealthCondition
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
  recordStudyLog: (input: StudyLogInput) => void
  updateMonthlyBudget: (monthlyBudgetCents: number) => void
  addLearningPath: (input: LearningPathInput) => void
  addLearningResource: (input: LearningResourceInput) => void
  setLearningResourceStatus: (id: string, status: LearningResourceStatus) => void
  saveWeeklyReview: (input: WeeklyReviewInput) => void
  recordWorkout: (input: WorkoutInput) => void
  setWorkoutStatus: (id: string, status: WorkoutStatus) => void
  saveHealthMetric: (input: HealthMetricInput) => void
}
