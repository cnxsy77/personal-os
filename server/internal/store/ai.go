package store

import (
	"context"
	"database/sql"
	"errors"
	"regexp"

	"github.com/google/uuid"
	"personal-os/server/internal/model"
)

var safeIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

func (s *Store) loadAISummaries(ctx context.Context, state *model.State) error {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, period, scope, period_key, title, content, model,
		       prompt_tokens, completion_tokens, total_tokens, file_path,
		       generated_at, created_at
		FROM ai_summaries
		ORDER BY generated_at DESC, id DESC
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	state.AISummaries = []model.AISummary{}
	for rows.Next() {
		var item model.AISummary
		var filePath sql.NullString
		if err := rows.Scan(
			&item.ID,
			&item.Period,
			&item.Scope,
			&item.PeriodKey,
			&item.Title,
			&item.Content,
			&item.Model,
			&item.PromptTokens,
			&item.CompletionTokens,
			&item.TotalTokens,
			&filePath,
			&item.GeneratedAt,
			&item.CreatedAt,
		); err != nil {
			return err
		}
		item.FilePath = nullableString(filePath)
		state.AISummaries = append(state.AISummaries, item)
	}
	return rows.Err()
}

func (s *Store) CreateAISummary(ctx context.Context, summary model.AISummary) (model.AISummary, error) {
	if summary.ID == "" {
		summary.ID = uuid.NewString()
	}
	if summary.CreatedAt == "" {
		summary.CreatedAt = summary.GeneratedAt
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO ai_summaries (
			id, period, scope, period_key, title, content, model,
			prompt_tokens, completion_tokens, total_tokens, file_path,
			generated_at, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, summary.ID, summary.Period, summary.Scope, summary.PeriodKey,
		summary.Title, summary.Content, summary.Model,
		summary.PromptTokens, summary.CompletionTokens, summary.TotalTokens,
		summary.FilePath, summary.GeneratedAt, summary.CreatedAt)
	return summary, err
}

func (s *Store) GetAISummary(ctx context.Context, id string) (model.AISummary, error) {
	var summary model.AISummary
	var filePath sql.NullString
	err := s.db.QueryRowContext(ctx, `
		SELECT id, period, scope, period_key, title, content, model,
		       prompt_tokens, completion_tokens, total_tokens, file_path,
		       generated_at, created_at
		FROM ai_summaries WHERE id = ?
	`, id).Scan(
		&summary.ID,
		&summary.Period,
		&summary.Scope,
		&summary.PeriodKey,
		&summary.Title,
		&summary.Content,
		&summary.Model,
		&summary.PromptTokens,
		&summary.CompletionTokens,
		&summary.TotalTokens,
		&filePath,
		&summary.GeneratedAt,
		&summary.CreatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return summary, errors.New("AI 总结不存在")
	}
	if err != nil {
		return summary, err
	}
	summary.FilePath = nullableString(filePath)
	return summary, nil
}

func (s *Store) UpdateAISummary(ctx context.Context, id string, input model.AISummaryUpdateInput) (model.AISummary, error) {
	title := cleanString(input.Title)
	content := cleanString(input.Content)
	if title == "" {
		return model.AISummary{}, errors.New("总结标题不能为空")
	}
	if content == "" {
		return model.AISummary{}, errors.New("总结内容不能为空")
	}

	result, err := s.db.ExecContext(ctx, `
		UPDATE ai_summaries SET title = ?, content = ? WHERE id = ?
	`, title, content, id)
	if err := checkAffected(result, err, "AI 总结不存在"); err != nil {
		return model.AISummary{}, err
	}
	return s.GetAISummary(ctx, id)
}

func (s *Store) SetAISummaryFilePath(ctx context.Context, id, filePath string) error {
	result, err := s.db.ExecContext(ctx, `
		UPDATE ai_summaries SET file_path = ? WHERE id = ?
	`, filePath, id)
	return checkAffected(result, err, "AI 总结不存在")
}

func (s *Store) DeleteAISummary(ctx context.Context, id string) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM ai_summaries WHERE id = ?`, id)
	return checkAffected(result, err, "AI 总结不存在")
}

func isSafeID(id string) bool {
	return safeIDPattern.MatchString(id)
}
