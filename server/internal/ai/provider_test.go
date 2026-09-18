package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestOpenAICompatibleClientCompletesAndParsesUsage(t *testing.T) {
	var authorization, model, maxTokens string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authorization = r.Header.Get("Authorization")
		var value struct {
			Model     string `json:"model"`
			MaxTokens int    `json:"max_tokens"`
		}
		_ = json.NewDecoder(r.Body).Decode(&value)
		model = value.Model
		maxTokens = ""
		_ = maxTokens
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":" 完成 "}}],"usage":{"prompt_tokens":7,"completion_tokens":3}}`))
	}))
	defer server.Close()

	client := NewClient(Config{
		BaseURL: server.URL, APIKey: "secret", Model: "test-model",
		MaxOutputTokens: 321, Temperature: 0.1,
	})
	response, err := client.Complete(context.Background(), CompletionRequest{SystemPrompt: "s", UserPrompt: "u"})
	if err != nil {
		t.Fatalf("Complete: %v", err)
	}
	if authorization != "Bearer secret" || model != "test-model" || response.Content != "完成" || response.TotalTokens != 10 {
		t.Fatalf("unexpected response: auth=%q model=%q value=%+v", authorization, model, response)
	}
}

func TestLoadConfigReadsLocalEnvWithoutLeakingValidation(t *testing.T) {
	path := t.TempDir() + "/.env"
	content := "PERSONAL_OS_AI_BASE_URL=http://127.0.0.1:9/v1\nPERSONAL_OS_AI_API_KEY=secret\nPERSONAL_OS_AI_MODEL=local-model\nPERSONAL_OS_AI_MAX_OUTPUT_TOKENS=888\n"
	if err := writeFile(path, content); err != nil {
		t.Fatalf("write env: %v", err)
	}
	config, err := LoadConfig(path)
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	if !strings.HasSuffix(config.BaseURL, "/v1") || config.APIKey != "secret" || config.Model != "local-model" || config.MaxOutputTokens != 888 {
		t.Fatalf("unexpected config: %+v", config)
	}
}
