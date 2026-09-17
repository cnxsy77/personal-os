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

type State struct {
	Tasks      []Task    `json:"tasks"`
	Projects   []Project `json:"projects"`
	Settings   Settings  `json:"settings"`

	Transactions           []map[string]any `json:"transactions"`
	StudyLogs              []map[string]any `json:"studyLogs"`
	MonthlyBudgetCents     int              `json:"monthlyBudgetCents"`
	LearningPaths          []map[string]any `json:"learningPaths"`
	LearningResources      []map[string]any `json:"learningResources"`
	LearningLessons        []map[string]any `json:"learningLessons"`
	LearningNoteFolders    []map[string]any `json:"learningNoteFolders"`
	LearningNotes          []map[string]any `json:"learningNotes"`
	WeeklyReviews          []map[string]any `json:"weeklyReviews"`
	Workouts               []map[string]any `json:"workouts"`
	HealthMetrics          []map[string]any `json:"healthMetrics"`
	PaymentOrders          []map[string]any `json:"paymentOrders"`
	RecurringTransactions  []map[string]any `json:"recurringTransactions"`
	BillImports            []map[string]any `json:"billImports"`
}
