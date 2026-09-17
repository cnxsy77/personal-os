package store

import (
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

func valueString(value *string) any {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil
	}
	return strings.TrimSpace(*value)
}

func cleanString(value string) string {
	return strings.TrimSpace(value)
}

func optionalText(value *string) *string {
	if value == nil {
		return nil
	}
	text := strings.TrimSpace(*value)
	if text == "" {
		return nil
	}
	return &text
}

func textFromPtr(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func nullStringFromValue(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func cleanStringList(values []string) []string {
	result := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		text := strings.TrimSpace(value)
		if text == "" {
			continue
		}
		if _, exists := seen[text]; exists {
			continue
		}
		seen[text] = struct{}{}
		result = append(result, text)
	}
	return result
}

func encodeStringList(values []string) (any, error) {
	if len(values) == 0 {
		return nil, nil
	}
	encoded, err := json.Marshal(values)
	if err != nil {
		return nil, err
	}
	return string(encoded), nil
}

func containsValue[T comparable](values []T, expected T) bool {
	for _, value := range values {
		if value == expected {
			return true
		}
	}
	return false
}

func localToday() time.Time {
	now := time.Now()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
}

func localDate(value time.Time) string {
	return value.Format("2006-01-02")
}

func nowTimestamp() string {
	return time.Now().UTC().Format(time.RFC3339Nano)
}

func nextRecurringDate(value string, frequency string) (string, error) {
	date, err := time.Parse("2006-01-02", value)
	if err != nil {
		return "", errors.New("请选择有效的下次记录日期")
	}
	switch frequency {
	case "weekly":
		date = date.AddDate(0, 0, 7)
	case "monthly":
		date = date.AddDate(0, 1, 0)
	case "yearly":
		date = date.AddDate(1, 0, 0)
	default:
		return "", errors.New("请选择有效的重复频率")
	}
	return localDate(date), nil
}

func nullStringValue(value *string) sql.NullString {
	if value == nil || *value == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: *value, Valid: true}
}
