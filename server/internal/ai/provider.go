package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type CompletionRequest struct {
	SystemPrompt string
	UserPrompt   string
	MaxTokens    int
}

type CompletionResponse struct {
	Content          string
	Model            string
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
}

type Client interface {
	Complete(ctx context.Context, request CompletionRequest) (CompletionResponse, error)
	Config() Config
}

type OpenAICompatibleClient struct {
	config Config
	client *http.Client
}

func NewClient(config Config) *OpenAICompatibleClient {
	if config.MaxOutputTokens == 0 {
		config.MaxOutputTokens = 1200
	}
	return &OpenAICompatibleClient{
		config: config,
		client: &http.Client{Timeout: time.Duration(config.TimeoutSeconds) * time.Second},
	}
}

func (c *OpenAICompatibleClient) Config() Config {
	return c.config
}

func (c *OpenAICompatibleClient) Complete(ctx context.Context, request CompletionRequest) (CompletionResponse, error) {
	if c.config.APIKey == "" {
		return CompletionResponse{}, errors.New("AI 服务未配置，请在本机环境变量或 server/.env 中设置 PERSONAL_OS_AI_API_KEY")
	}

	maxTokens := request.MaxTokens
	if maxTokens == 0 {
		maxTokens = c.config.MaxOutputTokens
	}
	payload := map[string]any{
		"model":       c.config.Model,
		"messages":    []Message{{Role: "system", Content: request.SystemPrompt}, {Role: "user", Content: request.UserPrompt}},
		"temperature": c.config.Temperature,
		"max_tokens":  maxTokens,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return CompletionResponse{}, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.config.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return CompletionResponse{}, err
	}
	req.Header.Set("Authorization", "Bearer "+c.config.APIKey)
	req.Header.Set("Content-Type", "application/json")

	response, err := c.client.Do(req)
	if err != nil {
		return CompletionResponse{}, fmt.Errorf("AI 请求失败: %w", err)
	}
	defer response.Body.Close()
	responseBody, readErr := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		message := strings.TrimSpace(string(responseBody))
		if message == "" {
			message = response.Status
		}
		return CompletionResponse{}, fmt.Errorf("AI 服务返回错误（%d）: %s", response.StatusCode, message)
	}
	if readErr != nil {
		return CompletionResponse{}, fmt.Errorf("读取 AI 响应失败: %w", readErr)
	}

	var value struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(responseBody, &value); err != nil {
		return CompletionResponse{}, fmt.Errorf("解析 AI 响应失败: %w", err)
	}
	if len(value.Choices) == 0 {
		return CompletionResponse{}, errors.New("AI 服务没有返回内容")
	}
	total := value.Usage.TotalTokens
	if total == 0 {
		total = value.Usage.PromptTokens + value.Usage.CompletionTokens
	}
	return CompletionResponse{
		Content:          strings.TrimSpace(value.Choices[0].Message.Content),
		Model:            c.config.Model,
		PromptTokens:     value.Usage.PromptTokens,
		CompletionTokens: value.Usage.CompletionTokens,
		TotalTokens:      total,
	}, nil
}
