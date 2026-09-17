package model

type TaskCategory string

type TaskInput struct {
	Title    string       `json:"title"`
	Date     string       `json:"date"`
	Category TaskCategory `json:"category"`
	Time     string       `json:"time,omitempty"`
}

type Task struct {
	ID       string       `json:"id"`
	Title    string       `json:"title"`
	Meta     string       `json:"meta"`
	Done     bool         `json:"done"`
	Date     string       `json:"date,omitempty"`
	Time     string       `json:"time,omitempty"`
	Category TaskCategory `json:"category,omitempty"`
}

type ProjectStatus string

type Project struct {
	ID         string        `json:"id"`
	Name       string        `json:"name"`
	Goal       string        `json:"goal"`
	Status     ProjectStatus `json:"status"`
	NextAction string        `json:"nextAction"`
	DueDate    string        `json:"dueDate,omitempty"`
}

type ProjectInput struct {
	Name       string        `json:"name"`
	Goal       string        `json:"goal"`
	Status     ProjectStatus `json:"status"`
	NextAction string        `json:"nextAction"`
	DueDate    string        `json:"dueDate,omitempty"`
}

type Settings struct {
	WeeklyWorkoutTarget int      `json:"weeklyWorkoutTarget"`
	ExpenseCategories   []string `json:"expenseCategories"`
	IncomeCategories    []string `json:"incomeCategories"`
	FontScale           string   `json:"fontScale"`
	ReducedMotion       bool     `json:"reducedMotion"`
}

type SettingsInput struct {
	WeeklyWorkoutTarget *int      `json:"weeklyWorkoutTarget,omitempty"`
	ExpenseCategories   *[]string `json:"expenseCategories,omitempty"`
	IncomeCategories    *[]string `json:"incomeCategories,omitempty"`
	FontScale           *string   `json:"fontScale,omitempty"`
	ReducedMotion       *bool     `json:"reducedMotion,omitempty"`
}

type RenameCategoryInput struct {
	Kind string `json:"kind"`
	From string `json:"from"`
	To   string `json:"to"`
}

type TransactionKind string
type TransactionTag string
type PaymentStage string
type BillSource string

type Transaction struct {
	ID                   string          `json:"id"`
	Kind                 TransactionKind `json:"kind"`
	AmountCents          int64           `json:"amountCents"`
	Category             string          `json:"category"`
	Date                 string          `json:"date"`
	Note                 string          `json:"note,omitempty"`
	Tag                  TransactionTag  `json:"tag,omitempty"`
	OrderID              *string         `json:"orderId,omitempty"`
	Stage                PaymentStage    `json:"stage,omitempty"`
	RecurringID          *string         `json:"recurringId,omitempty"`
	RelatedTransactionID *string         `json:"relatedTransactionId,omitempty"`
	Counterparty         string          `json:"counterparty,omitempty"`
	Source               BillSource      `json:"source,omitempty"`
	SourceTradeNo        string          `json:"sourceTradeNo,omitempty"`
	OccurredAt           string          `json:"occurredAt,omitempty"`
	ImportID             *string         `json:"importId,omitempty"`
}

type PaymentOrderInput struct {
	Name               string `json:"name"`
	ExpectedTotalCents int64  `json:"expectedTotalCents"`
}

type TransactionInput struct {
	Kind                 TransactionKind    `json:"kind"`
	AmountCents          int64              `json:"amountCents"`
	Category             string             `json:"category"`
	Date                 string             `json:"date"`
	Note                 *string            `json:"note,omitempty"`
	Tag                  TransactionTag     `json:"tag,omitempty"`
	OrderID              *string            `json:"orderId,omitempty"`
	Stage                PaymentStage       `json:"stage,omitempty"`
	RecurringID          *string            `json:"recurringId,omitempty"`
	RelatedTransactionID *string            `json:"relatedTransactionId,omitempty"`
	Counterparty         *string            `json:"counterparty,omitempty"`
	Source               BillSource         `json:"source,omitempty"`
	SourceTradeNo        *string            `json:"sourceTradeNo,omitempty"`
	OccurredAt           *string            `json:"occurredAt,omitempty"`
	NewOrder             *PaymentOrderInput `json:"newOrder,omitempty"`
}

type TransactionUpdateInput TransactionInput

type PaymentOrder struct {
	ID                 string `json:"id"`
	Name               string `json:"name"`
	ExpectedTotalCents int64  `json:"expectedTotalCents"`
	CreatedAt          string `json:"createdAt"`
}

type Recurring struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Kind        string `json:"kind"`
	AmountCents int64  `json:"amountCents"`
	Category    string `json:"category"`
	Frequency   string `json:"frequency"`
	NextDate    string `json:"nextDate"`
	Note        string `json:"note,omitempty"`
	Active      bool   `json:"active"`
}

type RecurringInput struct {
	ID          *string `json:"id,omitempty"`
	Name        string  `json:"name"`
	Kind        string  `json:"kind"`
	AmountCents int64   `json:"amountCents"`
	Category    string  `json:"category"`
	Frequency   string  `json:"frequency"`
	NextDate    string  `json:"nextDate"`
	Note        *string `json:"note,omitempty"`
	Active      *bool   `json:"active,omitempty"`
}

type BillImport struct {
	ID             string     `json:"id"`
	Source         BillSource `json:"source"`
	FileName       string     `json:"fileName"`
	ImportedAt     string     `json:"importedAt"`
	TransactionIDs []string   `json:"transactionIds"`
}

