package api

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"personal-os/server/internal/ai"
	"personal-os/server/internal/model"
)

type AISummaryResponse struct {
	Summary model.AISummary `json:"summary"`
	State   model.State     `json:"state"`
}

var safeAISummaryIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

func isSafeSummaryID(id string) bool {
	return safeAISummaryIDPattern.MatchString(id)
}

func (s *Server) getAIConfig(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.aiClient.Config().Public())
}

func (s *Server) generateAISummary(w http.ResponseWriter, r *http.Request) {
	var input model.AISummaryInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	period, scope, err := validateAISummaryInput(input.Period, input.Scope)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}

	now := s.now()
	rangeValue, err := ai.PeriodRange(period, now)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	summary, err := s.createSummary(r, scope, rangeValue, nil)
	if err != nil {
		writeAIError(w, err)
		return
	}
	s.writeSummaryResponse(w, r, http.StatusCreated, summary)
}

func (s *Server) createSummary(r *http.Request, scope string, rangeValue ai.PeriodInfo, previous *model.AISummary) (model.AISummary, error) {
	state, err := s.store.LoadState(r.Context())
	if err != nil {
		return model.AISummary{}, err
	}
	contextData, err := ai.BuildContext(state, scope, rangeValue)
	if err != nil {
		return model.AISummary{}, err
	}
	completed, err := s.aiClient.Complete(r.Context(), ai.CompletionRequest{
		SystemPrompt: "你是 Personal OS 的本机个人数据分析助理。只依据提供的数据回答，不确定时明确说明。",
		UserPrompt:   ai.SummaryUserPrompt(scope, rangeValue, contextData),
	})
	if err != nil {
		return model.AISummary{}, err
	}

	generatedAt := s.now().UTC().Format(time.RFC3339)
	summary := model.AISummary{
		ID:               "",
		Period:           rangeValue.Period,
		Scope:            scope,
		PeriodKey:        rangeValue.Key,
		Title:            ai.SummaryTitle(rangeValue, scope),
		Content:          completed.Content,
		Model:            completed.Model,
		PromptTokens:     completed.PromptTokens,
		CompletionTokens: completed.CompletionTokens,
		TotalTokens:      completed.TotalTokens,
		GeneratedAt:      generatedAt,
		CreatedAt:        generatedAt,
	}
	if previous != nil {
		summary.Period = previous.Period
		summary.PeriodKey = previous.PeriodKey
	}
	summary, err = s.store.CreateAISummary(r.Context(), summary)
	if err != nil {
		return model.AISummary{}, err
	}
	return summary, nil
}

func (s *Server) updateAISummary(w http.ResponseWriter, r *http.Request) {
	var input model.AISummaryUpdateInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	id := r.PathValue("id")
	summary, err := s.store.UpdateAISummary(r.Context(), id, input)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	if summary.FilePath != nil {
		updatedPath, pathErr := s.writeSummaryFile(summary)
		if pathErr != nil {
			writeError(w, http.StatusInternalServerError, "summary_file_error", pathErr.Error())
			return
		}
		if err := s.store.SetAISummaryFilePath(r.Context(), id, updatedPath); err != nil {
			writeStoreError(w, err)
			return
		}
		summary, err = s.store.GetAISummary(r.Context(), id)
		if err != nil {
			writeStoreError(w, err)
			return
		}
	}
	s.writeSummaryResponse(w, r, http.StatusOK, summary)
}

func (s *Server) deleteAISummary(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	summary, err := s.store.GetAISummary(r.Context(), id)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	if summary.FilePath != nil && isPathInside(s.reportsDir, *summary.FilePath) {
		if err := os.Remove(*summary.FilePath); err != nil && !os.IsNotExist(err) {
			writeError(w, http.StatusInternalServerError, "summary_file_error", err.Error())
			return
		}
	}
	if err := s.store.DeleteAISummary(r.Context(), id); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) exportAISummary(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	summary, err := s.store.GetAISummary(r.Context(), id)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	path, err := s.writeSummaryFile(summary)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "summary_file_error", err.Error())
		return
	}
	if err := s.store.SetAISummaryFilePath(r.Context(), id, path); err != nil {
		writeStoreError(w, err)
		return
	}
	summary, err = s.store.GetAISummary(r.Context(), id)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	s.writeSummaryResponse(w, r, http.StatusOK, summary)
}

