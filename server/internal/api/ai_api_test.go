package api_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"personal-os/server/internal/ai"
	"personal-os/server/internal/api"
	"personal-os/server/internal/model"
	"personal-os/server/internal/store"
)

type fakeAIClient struct {
	config   ai.Config
	response ai.CompletionResponse
	err      error
	requests []ai.CompletionRequest
}

func (client *fakeAIClient) Complete(_ context.Context, request ai.CompletionRequest) (ai.CompletionResponse, error) {
	client.requests = append(client.requests, request)
	return client.response, client.err
}

func (client *fakeAIClient) Config() ai.Config {
	return client.config
}

func newTestServerWithAI(t *testing.T, client ai.Client) (http.Handler, *store.Store) {
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
	handler := api.New(
		st,
		api.WithAIClient(client),
		api.WithReportsDir(filepath.Join(t.TempDir(), "reports")),
	).Handler()
	return handler, st
}

func TestAIConfigDoesNotExposeSecret(t *testing.T) {
	handler, _ := newTestServerWithAI(t, &fakeAIClient{config: ai.Config{
		BaseURL:         "http://127.0.0.1/v1",
		APIKey:          "secret-key",
		Model:           "test-model",
		MaxOutputTokens: 900,
		TimeoutSeconds:  20,
	}})

	response := request(t, handler, http.MethodGet, "/api/ai/config", nil, nil)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}
	if response.Body.String() == "" || containsAll(response.Body.String(), []string{"secret-key", "APIKey"}) {
		t.Fatalf("secret exposed: %s", response.Body.String())
	}
}

func TestAISummaryLifecycleUsesLocalDataAndMarkdown(t *testing.T) {
	client := &fakeAIClient{
		config: ai.Config{BaseURL: "http://127.0.0.1/v1", APIKey: "secret", Model: "test-model"},
		response: ai.CompletionResponse{
			Content:          "## 当前状态\n- 记录正常",
			Model:            "test-model",
			PromptTokens:     21,
			CompletionTokens: 12,
			TotalTokens:      33,
		},
	}
	handler, st := newTestServerWithAI(t, client)
	if err := st.CreateProject(context.Background(), model.ProjectInput{
		Name:       "唯一项目上下文",
		Goal:       "验证 AI 上下文",
		Status:     model.ProjectStatus("active"),
		NextAction: "检查后端",
	}); err != nil {
		t.Fatalf("seed project: %v", err)
	}
	headers := map[string]string{"X-Personal-OS-Client": "local"}

	created := request(t, handler, http.MethodPost, "/api/ai/summaries", map[string]any{
		"period": "daily", "scope": "all",
	}, headers)
	if created.Code != http.StatusCreated {
		t.Fatalf("create status = %d, body = %s", created.Code, created.Body.String())
	}
	var result struct {
		Summary model.AISummary `json:"summary"`
		State   struct {
			AISummaries []model.AISummary `json:"aiSummaries"`
		} `json:"state"`
	}
	decodeJSON(t, created, &result)
	if len(result.State.AISummaries) != 1 || result.Summary.ID == "" {
		t.Fatalf("summary not persisted: %+v", result)
	}
	if len(client.requests) != 1 || !containsAll(client.requests[0].UserPrompt, []string{"唯一项目上下文", "## 当前状态"}) {
		t.Fatalf("unexpected AI request: %+v", client.requests)
	}

	updated := request(t, handler, http.MethodPatch, "/api/ai/summaries/"+result.Summary.ID, map[string]any{
		"title": "手动总结", "content": "## 下一步行动\n- 更新计划",
	}, headers)
	if updated.Code != http.StatusOK {
		t.Fatalf("update status = %d, body = %s", updated.Code, updated.Body.String())
	}
	var updatedResult struct {
		Summary model.AISummary `json:"summary"`
	}
	decodeJSON(t, updated, &updatedResult)
	if updatedResult.Summary.Title != "手动总结" || updatedResult.Summary.Content != "## 下一步行动\n- 更新计划" {
		t.Fatalf("summary not updated: %+v", updatedResult.Summary)
	}

	exported := request(t, handler, http.MethodPost, "/api/ai/summaries/"+result.Summary.ID+"/export", nil, headers)
	if exported.Code != http.StatusOK {
		t.Fatalf("export status = %d, body = %s", exported.Code, exported.Body.String())
	}
	var exportedResult struct {
		Summary model.AISummary `json:"summary"`
	}
	decodeJSON(t, exported, &exportedResult)
	if exportedResult.Summary.FilePath == nil {
		t.Fatal("export path missing")
	}
	content, err := os.ReadFile(*exportedResult.Summary.FilePath)
	if err != nil {
		t.Fatalf("read exported file: %v", err)
	}
	if !containsAll(string(content), []string{"summaryId", "manual summary", "## 下一步行动"}) && !containsAll(string(content), []string{"手动总结", "## 下一步行动"}) {
		t.Fatalf("unexpected markdown: %s", string(content))
	}

	deleted := request(t, handler, http.MethodDelete, "/api/ai/summaries/"+result.Summary.ID, nil, headers)
	if deleted.Code != http.StatusOK {
		t.Fatalf("delete status = %d, body = %s", deleted.Code, deleted.Body.String())
	}
	if _, err := os.Stat(*exportedResult.Summary.FilePath); !os.IsNotExist(err) {
		t.Fatalf("exported file still exists: %v", err)
	}
	state, err := st.LoadState(context.Background())
	if err != nil || len(state.AISummaries) != 0 {
		t.Fatalf("summary still persisted: %+v, %v", state.AISummaries, err)
	}
}

