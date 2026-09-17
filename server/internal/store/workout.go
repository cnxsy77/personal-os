package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"math"

	"github.com/google/uuid"

	"personal-os/server/internal/model"
)

func (s *Store) RecordWorkout(ctx context.Context, input model.WorkoutInput) error {
	workout, err := buildWorkout(uuid.NewString(), input)
	if err != nil {
		return err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := saveWorkout(ctx, tx, workout); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) UpdateWorkout(ctx context.Context, id string, input model.WorkoutInput) error {
	workout, err := buildWorkout(id, input)
	if err != nil {
		return err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var exists string
	err = tx.QueryRowContext(ctx, `SELECT id FROM workouts WHERE id = ?`, id).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New("训练记录不存在")
	}
	if err != nil {
		return err
	}
	if err := saveWorkout(ctx, tx, workout); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) DeleteWorkout(ctx context.Context, id string) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM workouts WHERE id = ?`, id)
	return checkAffected(result, err, "训练记录不存在")
}

func (s *Store) SetWorkoutStatus(ctx context.Context, id string, status model.WorkoutStatus) error {
	if !isWorkoutStatus(string(status)) {
		return errors.New("请选择有效的训练状态")
	}
	result, err := s.db.ExecContext(ctx, `UPDATE workouts SET status = ? WHERE id = ?`, string(status), id)
	return checkAffected(result, err, "训练记录不存在")
}

func (s *Store) SaveHealthMetric(ctx context.Context, input model.HealthMetricInput) error {
	metric, err := buildHealthMetric(uuid.NewString(), input)
	if err != nil {
		return err
	}
	var existingID string
	err = s.db.QueryRowContext(ctx, `SELECT id FROM health_metrics WHERE date = ?`, metric.Date).Scan(&existingID)
	if err == nil {
		metric.ID = existingID
		return s.updateHealthMetricByID(ctx, metric)
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	weight := nullFloat(metric.WeightKg)
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO health_metrics (
			id, date, sleep_hours, weight_kg, condition, menstruation_flow,
			menstruation_symptoms, menstruation_note, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, metric.ID, metric.Date, metric.SleepHours, weight, string(metric.Condition),
		nullStringFromValue(metric.MenstruationFlow), stringListOrNull(metric.MenstruationSymptoms),
		nullStringFromValue(metric.MenstruationNote), nowTimestamp())
	return err
}

func (s *Store) UpdateHealthMetric(ctx context.Context, id string, input model.HealthMetricInput) error {
	var exists string
	err := s.db.QueryRowContext(ctx, `SELECT id FROM health_metrics WHERE id = ?`, id).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New("身体指标记录不存在")
	}
	if err != nil {
		return err
	}
	metric, err := buildHealthMetric(id, input)
	if err != nil {
		return err
	}
	var duplicateID string
	err = s.db.QueryRowContext(ctx, `SELECT id FROM health_metrics WHERE date = ? AND id <> ?`, metric.Date, id).Scan(&duplicateID)
	if err == nil {
		return errors.New("该日期的身体指标记录已存在")
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	return s.updateHealthMetricByID(ctx, metric)
}

func (s *Store) updateHealthMetricByID(ctx context.Context, metric model.HealthMetric) error {
	result, err := s.db.ExecContext(ctx, `
		UPDATE health_metrics SET date = ?, sleep_hours = ?, weight_kg = ?, condition = ?,
		  menstruation_flow = ?, menstruation_symptoms = ?, menstruation_note = ?
		WHERE id = ?
	`, metric.Date, metric.SleepHours, nullFloat(metric.WeightKg), string(metric.Condition),
		nullStringFromValue(metric.MenstruationFlow), stringListOrNull(metric.MenstruationSymptoms),
		nullStringFromValue(metric.MenstruationNote), metric.ID)
	return checkAffected(result, err, "身体指标记录不存在")
}

func (s *Store) DeleteHealthMetric(ctx context.Context, id string) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM health_metrics WHERE id = ?`, id)
	return checkAffected(result, err, "身体指标记录不存在")
}

