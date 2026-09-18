package store

import (
	"context"
	"database/sql"
	"encoding/json"

	"personal-os/server/internal/model"
)

func nullableString(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	copied := value.String
	return &copied
}

func nullableInt(value sql.NullInt64) *int {
	if !value.Valid {
		return nil
	}
	copied := int(value.Int64)
	return &copied
}

func nullableFloat(value sql.NullFloat64) *float64 {
	if !value.Valid {
		return nil
	}
	copied := value.Float64
	return &copied
}

func decodeStringList(value sql.NullString) []string {
	result := []string{}
	if value.Valid && value.String != "" {
		_ = json.Unmarshal([]byte(value.String), &result)
	}
	return result
}

func (s *Store) loadDomainState(ctx context.Context, state *model.State) error {
	if err := s.loadTransactions(ctx, state); err != nil {
		return err
	}
	if err := s.loadPaymentOrders(ctx, state); err != nil {
		return err
	}
	if err := s.loadRecurring(ctx, state); err != nil {
		return err
	}
	if err := s.loadBillImports(ctx, state); err != nil {
		return err
	}
	if err := s.loadStudyLogs(ctx, state); err != nil {
		return err
	}
	if err := s.loadLearningPaths(ctx, state); err != nil {
		return err
	}
	if err := s.loadLearningResources(ctx, state); err != nil {
		return err
	}
	if err := s.loadLearningLessons(ctx, state); err != nil {
		return err
	}
	if err := s.loadNoteFolders(ctx, state); err != nil {
		return err
	}
	if err := s.loadNotes(ctx, state); err != nil {
		return err
	}
	if err := s.loadWeeklyReviews(ctx, state); err != nil {
		return err
	}
	if err := s.loadWorkouts(ctx, state); err != nil {
		return err
	}
	if err := s.loadHealthMetrics(ctx, state); err != nil {
		return err
	}
	return s.loadAISummaries(ctx, state)
}