func TestAISummaryRequiresConfiguredProvider(t *testing.T) {
	handler, _ := newTestServerWithAI(t, &fakeAIClient{
		config: ai.Config{BaseURL: "http://127.0.0.1/v1", Model: "test-model"},
		err:    errors.New("AI 服务未配置，请在本机环境变量或 server/.env 中设置 PERSONAL_OS_AI_API_KEY"),
	})
	headers := map[string]string{"X-Personal-OS-Client": "local"}

	response := request(t, handler, http.MethodPost, "/api/ai/summaries", map[string]any{
		"period": "daily", "scope": "all",
	}, headers)
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}
	assertErrorShape(t, response, "ai_not_configured")
}

func TestAIChatUsesSummaryContext(t *testing.T) {
	client := &fakeAIClient{
		config: ai.Config{BaseURL: "http://127.0.0.1/v1", APIKey: "secret", Model: "test-model"},
		response: ai.CompletionResponse{
			Content: "建议今天完成唯一任务上下文", Model: "test-model", TotalTokens: 44,
		},
	}
	handler, st := newTestServerWithAI(t, client)
	if err := st.CreateProject(context.Background(), model.ProjectInput{
		Name: "唯一项目上下文", Goal: "验证 AI 上下文", Status: model.ProjectStatus("active"), NextAction: "检查后端",
	}); err != nil {
		t.Fatalf("seed project: %v", err)
	}
	if _, err := st.CreateAISummary(context.Background(), model.AISummary{
		ID: "summary_1", Period: "daily", Scope: "all", PeriodKey: "2026-09-18",
		Title: "每日总结", Content: "有一条任务", Model: "test-model", GeneratedAt: "2026-09-18T00:00:00Z", CreatedAt: "2026-09-18T00:00:00Z",
	}); err != nil {
		t.Fatalf("seed summary: %v", err)
	}

	headers := map[string]string{"X-Personal-OS-Client": "local"}
	response := request(t, handler, http.MethodPost, "/api/ai/chat", map[string]any{
		"question": "今天先做什么？", "summaryId": "summary_1",
	}, headers)
	if response.Code != http.StatusOK {
		t.Fatalf("chat status = %d, body = %s", response.Code, response.Body.String())
	}
	if len(client.requests) != 1 || !containsAll(client.requests[0].UserPrompt, []string{"今天先做什么", "唯一项目上下文", "每日总结"}) {
		t.Fatalf("unexpected chat request: %+v", client.requests)
	}
}

func decodeJSON(t *testing.T, response *httptest.ResponseRecorder, value any) {
	t.Helper()
	if err := jsonUnmarshal(response.Body.Bytes(), value); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
}

func containsAll(value string, expected []string) bool {
	for _, item := range expected {
		if !strings.Contains(value, item) {
			return false
		}
	}
	return true
}