type BillImportTransactionInput struct {
	Kind          TransactionKind `json:"kind"`
	AmountCents   int64           `json:"amountCents"`
	Category      string          `json:"category"`
	Date          string          `json:"date"`
	Note          *string         `json:"note,omitempty"`
	Tag           TransactionTag  `json:"tag,omitempty"`
	Counterparty  *string         `json:"counterparty,omitempty"`
	SourceTradeNo *string         `json:"sourceTradeNo,omitempty"`
	OccurredAt    *string         `json:"occurredAt,omitempty"`
}

type BillImportInput struct {
	Source       BillSource                   `json:"source"`
	FileName     string                       `json:"fileName"`
	Transactions []BillImportTransactionInput `json:"transactions"`
}

type BillImportResult struct {
	ImportedCount  int     `json:"importedCount"`
	DuplicateCount int     `json:"duplicateCount"`
	ImportID       *string `json:"importId,omitempty"`
}
type LearningPlatform string

type StudyLog struct {
	ID         string           `json:"id"`
	Topic      string           `json:"topic"`
	Minutes    int              `json:"minutes"`
	Date       string           `json:"date"`
	PathID     *string          `json:"pathId,omitempty"`
	Platform   LearningPlatform `json:"platform,omitempty"`
	ResourceID *string          `json:"resourceId,omitempty"`
	LessonID   *string          `json:"lessonId,omitempty"`
	Note       string           `json:"note,omitempty"`
}

type LearningPath struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	TargetMinutes int    `json:"targetMinutes"`
}

type LearningResource struct {
	ID            string           `json:"id"`
	PathID        *string          `json:"pathId"`
	Title         string           `json:"title"`
	Kind          string           `json:"kind"`
	Status        string           `json:"status"`
	Platform      LearningPlatform `json:"platform,omitempty"`
	SourceURL     string           `json:"sourceUrl,omitempty"`
	ExternalID    string           `json:"externalId,omitempty"`
	TargetMinutes *int             `json:"targetMinutes,omitempty"`
}

type LearningLesson struct {
	ID              string `json:"id"`
	ResourceID      string `json:"resourceId"`
	Title           string `json:"title"`
	SortOrder       int    `json:"sortOrder"`
	Status          string `json:"status"`
	ExpectedMinutes *int   `json:"expectedMinutes,omitempty"`
	SourceURL       string `json:"sourceUrl,omitempty"`
}

type NoteFolder struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"createdAt"`
}

type Note struct {
	ID         string   `json:"id"`
	FolderID   *string  `json:"folderId"`
	Title      string   `json:"title"`
	Content    string   `json:"content"`
	Tags       []string `json:"tags"`
	ResourceID *string  `json:"resourceId"`
	LessonID   *string  `json:"lessonId"`
	UpdatedAt  string   `json:"updatedAt"`
}

type WeeklyReview struct {
	ID            string `json:"id"`
	WeekStartDate string `json:"weekStartDate"`
	Wins          string `json:"wins"`
	Blockers      string `json:"blockers"`
	NextFocus     string `json:"nextFocus"`
}

type WorkoutKind string
type WorkoutStatus string

type WorkoutExercise struct {
	Name         string `json:"name"`
	Prescription string `json:"prescription,omitempty"`
	Target       string `json:"target,omitempty"`
}

type Workout struct {
	ID              string            `json:"id"`
	Date            string            `json:"date"`
	Kind            WorkoutKind       `json:"kind"`
	Kinds           []WorkoutKind     `json:"kinds,omitempty"`
	Status          WorkoutStatus     `json:"status,omitempty"`
	DurationMinutes int               `json:"durationMinutes"`
	Notes           string            `json:"notes"`
	Plan            []string          `json:"plan,omitempty"`
	Focus           string            `json:"focus,omitempty"`
	Warmup          []string          `json:"warmup,omitempty"`
	Exercises       []WorkoutExercise `json:"exercises,omitempty"`
	Finisher        []string          `json:"finisher,omitempty"`
	SorenessAreas   []string          `json:"sorenessAreas,omitempty"`
	CoachNotes      []string          `json:"coachNotes,omitempty"`
}

type HealthCondition string

type HealthMetric struct {
	ID                   string          `json:"id"`
	Date                 string          `json:"date"`
	SleepHours           float64         `json:"sleepHours"`
	WeightKg             *float64        `json:"weightKg"`
	Condition            HealthCondition `json:"condition"`
	MenstruationFlow     string          `json:"menstruationFlow,omitempty"`
	MenstruationSymptoms []string        `json:"menstruationSymptoms,omitempty"`
	MenstruationNote     string          `json:"menstruationNote,omitempty"`
}

type State struct {
	Tasks                 []Task             `json:"tasks"`
	Projects              []Project          `json:"projects"`
	Transactions          []Transaction      `json:"transactions"`
	StudyLogs             []StudyLog         `json:"studyLogs"`
	MonthlyBudgetCents    int                `json:"monthlyBudgetCents"`
	LearningPaths         []LearningPath     `json:"learningPaths"`
	LearningResources     []LearningResource `json:"learningResources"`
	LearningLessons       []LearningLesson   `json:"learningLessons"`
	LearningNoteFolders   []NoteFolder       `json:"learningNoteFolders"`
	LearningNotes         []Note             `json:"learningNotes"`
	WeeklyReviews         []WeeklyReview     `json:"weeklyReviews"`
	Workouts              []Workout          `json:"workouts"`
	HealthMetrics         []HealthMetric     `json:"healthMetrics"`
	PaymentOrders         []PaymentOrder     `json:"paymentOrders"`
	RecurringTransactions []Recurring        `json:"recurringTransactions"`
	BillImports           []BillImport       `json:"billImports"`
	Settings              Settings           `json:"settings"`
}
