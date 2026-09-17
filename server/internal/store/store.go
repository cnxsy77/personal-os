package store

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"

	"personal-os/server/internal/model"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

var categoryLabels = map[model.TaskCategory]string{
	"work":     "工作",
	"health":   "健康",
	"learning": "学习",
	"life":     "生活",
}

type Store struct {
	db *sql.DB
}

func Open(path string) (*Store, error) {
	if path == "" {
		return nil, errors.New("数据库路径不能为空")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, fmt.Errorf("创建数据库目录失败: %w", err)
	}

	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) Migrate(ctx context.Context) error {
	if _, err := s.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TEXT NOT NULL
		)
	`); err != nil {
		return err
	}

	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return err
	}
	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			names = append(names, entry.Name())
		}
	}
	sort.Strings(names)

	for _, name := range names {
		var exists bool
		if err := s.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = ?)`, name).Scan(&exists); err != nil {
			return err
		}
		if exists {
			continue
		}

		content, err := migrationFS.ReadFile("migrations/" + name)
		if err != nil {
			return err
		}
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, string(content)); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("执行迁移 %s 失败: %w", name, err)
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`, name, time.Now().UTC().Format(time.RFC3339)); err != nil {
			_ = tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) LoadState(ctx context.Context) (model.State, error) {
	state := model.State{
		Tasks:                 []model.Task{},
		Projects:              []model.Project{},
		Transactions:          []map[string]any{},
		StudyLogs:             []map[string]any{},
		LearningPaths:         []map[string]any{},
		LearningResources:     []map[string]any{},
		LearningLessons:       []map[string]any{},
		LearningNoteFolders:   []map[string]any{},
		LearningNotes:         []map[string]any{},
		WeeklyReviews:         []map[string]any{},
		Workouts:              []map[string]any{},
		HealthMetrics:         []map[string]any{},
		PaymentOrders:         []map[string]any{},
		RecurringTransactions: []map[string]any{},
		BillImports:           []map[string]any{},
	}

	if err := s.loadSettings(ctx, &state.Settings); err != nil {
		return state, err
	}
	if err := s.loadTasks(ctx, &state.Tasks); err != nil {
		return state, err
	}
	if err := s.loadProjects(ctx, &state.Projects); err != nil {
		return state, err
	}
	return state, nil
}

func (s *Store) loadSettings(ctx context.Context, settings *model.Settings) error {
	var expense, income string
	var reduced int
	err := s.db.QueryRowContext(ctx, `
		SELECT weekly_workout_target, expense_categories, income_categories, font_scale, reduced_motion
		FROM settings WHERE id = 'default'
	`).Scan(&settings.WeeklyWorkoutTarget, &expense, &income, &settings.FontScale, &reduced)
	if errors.Is(err, sql.ErrNoRows) {
		settings.WeeklyWorkoutTarget = 3
		settings.ExpenseCategories = []string{"餐饮", "交通", "居住", "购物", "娱乐", "医疗", "学习"}
		settings.IncomeCategories = []string{"工资", "奖金", "投资", "退款", "其他"}
		settings.FontScale = "default"
		settings.ReducedMotion = false
		encodedExpense, _ := json.Marshal(settings.ExpenseCategories)
		encodedIncome, _ := json.Marshal(settings.IncomeCategories)
		_, err = s.db.ExecContext(ctx, `
			INSERT INTO settings (
				id, weekly_workout_target, expense_categories, income_categories, font_scale, reduced_motion
			) VALUES ('default', ?, ?, ?, ?, ?)
		`, settings.WeeklyWorkoutTarget, string(encodedExpense), string(encodedIncome), settings.FontScale, boolToInt(settings.ReducedMotion))
		return err
	}
	if err != nil {
		return err
	}
	if err := json.Unmarshal([]byte(expense), &settings.ExpenseCategories); err != nil {
		return err
	}
	if err := json.Unmarshal([]byte(income), &settings.IncomeCategories); err != nil {
		return err
	}
	settings.ReducedMotion = reduced == 1
	if settings.ExpenseCategories == nil {
		settings.ExpenseCategories = []string{}
	}
	if settings.IncomeCategories == nil {
		settings.IncomeCategories = []string{}
	}
	return nil
}

func (s *Store) loadTasks(ctx context.Context, tasks *[]model.Task) error {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, title, meta, done, date, time, category
		FROM tasks ORDER BY created_at, id
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	result := []model.Task{}
	for rows.Next() {
		var task model.Task
		var done int
		var nullableDate, nullableTime, nullableCategory sql.NullString
		if err := rows.Scan(&task.ID, &task.Title, &task.Meta, &done, &nullableDate, &nullableTime, &nullableCategory); err != nil {
			return err
		}
		task.Done = done == 1
		task.Date = nullableDate.String
		task.Time = nullableTime.String
		task.Category = model.TaskCategory(nullableCategory.String)
		result = append(result, task)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	*tasks = result
	return nil
}

func (s *Store) loadProjects(ctx context.Context, projects *[]model.Project) error {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, name, goal, status, next_action, due_date
		FROM projects ORDER BY created_at DESC, id DESC
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	result := []model.Project{}
	for rows.Next() {
		var project model.Project
		var dueDate sql.NullString
		if err := rows.Scan(&project.ID, &project.Name, &project.Goal, &project.Status, &project.NextAction, &dueDate); err != nil {
			return err
		}
		project.DueDate = dueDate.String
		result = append(result, project)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	*projects = result
	return nil
}

func (s *Store) CreateTask(ctx context.Context, input model.TaskInput, quick bool) (model.Task, error) {
	validated, err := validateTask(input)
	if err != nil {
		return model.Task{}, err
	}
	id := uuid.NewString()
	meta := categoryLabels[validated.Category] + " · " + validated.Date
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO tasks (id, title, meta, done, date, time, category, created_at)
		VALUES (?, ?, ?, 0, ?, ?, ?, ?)
	`, id, validated.Title, meta, validated.Date, validated.Time, string(validated.Category), time.Now().UTC().Format(time.RFC3339Nano))
	if err != nil {
		return model.Task{}, err
	}

	return model.Task{
		ID: id, Title: validated.Title, Meta: meta, Done: false,
		Date: validated.Date, Time: validated.Time, Category: validated.Category,
	}, nil
}