func buildWorkout(id string, input model.WorkoutInput) (model.Workout, error) {
	if !isValidDate(input.Date) {
		return model.Workout{}, errors.New("请选择有效的训练日期")
	}
	if !isSelectableWorkoutKind(string(input.Kind)) {
		return model.Workout{}, errors.New("请选择有效的训练类型")
	}
	if len(input.Kinds) == 0 {
		return model.Workout{}, errors.New("请选择至少一个训练类型")
	}
	for _, kind := range input.Kinds {
		if !isSelectableWorkoutKind(string(kind)) {
			return model.Workout{}, errors.New("请选择有效的训练类型")
		}
	}
	kinds := uniqueWorkoutKinds(input.Kinds)
	if input.Status != "" && !isWorkoutStatus(string(input.Status)) {
		return model.Workout{}, errors.New("请选择有效的训练状态")
	}
	if input.DurationMinutes < 0 || input.DurationMinutes > 600 {
		return model.Workout{}, errors.New("训练时长必须在 0 到 600 分钟之间")
	}

	status := input.Status
	if status == "" {
		status = model.WorkoutStatus("completed")
	}
	workout := model.Workout{
		ID: id, Date: input.Date, Kind: kinds[0], Kinds: kinds, Status: status,
		DurationMinutes: input.DurationMinutes, Notes: cleanString(input.Notes),
	}
	if focus := cleanString(input.Focus); focus != "" {
		workout.Focus = focus
	}
	if warmup := cleanStringList(input.Warmup); len(warmup) > 0 {
		workout.Warmup = warmup
	}
	if exercises := cleanWorkoutExercises(input.Exercises); len(exercises) > 0 {
		workout.Exercises = exercises
	}
	if plan := cleanStringList(input.Plan); len(plan) > 0 {
		workout.Plan = plan
	}
	if finisher := cleanStringList(input.Finisher); len(finisher) > 0 {
		workout.Finisher = finisher
	}
	if soreness := cleanStringList(input.SorenessAreas); len(soreness) > 0 {
		workout.SorenessAreas = soreness
	}
	if coachNotes := cleanStringList(input.CoachNotes); len(coachNotes) > 0 {
		workout.CoachNotes = coachNotes
	}
	return workout, nil
}

func saveWorkout(ctx context.Context, tx *sql.Tx, workout model.Workout) error {
	plan, err := json.Marshal(workout.Plan)
	if err != nil {
		return err
	}
	warmup, err := json.Marshal(workout.Warmup)
	if err != nil {
		return err
	}
	finisher, err := json.Marshal(workout.Finisher)
	if err != nil {
		return err
	}
	soreness, err := json.Marshal(workout.SorenessAreas)
	if err != nil {
		return err
	}
	coachNotes, err := json.Marshal(workout.CoachNotes)
	if err != nil {
		return err
	}

	if _, err = tx.ExecContext(ctx, `
		INSERT INTO workouts (
			id, date, kind, status, duration_minutes, notes, plan, focus, warmup,
			finisher, soreness_areas, coach_notes, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			date = excluded.date, kind = excluded.kind, status = excluded.status,
			duration_minutes = excluded.duration_minutes, notes = excluded.notes,
			plan = excluded.plan, focus = excluded.focus, warmup = excluded.warmup,
			finisher = excluded.finisher, soreness_areas = excluded.soreness_areas,
			coach_notes = excluded.coach_notes
	`, workout.ID, workout.Date, string(workout.Kind), string(workout.Status), workout.DurationMinutes,
		workout.Notes, jsonStringOrNull(plan), nullStringFromValue(workout.Focus), jsonStringOrNull(warmup),
		jsonStringOrNull(finisher), jsonStringOrNull(soreness), jsonStringOrNull(coachNotes), nowTimestamp()); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM workout_kinds WHERE workout_id = ?`, workout.ID); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM workout_exercises WHERE workout_id = ?`, workout.ID); err != nil {
		return err
	}
	for index, kind := range workout.Kinds {
		if _, err = tx.ExecContext(ctx, `
			INSERT INTO workout_kinds (workout_id, kind, sort_order) VALUES (?, ?, ?)
		`, workout.ID, string(kind), index); err != nil {
			return err
		}
	}
	for index, exercise := range workout.Exercises {
		if _, err = tx.ExecContext(ctx, `
			INSERT INTO workout_exercises (id, workout_id, name, prescription, target, sort_order)
			VALUES (?, ?, ?, ?, ?, ?)
		`, uuid.NewString(), workout.ID, exercise.Name, nullStringFromValue(exercise.Prescription),
			nullStringFromValue(exercise.Target), index); err != nil {
			return err
		}
	}
	return nil
}

