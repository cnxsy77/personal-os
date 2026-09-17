package api_test

import (
	"net/http"
	"testing"
)

func TestWorkoutAndHealthMetricWriteAPIs(t *testing.T) {
	handler := newTestServer(t)
	headers := map[string]string{"X-Personal-OS-Client": "local"}
	workoutInput := map[string]any{
		"date": "2026-09-18", "kind": "back", "kinds": []string{"back", "shoulders"},
		"status": "completed", "durationMinutes": 0, "notes": "状态不错",
		"focus": "背部", "warmup": []string{"泡沫轴松解背部"},
		"exercises": []any{
			map[string]any{"name": " 高位下拉 ", "prescription": "12×4", "target": "背阔"},
			map[string]any{"name": " ", "prescription": "12×4"},
		},
		"coachNotes": []string{"保持节奏"},
	}
	created := request(t, handler, http.MethodPost, "/api/workouts", workoutInput, headers)
	if created.Code != http.StatusCreated {
		t.Fatalf("create workout status = %d, body = %s", created.Code, created.Body.String())
	}
	state := decodeState(t, created)
	if len(state.Workouts) != 1 || len(state.Workouts[0].Kinds) != 2 || len(state.Workouts[0].Exercises) != 1 {
		t.Fatalf("unexpected workout state: %+v", state.Workouts)
	}
	workout := state.Workouts[0]
	if workout.DurationMinutes != 0 || workout.Kinds[1] != "shoulders" || workout.Exercises[0].Name != "高位下拉" {
		t.Fatalf("workout fields were not persisted correctly: %+v", workout)
	}

	workoutInput["date"] = "2026-09-19"
	workoutInput["kinds"] = []string{"back"}
	workoutInput["durationMinutes"] = 65
	updated := request(t, handler, http.MethodPatch, "/api/workouts/"+workout.ID, workoutInput, headers)
	if updated.Code != http.StatusOK {
		t.Fatalf("update workout status = %d, body = %s", updated.Code, updated.Body.String())
	}
	updatedState := decodeState(t, updated)
	if updatedState.Workouts[0].Date != "2026-09-19" || len(updatedState.Workouts[0].Kinds) != 1 || updatedState.Workouts[0].DurationMinutes != 65 {
		t.Fatalf("workout update failed: %+v", updatedState.Workouts[0])
	}

	status := request(t, handler, http.MethodPatch, "/api/workouts/"+workout.ID+"/status", map[string]any{"status": "planned"}, headers)
	if status.Code != http.StatusOK {
		t.Fatalf("status update status = %d", status.Code)
	}
	if got := decodeState(t, status); got.Workouts[0].Status != "planned" {
		t.Fatalf("status was not updated: %+v", got.Workouts[0])
	}

	firstMetric := request(t, handler, http.MethodPost, "/api/health-metrics", map[string]any{
		"date": "2026-09-18", "sleepHours": 7.54, "weightKg": 65.24, "condition": "good",
		"menstruationFlow": "light", "menstruationSymptoms": []string{"fatigue", "fatigue"},
		"menstruationNote": "状态稳定",
	}, headers)
	if firstMetric.Code != http.StatusCreated {
		t.Fatalf("save metric status = %d, body = %s", firstMetric.Code, firstMetric.Body.String())
	}
	metricState := decodeState(t, firstMetric)
	if len(metricState.HealthMetrics) != 1 || metricState.HealthMetrics[0].SleepHours != 7.5 {
		t.Fatalf("unexpected metric state: %+v", metricState.HealthMetrics)
	}
	metricID := metricState.HealthMetrics[0].ID
	secondMetric := request(t, handler, http.MethodPost, "/api/health-metrics", map[string]any{
		"date": "2026-09-18", "sleepHours": 8, "weightKg": nil, "condition": "great",
	}, headers)
	if secondMetric.Code != http.StatusCreated {
		t.Fatalf("upsert metric status = %d", secondMetric.Code)
	}
	upsertState := decodeState(t, secondMetric)
	if len(upsertState.HealthMetrics) != 1 || upsertState.HealthMetrics[0].ID != metricID || upsertState.HealthMetrics[0].Condition != "great" {
		t.Fatalf("same-date metric was not replaced: %+v", upsertState.HealthMetrics)
	}

	editMetric := request(t, handler, http.MethodPatch, "/api/health-metrics/"+metricID, map[string]any{
		"date": "2026-09-19", "sleepHours": 7, "weightKg": 65, "condition": "good",
		"menstruationSymptoms": []string{"cramps"},
	}, headers)
	if editMetric.Code != http.StatusOK {
		t.Fatalf("edit metric status = %d, body = %s", editMetric.Code, editMetric.Body.String())
	}

	invalid := request(t, handler, http.MethodPost, "/api/workouts", map[string]any{
		"date": "bad", "kind": "back", "kinds": []string{"back"}, "durationMinutes": 60,
	}, headers)
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid workout status = %d", invalid.Code)
	}
	deleted := request(t, handler, http.MethodDelete, "/api/workouts/"+workout.ID, nil, headers)
	if deleted.Code != http.StatusOK {
		t.Fatalf("delete workout status = %d", deleted.Code)
	}
	deletedMetric := request(t, handler, http.MethodDelete, "/api/health-metrics/"+metricID, nil, headers)
	if deletedMetric.Code != http.StatusOK {
		t.Fatalf("delete metric status = %d", deletedMetric.Code)
	}
	if missing := request(t, handler, http.MethodDelete, "/api/workouts/"+workout.ID, nil, headers); missing.Code != http.StatusNotFound {
		t.Fatalf("missing workout status = %d", missing.Code)
	}
}