func (s *Server) chatWithAI(w http.ResponseWriter, r *http.Request) {
	var input model.AIChatInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	question := strings.TrimSpace(input.Question)
	if question == "" {
		writeError(w, http.StatusBadRequest, "invalid_input", errors.New("请输入追问内容").Error())
		return
	}

	now := s.now()
	var summary *model.AISummary
	scope := input.Scope
	periodName := "daily"
	period, err := ai.PeriodRange(periodName, now)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if input.SummaryID != "" {
		found, err := s.store.GetAISummary(r.Context(), input.SummaryID)
		if err != nil {
			writeStoreError(w, err)
			return
		}
		summary = &found
		scope = found.Scope
		periodName = found.Period
		period, err = periodRangeFromKey(periodName, found.PeriodKey, now)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
			return
		}
	}
	if scope == "" {
		scope = "all"
	}
	if _, _, err := validateAISummaryInput("daily", scope); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}

	state, err := s.store.LoadState(r.Context())
	if err != nil {
		writeStoreError(w, err)
		return
	}
	contextData, err := ai.BuildContext(state, scope, period)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "context_error", err.Error())
		return
	}
	completed, err := s.aiClient.Complete(r.Context(), ai.CompletionRequest{
		SystemPrompt: "你是 Personal OS 的本机个人数据分析助理。只依据提供的数据回答，不确定时明确说明。",
		UserPrompt:   ai.ChatUserPrompt(question, scope, period, contextData, summary),
	})
	if err != nil {
		writeAIError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, model.AIChatResult{
		Answer:           completed.Content,
		Model:            completed.Model,
		PromptTokens:     completed.PromptTokens,
		CompletionTokens: completed.CompletionTokens,
		TotalTokens:      completed.TotalTokens,
	})
}

func (s *Server) writeSummaryResponse(w http.ResponseWriter, r *http.Request, status int, summary model.AISummary) {
	state, err := s.store.LoadState(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "state_error", err.Error())
		return
	}
	writeJSON(w, status, AISummaryResponse{Summary: summary, State: state})
}

func (s *Server) writeSummaryFile(summary model.AISummary) (string, error) {
	if !isSafeSummaryID(summary.ID) {
		return "", errors.New("AI 总结 ID 无效")
	}
	root, err := filepath.Abs(s.reportsDir)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(root, 0o700); err != nil {
		return "", err
	}
	fileName := fmt.Sprintf("%s-%s-%s.md", summary.PeriodKey, summary.Scope, summary.ID)
	path := filepath.Join(root, fileName)
	markdown := fmt.Sprintf(`---
period: %s
scope: %s
periodKey: %s
model: %s
generatedAt: %s
promptTokens: %d
completionTokens: %d
totalTokens: %d
---

# %s

%s
`, summary.Period, summary.Scope, summary.PeriodKey, summary.Model,
		summary.GeneratedAt, summary.PromptTokens, summary.CompletionTokens,
		summary.TotalTokens, summary.Title, summary.Content)
	if err := os.WriteFile(path, []byte(markdown), 0o600); err != nil {
		return "", err
	}
	return path, nil
}

func validateAISummaryInput(period, scope string) (string, string, error) {
	validPeriod := period == "daily" || period == "weekly" || period == "monthly"
	if !validPeriod {
		return "", "", errors.New("请选择有效的 AI 总结周期")
	}
	validScope := scope == "all" || scope == "health" || scope == "finance" || scope == "learning" || scope == "workbench"
	if !validScope {
		return "", "", errors.New("请选择有效的 AI 总结范围")
	}
	return period, scope, nil
}

func periodRangeFromKey(period, key string, now time.Time) (ai.PeriodInfo, error) {
	switch period {
	case "daily":
		parsed, err := time.ParseInLocation("2006-01-02", key, now.Location())
		if err != nil {
			return ai.PeriodInfo{}, errors.New("总结周期无效")
		}
		value, _ := ai.PeriodRange("daily", parsed)
		return value, nil
	case "monthly":
		parsed, err := time.ParseInLocation("2006-01", key, now.Location())
		if err != nil {
			return ai.PeriodInfo{}, errors.New("总结周期无效")
		}
		value, _ := ai.PeriodRange("monthly", parsed)
		return value, nil
	case "weekly":
		matched := regexp.MustCompile(`^(\d{4})-W(\d{2})$`).FindStringSubmatch(key)
		if matched == nil {
			return ai.PeriodInfo{}, errors.New("总结周期无效")
		}
		year, _ := strconv.Atoi(matched[1])
		week, _ := strconv.Atoi(matched[2])
		jan4 := time.Date(year, time.January, 4, 0, 0, 0, 0, now.Location())
		weekday := int(jan4.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		firstMonday := jan4.AddDate(0, 0, 1-weekday)
		start := firstMonday.AddDate(0, 0, (week-1)*7)
		if start.Year() != year {
			return ai.PeriodInfo{}, errors.New("总结周期无效")
		}
		end := start.AddDate(0, 0, 6)
		return ai.PeriodInfo{
			Key:   key,
			Start: start.Format("2006-01-02"),
			End:   end.Format("2006-01-02"),
			Label: "每周",
		}, nil
	default:
		return ai.PeriodInfo{}, errors.New("总结周期无效")
	}
}

func isPathInside(root, path string) bool {
	absoluteRoot, err := filepath.Abs(root)
	if err != nil {
		return false
	}
	absolutePath, err := filepath.Abs(path)
	if err != nil {
		return false
	}
	relative, err := filepath.Rel(absoluteRoot, absolutePath)
	if err != nil {
		return false
	}
	return relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator))
}

func writeAIError(w http.ResponseWriter, err error) {
	message := err.Error()
	if strings.Contains(message, "未配置") {
		writeError(w, http.StatusServiceUnavailable, "ai_not_configured", message)
		return
	}
	writeError(w, http.StatusBadGateway, "ai_provider_error", message)
}