func (s *Store) ToggleTask(ctx context.Context, id string) error {
	result, err := s.db.ExecContext(ctx, `UPDATE tasks SET done = CASE done WHEN 1 THEN 0 ELSE 1 END WHERE id = ?`, id)
	return checkAffected(result, err, "计划任务不存在")
}

func (s *Store) CreateQuickTask(ctx context.Context, title string) (model.Task, error) {
	return s.CreateTask(ctx, model.TaskInput{
		Title:    title,
		Date:     time.Now().Format("2006-01-02"),
		Category: "work",
	}, true)
}

func (s *Store) UpdateTask(ctx context.Context, id string, input model.TaskInput) error {
	validated, err := validateTask(input)
	if err != nil {
		return err
	}
	meta := categoryLabels[validated.Category] + " · " + validated.Date
	result, err := s.db.ExecContext(ctx, `
		UPDATE tasks SET title = ?, meta = ?, date = ?, time = ?, category = ? WHERE id = ?
	`, validated.Title, meta, validated.Date, validated.Time, string(validated.Category), id)
	return checkAffected(result, err, "计划任务不存在")
}

func (s *Store) DeleteTask(ctx context.Context, id string) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM tasks WHERE id = ?`, id)
	return checkAffected(result, err, "计划任务不存在")
}

func (s *Store) CreateProject(ctx context.Context, input model.ProjectInput) error {
	validated, err := validateProject(input)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO projects (id, name, goal, status, next_action, due_date, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, uuid.NewString(), validated.Name, validated.Goal, string(validated.Status), validated.NextAction, validated.DueDate, time.Now().UTC().Format(time.RFC3339Nano))
	return err
}

func (s *Store) UpdateProject(ctx context.Context, id string, input model.ProjectInput) error {
	validated, err := validateProject(input)
	if err != nil {
		return err
	}
	result, err := s.db.ExecContext(ctx, `
		UPDATE projects SET name = ?, goal = ?, status = ?, next_action = ?, due_date = ? WHERE id = ?
	`, validated.Name, validated.Goal, string(validated.Status), validated.NextAction, validated.DueDate, id)
	return checkAffected(result, err, "项目不存在")
}

func (s *Store) SetProjectStatus(ctx context.Context, id string, status model.ProjectStatus) error {
	if !isProjectStatus(status) {
		return errors.New("请选择有效的项目状态")
	}
	result, err := s.db.ExecContext(ctx, `UPDATE projects SET status = ? WHERE id = ?`, string(status), id)
	return checkAffected(result, err, "项目不存在")
}

func (s *Store) DeleteProject(ctx context.Context, id string) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM projects WHERE id = ?`, id)
	return checkAffected(result, err, "项目不存在")
}

func validateTask(input model.TaskInput) (model.TaskInput, error) {
	input.Title = strings.TrimSpace(input.Title)
	input.Time = strings.TrimSpace(input.Time)
	if input.Title == "" {
		return input, errors.New("计划内容不能为空")
	}
	if !isValidDate(input.Date) {
		return input, errors.New("请选择有效的计划日期")
	}
	if _, ok := categoryLabels[input.Category]; !ok {
		return input, errors.New("请选择有效的计划分类")
	}
	if input.Time != "" && !isValidTime(input.Time) {
		return input, errors.New("请选择有效的计划时间")
	}
	return input, nil
}

func validateProject(input model.ProjectInput) (model.ProjectInput, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.Goal = strings.TrimSpace(input.Goal)
	input.NextAction = strings.TrimSpace(input.NextAction)
	input.DueDate = strings.TrimSpace(input.DueDate)
	if input.Name == "" {
		return input, errors.New("项目名称不能为空")
	}
	if input.Goal == "" {
		return input, errors.New("项目目标不能为空")
	}
	if input.NextAction == "" {
		return input, errors.New("下一步动作不能为空")
	}
	if !isProjectStatus(input.Status) {
		return input, errors.New("请选择有效的项目状态")
	}
	if input.DueDate != "" && !isValidDate(input.DueDate) {
		return input, errors.New("请选择有效的截止日期")
	}
	return input, nil
}

func isProjectStatus(status model.ProjectStatus) bool {
	switch status {
	case "planned", "active", "blocked", "done":
		return true
	default:
		return false
	}
}

func isValidDate(value string) bool {
	parsed, err := time.Parse("2006-01-02", value)
	return err == nil && parsed.Format("2006-01-02") == value
}

func isValidTime(value string) bool {
	parsed, err := time.Parse("15:04", value)
	return err == nil && parsed.Format("15:04") == value
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func checkAffected(result sql.Result, err error, message string) error {
	if err != nil {
		return err
	}
	count, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if count == 0 {
		return errors.New(message)
	}
	return nil
}
