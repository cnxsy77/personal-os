package store

import (
	"context"
	"path/filepath"
	"testing"
)

func TestLoadStateReadsAllDomainTables(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "personal-os.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer st.Close()
	ctx := context.Background()
	if err := st.Migrate(ctx); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	seed := `
		INSERT INTO settings (id, weekly_workout_target, expense_categories, income_categories, font_scale, reduced_motion, monthly_budget_cents)
		VALUES ('default', 4, '[]', '[]', 'default', 0, 123456);
		INSERT INTO payment_orders (id, name, expected_total_cents, created_at)
		VALUES ('order-1', '笔记本', 1000000, '2026-09-17T00:00:00Z');
		INSERT INTO transactions (
			id, kind, amount_cents, category, date, note, tag, order_id, stage, source, source_trade_no,
			occurred_at, import_id, created_at
		) VALUES (
			'tx-1', 'expense', 250000, '电子设备', '2026-09-17', '定金', 'normal', 'order-1', 'deposit',
			'alipay', 'trade-1', '2026-09-17T10:00:00Z', 'import-1', '2026-09-17T10:00:00Z'
		);
		INSERT INTO recurring_transactions (id, name, kind, amount_cents, category, frequency, next_date, note, active, created_at)
		VALUES ('recurring-1', '房租', 'expense', 300000, '居住', 'monthly', '2026-10-01', '', 1, '2026-09-17T00:00:00Z');
		INSERT INTO bill_imports (id, source, file_name, imported_at)
		VALUES ('import-1', 'alipay', 'alipay.csv', '2026-09-17T00:00:00Z');
		INSERT INTO bill_import_transactions (import_id, transaction_id, sort_order) VALUES ('import-1', 'tx-1', 0);
		INSERT INTO learning_paths (id, title, target_minutes, created_at) VALUES ('path-1', 'Go 后端', 600, '2026-09-17T00:00:00Z');
		INSERT INTO learning_resources (id, path_id, title, kind, status, platform, source_url, external_id, target_minutes, created_at)
		VALUES ('resource-1', 'path-1', 'SQLite 入门', 'course', 'doing', 'bilibili', 'https://example.com', 'BV1', 180, '2026-09-17T00:00:00Z');
		INSERT INTO learning_lessons (id, resource_id, title, sort_order, status, expected_minutes, source_url, created_at)
		VALUES ('lesson-1', 'resource-1', '第一节', 0, 'doing', 30, '', '2026-09-17T00:00:00Z');
		INSERT INTO study_logs (id, topic, minutes, date, path_id, platform, resource_id, lesson_id, note, created_at)
		VALUES ('study-1', '迁移设计', 45, '2026-09-17', 'path-1', 'bilibili', 'resource-1', 'lesson-1', '完成字段映射', '2026-09-17T00:00:00Z');
		INSERT INTO learning_note_folders (id, name, created_at) VALUES ('folder-1', '后端', '2026-09-17T00:00:00Z');
		INSERT INTO learning_notes (id, folder_id, title, content, resource_id, lesson_id, updated_at, created_at)
		VALUES ('note-1', 'folder-1', '迁移笔记', '使用 UUID 主键', 'resource-1', 'lesson-1', '2026-09-17T01:00:00Z', '2026-09-17T00:00:00Z');
		INSERT INTO learning_note_tags (note_id, tag, sort_order) VALUES ('note-1', 'sqlite', 0);
		INSERT INTO weekly_reviews (id, week_start_date, wins, blockers, next_focus, created_at)
		VALUES ('review-1', '2026-09-14', '完成迁移', '时间有限', '写 API', '2026-09-17T00:00:00Z');
		INSERT INTO workouts (id, date, kind, status, duration_minutes, notes, plan, focus, warmup, finisher, soreness_areas, coach_notes, created_at)
		VALUES ('workout-1', '2026-09-17', 'back', 'completed', 60, '状态不错', '["高位下拉"]', '背部', '["泡沫轴"]', '["拉伸"]', '["背阔肌"]', '["保持节奏"]', '2026-09-17T00:00:00Z');
		INSERT INTO workout_kinds (workout_id, kind, sort_order) VALUES ('workout-1', 'back', 0);
		INSERT INTO workout_exercises (id, workout_id, name, prescription, target, sort_order)
		VALUES ('exercise-1', 'workout-1', '高位下拉', '12×4', '背阔', 0);
		INSERT INTO health_metrics (id, date, sleep_hours, weight_kg, condition, menstruation_flow, menstruation_symptoms, menstruation_note, created_at)
		VALUES ('metric-1', '2026-09-17', 7.5, 65.2, 'good', 'none', '["fatigue"]', '', '2026-09-17T00:00:00Z');
	`
	if _, err := st.db.ExecContext(ctx, seed); err != nil {
		t.Fatalf("seed: %v", err)
	}

	state, err := st.LoadState(ctx)
	if err != nil {
		t.Fatalf("load state: %v", err)
	}
	if state.MonthlyBudgetCents != 123456 {
		t.Fatalf("budget = %d", state.MonthlyBudgetCents)
	}
	if len(state.Transactions) != 1 || state.Transactions[0].OrderID == nil || *state.Transactions[0].OrderID != "order-1" {
		t.Fatalf("unexpected transactions: %+v", state.Transactions)
	}
	if len(state.PaymentOrders) != 1 || len(state.RecurringTransactions) != 1 {
		t.Fatalf("unexpected finance state: %+v %+v", state.PaymentOrders, state.RecurringTransactions)
	}
	if len(state.BillImports) != 1 || len(state.BillImports[0].TransactionIDs) != 1 {
		t.Fatalf("unexpected imports: %+v", state.BillImports)
	}
	if len(state.StudyLogs) != 1 || len(state.LearningPaths) != 1 || len(state.LearningResources) != 1 || len(state.LearningLessons) != 1 {
		t.Fatalf("unexpected learning records")
	}
	if len(state.LearningNoteFolders) != 1 || len(state.LearningNotes) != 1 || len(state.LearningNotes[0].Tags) != 1 {
		t.Fatalf("unexpected notes: %+v", state.LearningNotes)
	}
	if len(state.WeeklyReviews) != 1 {
		t.Fatalf("unexpected reviews: %+v", state.WeeklyReviews)
	}
	if len(state.Workouts) != 1 || len(state.Workouts[0].Kinds) != 1 || len(state.Workouts[0].Exercises) != 1 {
		t.Fatalf("unexpected workouts: %+v", state.Workouts)
	}
	if len(state.HealthMetrics) != 1 || state.HealthMetrics[0].WeightKg == nil || *state.HealthMetrics[0].WeightKg != 65.2 {
		t.Fatalf("unexpected metrics: %+v", state.HealthMetrics)
	}
}

func TestDomainUniqueConstraints(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "personal-os.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer st.Close()
	ctx := context.Background()
	if err := st.Migrate(ctx); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if _, err := st.db.ExecContext(ctx, `
		INSERT INTO health_metrics (id, date, sleep_hours, weight_kg, condition, created_at)
		VALUES ('metric-1', '2026-09-17', 7, NULL, 'good', '2026-09-17T00:00:00Z')
	`); err != nil {
		t.Fatalf("seed health metric: %v", err)
	}
	if _, err := st.db.ExecContext(ctx, `
		INSERT INTO health_metrics (id, date, sleep_hours, weight_kg, condition, created_at)
		VALUES ('metric-2', '2026-09-17', 6, NULL, 'good', '2026-09-17T00:00:00Z')
	`); err == nil {
		t.Fatal("expected duplicate health metric date to fail")
	}
}