func buildHealthMetric(id string, input model.HealthMetricInput) (model.HealthMetric, error) {
	if !isValidDate(input.Date) {
		return model.HealthMetric{}, errors.New("请选择有效的记录日期")
	}
	if input.SleepHours < 0 || input.SleepHours > 24 || math.IsNaN(input.SleepHours) || math.IsInf(input.SleepHours, 0) {
		return model.HealthMetric{}, errors.New("睡眠时长必须在 0 到 24 小时之间")
	}
	if input.WeightKg != nil && (*input.WeightKg < 20 || *input.WeightKg > 300 || math.IsNaN(*input.WeightKg) || math.IsInf(*input.WeightKg, 0)) {
		return model.HealthMetric{}, errors.New("体重必须在 20 到 300 公斤之间")
	}
	if !isHealthCondition(string(input.Condition)) {
		return model.HealthMetric{}, errors.New("请选择有效的身体状态")
	}
	if input.MenstruationFlow != "" && !isMenstruationFlow(input.MenstruationFlow) {
		return model.HealthMetric{}, errors.New("请选择有效的月经流量")
	}
	for _, symptom := range input.MenstruationSymptoms {
		if !isMenstruationSymptom(symptom) {
			return model.HealthMetric{}, errors.New("请选择有效的月经症状")
		}
	}

	metric := model.HealthMetric{
		ID: id, Date: input.Date, SleepHours: roundHalfTenth(input.SleepHours),
		Condition: input.Condition,
	}
	if input.WeightKg != nil {
		weight := roundHalfTenth(*input.WeightKg)
		metric.WeightKg = &weight
	}
	metric.MenstruationFlow = input.MenstruationFlow
	metric.MenstruationSymptoms = cleanStringList(input.MenstruationSymptoms)
	metric.MenstruationNote = cleanString(input.MenstruationNote)
	return metric, nil
}

func uniqueWorkoutKinds(values []model.WorkoutKind) []model.WorkoutKind {
	result := make([]model.WorkoutKind, 0, len(values))
	for _, value := range values {
		if !containsValue(result, value) {
			result = append(result, value)
		}
	}
	return result
}

func cleanWorkoutExercises(values []model.WorkoutExercise) []model.WorkoutExercise {
	result := make([]model.WorkoutExercise, 0, len(values))
	for _, value := range values {
		name := cleanString(value.Name)
		if name == "" {
			continue
		}
		item := model.WorkoutExercise{Name: name}
		if prescription := cleanString(value.Prescription); prescription != "" {
			item.Prescription = prescription
		}
		if target := cleanString(value.Target); target != "" {
			item.Target = target
		}
		result = append(result, item)
	}
	return result
}

func isSelectableWorkoutKind(value string) bool {
	switch value {
	case "glutes", "legs", "shoulders", "chest", "back", "cardio":
		return true
	default:
		return false
	}
}

func isWorkoutStatus(value string) bool {
	return value == "planned" || value == "completed" || value == "skipped"
}

func isHealthCondition(value string) bool {
	return value == "great" || value == "good" || value == "fair" || value == "tired"
}

func isMenstruationFlow(value string) bool {
	return value == "none" || value == "spotting" || value == "light" || value == "medium" || value == "heavy"
}

func isMenstruationSymptom(value string) bool {
	switch value {
	case "cramps", "bloating", "headache", "breastTenderness", "fatigue", "moodChanges":
		return true
	default:
		return false
	}
}

func roundHalfTenth(value float64) float64 {
	return math.Round(value*10) / 10
}

func nullFloat(value *float64) any {
	if value == nil {
		return nil
	}
	return *value
}

func jsonStringOrNull(value []byte) any {
	if len(value) == 0 || string(value) == "null" || string(value) == "[]" {
		return nil
	}
	return string(value)
}

func stringListOrNull(values []string) any {
	if len(values) == 0 {
		return nil
	}
	encoded, err := json.Marshal(values)
	if err != nil {
		return nil
	}
	return string(encoded)
}
