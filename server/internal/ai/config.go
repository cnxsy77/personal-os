package ai

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	BaseURL         string  `json:"baseUrl"`
	APIKey          string  `json:"-"`
	Model           string  `json:"model"`
	MaxOutputTokens int     `json:"maxOutputTokens"`
	TimeoutSeconds  int     `json:"timeoutSeconds"`
	Temperature     float64 `json:"-"`
}

type PublicConfig struct {
	Configured      bool   `json:"configured"`
	BaseURL         string `json:"baseUrl"`
	Model           string `json:"model"`
	MaxOutputTokens int    `json:"maxOutputTokens"`
	TimeoutSeconds  int    `json:"timeoutSeconds"`
}

func (c Config) Public() PublicConfig {
	return PublicConfig{
		Configured:      c.APIKey != "",
		BaseURL:         c.BaseURL,
		Model:           c.Model,
		MaxOutputTokens: c.MaxOutputTokens,
		TimeoutSeconds:  c.TimeoutSeconds,
	}
}

func DefaultConfig() Config {
	return Config{
		BaseURL:         "https://api.openai.com/v1",
		Model:           "gpt-4o-mini",
		MaxOutputTokens: 1200,
		TimeoutSeconds:  60,
		Temperature:     0.2,
	}
}

func LoadConfig(envPath string) (Config, error) {
	config := DefaultConfig()
	values, err := readEnvFile(envPath)
	if err != nil {
		return config, err
	}

	applyValue := func(key string, set func(string)) {
		if value, ok := values[key]; ok {
			set(value)
		}
		if value, ok := os.LookupEnv(key); ok {
			set(value)
		}
	}

	applyValue("PERSONAL_OS_AI_BASE_URL", func(value string) {
		config.BaseURL = strings.TrimRight(strings.TrimSpace(value), "/")
	})
	applyValue("PERSONAL_OS_AI_API_KEY", func(value string) {
		config.APIKey = strings.TrimSpace(value)
	})
	applyValue("PERSONAL_OS_AI_MODEL", func(value string) {
		config.Model = strings.TrimSpace(value)
	})
	applyValue("PERSONAL_OS_AI_MAX_OUTPUT_TOKENS", func(value string) {
		if parsed, err := strconv.Atoi(strings.TrimSpace(value)); err == nil {
			config.MaxOutputTokens = parsed
		}
	})
	applyValue("PERSONAL_OS_AI_TIMEOUT_SECONDS", func(value string) {
		if parsed, err := strconv.Atoi(strings.TrimSpace(value)); err == nil {
			config.TimeoutSeconds = parsed
		}
	})
	applyValue("PERSONAL_OS_AI_TEMPERATURE", func(value string) {
		if parsed, err := strconv.ParseFloat(strings.TrimSpace(value), 64); err == nil {
			config.Temperature = parsed
		}
	})

	parsedURL, err := url.Parse(config.BaseURL)
	if err != nil || parsedURL.Scheme != "https" && parsedURL.Scheme != "http" || parsedURL.Host == "" {
		return config, errors.New("AI Base URL 无效")
	}
	if config.Model == "" {
		return config, errors.New("AI 模型名不能为空")
	}
	if config.MaxOutputTokens < 1 || config.MaxOutputTokens > 8000 {
		return config, errors.New("AI 最大输出必须在 1 到 8000 之间")
	}
	if config.TimeoutSeconds < 1 || config.TimeoutSeconds > 300 {
		return config, errors.New("AI 超时时间必须在 1 到 300 秒之间")
	}
	if config.Temperature < 0 || config.Temperature > 2 {
		return config, errors.New("AI 温度必须在 0 到 2 之间")
	}
	return config, nil
}

func readEnvFile(path string) (map[string]string, error) {
	values := map[string]string{}
	content, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return values, nil
	}
	if err != nil {
		return values, fmt.Errorf("读取 AI 配置失败: %w", err)
	}

	for _, line := range strings.Split(string(content), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, found := strings.Cut(line, "=")
		if !found {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		if len(value) >= 2 && (value[0] == '"' && value[len(value)-1] == '"' || value[0] == '\'' && value[len(value)-1] == '\'') {
			value = value[1 : len(value)-1]
		}
		if key != "" {
			values[key] = value
		}
	}
	return values, nil
}