func (s *Store) loadTransactions(ctx context.Context, state *model.State) error {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, kind, amount_cents, category, date, note, tag, order_id, stage,
		       recurring_id, related_transaction_id, counterparty, source,
		       source_trade_no, occurred_at, import_id
		FROM transactions ORDER BY date DESC, created_at DESC, id DESC
	`)
	if err != nil {
		return err
	}
	defer rows.Close()
	state.Transactions = []model.Transaction{}
	for rows.Next() {
		var item model.Transaction
		var note, tag, orderID, stage, recurringID, relatedID, counterparty, source, tradeNo, occurredAt, importID sql.NullString
		if err := rows.Scan(&item.ID, &item.Kind, &item.AmountCents, &item.Category, &item.Date, &note, &tag, &orderID, &stage, &recurringID, &relatedID, &counterparty, &source, &tradeNo, &occurredAt, &importID); err != nil {
			return err
		}
		item.Note = note.String
		item.Tag = model.TransactionTag(tag.String)
		item.OrderID = nullableString(orderID)
		item.Stage = model.PaymentStage(stage.String)
		item.RecurringID = nullableString(recurringID)
		item.RelatedTransactionID = nullableString(relatedID)
		item.Counterparty = counterparty.String
		item.Source = model.BillSource(source.String)
		item.SourceTradeNo = tradeNo.String
		item.OccurredAt = occurredAt.String
		item.ImportID = nullableString(importID)
		state.Transactions = append(state.Transactions, item)
	}
	return rows.Err()
}

func (s *Store) loadPaymentOrders(ctx context.Context, state *model.State) error {
	rows, err := s.db.QueryContext(ctx, `SELECT id, name, expected_total_cents, created_at FROM payment_orders ORDER BY created_at DESC, id DESC`)
	if err != nil {
		return err
	}
	defer rows.Close()
	state.PaymentOrders = []model.PaymentOrder{}
	for rows.Next() {
		var item model.PaymentOrder
		if err := rows.Scan(&item.ID, &item.Name, &item.ExpectedTotalCents, &item.CreatedAt); err != nil {
			return err
		}
		state.PaymentOrders = append(state.PaymentOrders, item)
	}
	return rows.Err()
}

func (s *Store) loadRecurring(ctx context.Context, state *model.State) error {
	rows, err := s.db.QueryContext(ctx, `SELECT id, name, kind, amount_cents, category, frequency, next_date, note, active FROM recurring_transactions ORDER BY created_at DESC, id DESC`)
	if err != nil {
		return err
	}
	defer rows.Close()
	state.RecurringTransactions = []model.Recurring{}
	for rows.Next() {
		var item model.Recurring
		var note sql.NullString
		var active int
		if err := rows.Scan(&item.ID, &item.Name, &item.Kind, &item.AmountCents, &item.Category, &item.Frequency, &item.NextDate, &note, &active); err != nil {
			return err
		}
		item.Note = note.String
		item.Active = active == 1
		state.RecurringTransactions = append(state.RecurringTransactions, item)
	}
	return rows.Err()
}

func (s *Store) loadBillImports(ctx context.Context, state *model.State) error {
	rows, err := s.db.QueryContext(ctx, `SELECT id, source, file_name, imported_at FROM bill_imports ORDER BY imported_at DESC, id DESC`)
	if err != nil {
		return err
	}
	defer rows.Close()
	state.BillImports = []model.BillImport{}
	indexes := map[string]int{}
	for rows.Next() {
		var item model.BillImport
		if err := rows.Scan(&item.ID, &item.Source, &item.FileName, &item.ImportedAt); err != nil {
			return err
		}
		item.TransactionIDs = []string{}
		indexes[item.ID] = len(state.BillImports)
		state.BillImports = append(state.BillImports, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	childRows, err := s.db.QueryContext(ctx, `SELECT import_id, transaction_id FROM bill_import_transactions ORDER BY import_id, sort_order`)
	if err != nil {
		return err
	}
	defer childRows.Close()
	for childRows.Next() {
		var importID, transactionID string
		if err := childRows.Scan(&importID, &transactionID); err != nil {
			return err
		}
		if index, ok := indexes[importID]; ok {
			state.BillImports[index].TransactionIDs = append(state.BillImports[index].TransactionIDs, transactionID)
		}
	}
	return childRows.Err()
}

func (s *Store) loadStudyLogs(ctx context.Context, state *model.State) error {
	rows, err := s.db.QueryContext(ctx, `SELECT id, topic, minutes, date, path_id, platform, resource_id, lesson_id, note FROM study_logs ORDER BY date DESC, created_at DESC, id DESC`)
	if err != nil {
		return err
	}
	defer rows.Close()
	state.StudyLogs = []model.StudyLog{}
	for rows.Next() {
		var item model.StudyLog
		var pathID, platform, resourceID, lessonID, note sql.NullString
		if err := rows.Scan(&item.ID, &item.Topic, &item.Minutes, &item.Date, &pathID, &platform, &resourceID, &lessonID, &note); err != nil {
			return err
		}
		item.PathID = nullableString(pathID)
		item.Platform = model.LearningPlatform(platform.String)
		item.ResourceID = nullableString(resourceID)
		item.LessonID = nullableString(lessonID)
		item.Note = note.String
		state.StudyLogs = append(state.StudyLogs, item)
	}
	return rows.Err()
}

func (s *Store) loadLearningPaths(ctx context.Context, state *model.State) error {
	rows, err := s.db.QueryContext(ctx, `SELECT id, title, target_minutes FROM learning_paths ORDER BY created_at DESC, id DESC`)
	if err != nil {
		return err
	}
	defer rows.Close()
	state.LearningPaths = []model.LearningPath{}
	for rows.Next() {
		var item model.LearningPath
		if err := rows.Scan(&item.ID, &item.Title, &item.TargetMinutes); err != nil {
			return err
		}
		state.LearningPaths = append(state.LearningPaths, item)
	}
	return rows.Err()
}

func (s *Store) loadLearningResources(ctx context.Context, state *model.State) error {
	rows, err := s.db.QueryContext(ctx, `SELECT id, path_id, title, kind, status, platform, source_url, external_id, target_minutes FROM learning_resources ORDER BY created_at DESC, id DESC`)
	if err != nil {
		return err
	}
	defer rows.Close()
	state.LearningResources = []model.LearningResource{}
	for rows.Next() {
		var item model.LearningResource
		var pathID, platform, sourceURL, externalID sql.NullString
		var targetMinutes sql.NullInt64
		if err := rows.Scan(&item.ID, &pathID, &item.Title, &item.Kind, &item.Status, &platform, &sourceURL, &externalID, &targetMinutes); err != nil {
			return err
		}
		item.PathID = nullableString(pathID)
		item.Platform = model.LearningPlatform(platform.String)
		item.SourceURL = sourceURL.String
		item.ExternalID = externalID.String
		item.TargetMinutes = nullableInt(targetMinutes)
		state.LearningResources = append(state.LearningResources, item)
	}
	return rows.Err()
}

func (s *Store) loadLearningLessons(ctx context.Context, state *model.State) error {
	rows, err := s.db.QueryContext(ctx, `SELECT id, resource_id, title, sort_order, status, expected_minutes, source_url FROM learning_lessons ORDER BY resource_id, sort_order, id`)
	if err != nil {
		return err
	}
	defer rows.Close()
	state.LearningLessons = []model.LearningLesson{}
	for rows.Next() {
		var item model.LearningLesson
		var expectedMinutes sql.NullInt64
		var sourceURL sql.NullString
		if err := rows.Scan(&item.ID, &item.ResourceID, &item.Title, &item.SortOrder, &item.Status, &expectedMinutes, &sourceURL); err != nil {
			return err
		}
		item.ExpectedMinutes = nullableInt(expectedMinutes)
		item.SourceURL = sourceURL.String
		state.LearningLessons = append(state.LearningLessons, item)
	}
	return rows.Err()
}

func (s *Store) loadNoteFolders(ctx context.Context, state *model.State) error {
	rows, err := s.db.QueryContext(ctx, `SELECT id, name, created_at FROM learning_note_folders ORDER BY created_at, id`)
	if err != nil {
		return err
	}
	defer rows.Close()
	state.LearningNoteFolders = []model.NoteFolder{}
	for rows.Next() {
		var item model.NoteFolder
		if err := rows.Scan(&item.ID, &item.Name, &item.CreatedAt); err != nil {
			return err
		}
		state.LearningNoteFolders = append(state.LearningNoteFolders, item)
	}
	return rows.Err()
}

func (s *Store) loadNotes(ctx context.Context, state *model.State) error {
	rows, err := s.db.QueryContext(ctx, `SELECT id, folder_id, title, content, resource_id, lesson_id, updated_at FROM learning_notes ORDER BY updated_at DESC, id DESC`)
	if err != nil {
		return err
	}
	defer rows.Close()
	state.LearningNotes = []model.Note{}
	indexes := map[string]int{}
	for rows.Next() {
		var item model.Note
		var folderID, resourceID, lessonID sql.NullString
		if err := rows.Scan(&item.ID, &folderID, &item.Title, &item.Content, &resourceID, &lessonID, &item.UpdatedAt); err != nil {
			return err
		}
		item.FolderID = nullableString(folderID)
		item.ResourceID = nullableString(resourceID)
		item.LessonID = nullableString(lessonID)
		item.Tags = []string{}
		indexes[item.ID] = len(state.LearningNotes)
		state.LearningNotes = append(state.LearningNotes, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	tagRows, err := s.db.QueryContext(ctx, `SELECT note_id, tag FROM learning_note_tags ORDER BY note_id, sort_order`)
	if err != nil {
		return err
	}
	defer tagRows.Close()
	for tagRows.Next() {
		var noteID, tag string
		if err := tagRows.Scan(&noteID, &tag); err != nil {
			return err
		}
		if index, ok := indexes[noteID]; ok {
			state.LearningNotes[index].Tags = append(state.LearningNotes[index].Tags, tag)
		}
	}
	return tagRows.Err()
}

func (s *Store) loadWeeklyReviews(ctx context.Context, state *model.State) error {
	rows, err := s.db.QueryContext(ctx, `SELECT id, week_start_date, wins, blockers, next_focus FROM weekly_reviews ORDER BY week_start_date DESC`)
	if err != nil {
		return err
	}
	defer rows.Close()
	state.WeeklyReviews = []model.WeeklyReview{}
	for rows.Next() {
		var item model.WeeklyReview
		if err := rows.Scan(&item.ID, &item.WeekStartDate, &item.Wins, &item.Blockers, &item.NextFocus); err != nil {
			return err
		}
		state.WeeklyReviews = append(state.WeeklyReviews, item)
	}
	return rows.Err()
}

func (s *Store) loadWorkouts(ctx context.Context, state *model.State) error {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, date, kind, status, duration_minutes, notes, plan, focus, warmup, finisher, soreness_areas, coach_notes
		FROM workouts ORDER BY date DESC, created_at DESC, id DESC
	`)
	if err != nil {
		return err
	}
	defer rows.Close()
	state.Workouts = []model.Workout{}
	indexes := map[string]int{}
	for rows.Next() {
		var item model.Workout
		var status, focus, plan, warmup, finisher, soreness, coachNotes sql.NullString
		if err := rows.Scan(&item.ID, &item.Date, &item.Kind, &status, &item.DurationMinutes, &item.Notes, &plan, &focus, &warmup, &finisher, &soreness, &coachNotes); err != nil {
			return err
		}
		item.Status = model.WorkoutStatus(status.String)
		item.Focus = focus.String
		item.Plan = decodeStringList(plan)
		item.Warmup = decodeStringList(warmup)
		item.Finisher = decodeStringList(finisher)
		item.SorenessAreas = decodeStringList(soreness)
		item.CoachNotes = decodeStringList(coachNotes)
		item.Kinds = []model.WorkoutKind{}
		item.Exercises = []model.WorkoutExercise{}
		indexes[item.ID] = len(state.Workouts)
		state.Workouts = append(state.Workouts, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return s.loadWorkoutChildren(ctx, indexes, state.Workouts)
}

func (s *Store) loadWorkoutChildren(ctx context.Context, indexes map[string]int, workouts []model.Workout) error {
	kindRows, err := s.db.QueryContext(ctx, `SELECT workout_id, kind FROM workout_kinds ORDER BY workout_id, sort_order`)
	if err != nil {
		return err
	}
	defer kindRows.Close()
	for kindRows.Next() {
		var workoutID string
		var kind model.WorkoutKind
		if err := kindRows.Scan(&workoutID, &kind); err != nil {
			return err
		}
		if index, ok := indexes[workoutID]; ok {
			workouts[index].Kinds = append(workouts[index].Kinds, kind)
		}
	}
	if err := kindRows.Err(); err != nil {
		return err
	}

	exerciseRows, err := s.db.QueryContext(ctx, `SELECT workout_id, name, prescription, target FROM workout_exercises ORDER BY workout_id, sort_order`)
	if err != nil {
		return err
	}
	defer exerciseRows.Close()
	for exerciseRows.Next() {
		var workoutID string
		var item model.WorkoutExercise
		var prescription, target sql.NullString
		if err := exerciseRows.Scan(&workoutID, &item.Name, &prescription, &target); err != nil {
			return err
		}
		item.Prescription = prescription.String
		item.Target = target.String
		if index, ok := indexes[workoutID]; ok {
			workouts[index].Exercises = append(workouts[index].Exercises, item)
		}
	}
	return exerciseRows.Err()
}

func (s *Store) loadHealthMetrics(ctx context.Context, state *model.State) error {
	rows, err := s.db.QueryContext(ctx, `SELECT id, date, sleep_hours, weight_kg, condition, menstruation_flow, menstruation_symptoms, menstruation_note FROM health_metrics ORDER BY date DESC`)
	if err != nil {
		return err
	}
	defer rows.Close()
	state.HealthMetrics = []model.HealthMetric{}
	for rows.Next() {
		var item model.HealthMetric
		var weight sql.NullFloat64
		var flow, symptoms, note sql.NullString
		if err := rows.Scan(&item.ID, &item.Date, &item.SleepHours, &weight, &item.Condition, &flow, &symptoms, &note); err != nil {
			return err
		}
		item.WeightKg = nullableFloat(weight)
		item.MenstruationFlow = flow.String
		item.MenstruationSymptoms = decodeStringList(symptoms)
		item.MenstruationNote = note.String
		state.HealthMetrics = append(state.HealthMetrics, item)
	}
	return rows.Err()
}
