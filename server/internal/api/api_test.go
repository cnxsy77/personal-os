package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"personal-os/server/internal/api"
	"personal-os/server/internal/store"
)

func newTestServer(t *testing.T) http.Handler {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "personal-os.db")
	st, err := store.Open(dbPath)
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })
	if err := st.Migrate(context.Background()); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return api.New(st).Handler()
}

func request(t *testing.T, handler http.Handler, method, target string, body any, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		encoded, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		reader = bytes.NewReader(encoded)
	}
	req := httptest.NewRequest(method, target, reader)
	req.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)
	return recorder
}

func TestGetStateReturnsEmptyState(t *testing.T) {
	handler := newTestServer(t)
	response := request(t, handler, http.MethodGet, "/api/state", nil, nil)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}
	var state struct {
		Tasks    []any `json:"tasks"`
		Projects []any `json:"projects"`
		Settings struct {
			WeeklyWorkoutTarget int `json:"weeklyWorkoutTarget"`
		} `json:"settings"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &state); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(state.Tasks) != 0 || len(state.Projects) != 0 || state.Settings.WeeklyWorkoutTarget != 3 {
		t.Fatalf("unexpected empty state: %+v", state)
	}
}

func TestLocalDevelopmentOriginsAreAllowed(t *testing.T) {
	handler := newTestServer(t)
	for _, origin := range []string{
		"http://localhost:5173",
		"http://127.0.0.1:5175",
	} {
		response := request(t, handler, http.MethodGet, "/api/state", nil, map[string]string{
			"Origin": origin,
		})
		if response.Code != http.StatusOK {
			t.Fatalf("origin %s status = %d, body = %s", origin, response.Code, response.Body.String())
		}
	}

	rejected := request(t, handler, http.MethodGet, "/api/state", nil, map[string]string{
		"Origin": "https://example.com",
	})
	if rejected.Code != http.StatusForbidden {
		t.Fatalf("external origin status = %d", rejected.Code)
	}
}

func TestTaskLifecycleRequiresLocalClientHeader(t *testing.T) {
	handler := newTestServer(t)
	input := map[string]any{"title": " 复盘后端方案 ", "date": "2026-09-17", "category": "work"}
	rejected := request(t, handler, http.MethodPost, "/api/tasks", input, nil)
	if rejected.Code != http.StatusForbidden {
		t.Fatalf("missing header status = %d", rejected.Code)
	}

	headers := map[string]string{"X-Personal-OS-Client": "local"}
	created := request(t, handler, http.MethodPost, "/api/tasks", input, headers)
	if created.Code != http.StatusCreated {
		t.Fatalf("create status = %d, body = %s", created.Code, created.Body.String())
	}
	var state struct {
		Tasks []struct {
			ID       string `json:"id"`
			Title    string `json:"title"`
			Meta     string `json:"meta"`
			Category string `json:"category"`
		} `json:"tasks"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &state); err != nil {
		t.Fatalf("unmarshal created state: %v", err)
	}
	if len(state.Tasks) != 1 || state.Tasks[0].Title != "复盘后端方案" || !strings.Contains(state.Tasks[0].Meta, "2026-09-17") {
		t.Fatalf("unexpected tasks: %+v", state.Tasks)
	}
	id := state.Tasks[0].ID

	if failed := request(t, handler, http.MethodPost, "/api/tasks", map[string]any{"title": " ", "date": "bad", "category": "work"}, headers); failed.Code != http.StatusBadRequest {
		t.Fatalf("invalid task status = %d", failed.Code)
	}
	if toggled := request(t, handler, http.MethodPost, "/api/tasks/"+id+"/toggle", nil, headers); toggled.Code != http.StatusOK {
		t.Fatalf("toggle status = %d, body = %s", toggled.Code, toggled.Body.String())
	}
	if deleted := request(t, handler, http.MethodDelete, "/api/tasks/"+id, nil, headers); deleted.Code != http.StatusOK {
		t.Fatalf("delete status = %d", deleted.Code)
	}
}

func TestErrorsUseTheSharedJSONStructure(t *testing.T) {
	handler := newTestServer(t)
	headers := map[string]string{"X-Personal-OS-Client": "local"}

	invalid := request(t, handler, http.MethodPost, "/api/tasks", map[string]any{
		"title":    " ",
		"date":     "not-a-date",
		"category": "work",
	}, headers)
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid status = %d", invalid.Code)
	}
	assertErrorShape(t, invalid, "invalid_input")

	forbidden := request(t, handler, http.MethodGet, "/api/state", nil, map[string]string{
		"Origin": "https://example.com",
	})
	if forbidden.Code != http.StatusForbidden {
		t.Fatalf("forbidden status = %d", forbidden.Code)
	}
	assertErrorShape(t, forbidden, "forbidden_origin")
}

func assertErrorShape(t *testing.T, response *httptest.ResponseRecorder, code string) {
	t.Helper()
	var value struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &value); err != nil {
		t.Fatalf("unmarshal error body: %v", err)
	}
	if value.Code != code || value.Message == "" {
		t.Fatalf("unexpected error body: %+v", value)
	}
}

func TestProjectCRUDAndStatus(t *testing.T) {
	handler := newTestServer(t)
	headers := map[string]string{"X-Personal-OS-Client": "local"}
	input := map[string]any{"name": "Personal OS", "goal": "统一个人管理", "status": "active", "nextAction": "完成后端"}
	created := request(t, handler, http.MethodPost, "/api/projects", input, headers)
	if created.Code != http.StatusCreated {
		t.Fatalf("create status = %d, body = %s", created.Code, created.Body.String())
	}
	var state struct {
		Projects []struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		} `json:"projects"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &state); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(state.Projects) != 1 {
		t.Fatalf("unexpected projects: %+v", state.Projects)
	}
	id := state.Projects[0].ID
	statusBody := map[string]any{"status": "blocked"}
	if updated := request(t, handler, http.MethodPatch, "/api/projects/"+id+"/status", statusBody, headers); updated.Code != http.StatusOK {
		t.Fatalf("status update status = %d", updated.Code)
	}
	if deleted := request(t, handler, http.MethodDelete, "/api/projects/"+id, nil, headers); deleted.Code != http.StatusOK {
		t.Fatalf("delete status = %d", deleted.Code)
	}
}
