package store

import (
	"context"
	"errors"

	"personal-os/server/internal/model"
)

func (s *Store) currentSettings(ctx context.Context) (settings model.Settings, err error) {
	err = s.loadSettings(ctx, &settings)
	return settings, err
}

func (s *Store) UpdateSettings(ctx context.Context, input model.SettingsInput) error {
	settings, err := s.currentSettings(ctx)
	if err != nil {
		return err
	}

	if input.WeeklyWorkoutTarget != nil {
		value := *input.WeeklyWorkoutTarget
		if value < 1 || value > 14 {
			return errors.New("锻炼周目标必须在 1 到 14 次之间")
		}
		settings.WeeklyWorkoutTarget = value
	}
	if input.ExpenseCategories != nil {
		categories, err := normalizeCategories(*input.ExpenseCategories, "支出分类")
		if err != nil {
			return err
		}
		settings.ExpenseCategories = categories
	}
	if input.IncomeCategories != nil {
		categories, err := normalizeCategories(*input.IncomeCategories, "收入分类")
		if err != nil {
			return err
		}
		settings.IncomeCategories = categories
	}
	if input.FontScale != nil && !isValidFontScale(*input.FontScale) {
		return errors.New("请选择有效的界面字号")
	}
	if input.FontScale != nil {
		settings.FontScale = *input.FontScale
	}
	if input.ReducedMotion != nil {
		settings.ReducedMotion = *input.ReducedMotion
	}

	expense, err := encodeStringList(settings.ExpenseCategories)
	if err != nil {
		return err
	}
	income, err := encodeStringList(settings.IncomeCategories)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `
		UPDATE settings SET weekly_workout_target = ?, expense_categories = ?, income_categories = ?, font_scale = ?, reduced_motion = ?
		WHERE id = 'default'
	`, settings.WeeklyWorkoutTarget, expense, income, settings.FontScale, boolToInt(settings.ReducedMotion))
	return err
}

func (s *Store) UpdateMonthlyBudget(ctx context.Context, amountCents int64) error {
	if amountCents <= 0 {
		return errors.New("月度预算必须是大于 0 的整数金额")
	}
	result, err := s.db.ExecContext(ctx, `UPDATE settings SET monthly_budget_cents = ? WHERE id = 'default'`, amountCents)
	return checkAffected(result, err, "设置不存在")
}

func (s *Store) RenameCategory(ctx context.Context, kind, from, to string) error {
	if kind != "expense" && kind != "income" {
		return errors.New("请选择有效的分类类型")
	}
	fromName := cleanString(from)
	toName := cleanString(to)
	if toName == "" {
		return errors.New("分类名称不能为空")
	}
	label := "支出分类"
	if kind == "income" {
		label = "收入分类"
	}

	settings, err := s.currentSettings(ctx)
	if err != nil {
		return err
	}
	categories := settings.ExpenseCategories
	if kind == "income" {
		categories = settings.IncomeCategories
	}
	if !containsValue(categories, fromName) {
		return errors.New(label + "不存在")
	}
	if toName != fromName && containsValue(categories, toName) {
		return errors.New(label + "已存在")
	}
	nextCategories := make([]string, 0, len(categories))
	for _, category := range categories {
		if category == fromName {
			category = toName
		}
		if !containsValue(nextCategories, category) {
			nextCategories = append(nextCategories, category)
		}
	}
	if kind == "expense" {
		settings.ExpenseCategories = nextCategories
	} else {
		settings.IncomeCategories = nextCategories
	}

	expense, err := encodeStringList(settings.ExpenseCategories)
	if err != nil {
		return err
	}
	income, err := encodeStringList(settings.IncomeCategories)
	if err != nil {
		return err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `
		UPDATE settings SET expense_categories = ?, income_categories = ? WHERE id = 'default'
	`, expense, income); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE transactions SET category = ? WHERE kind = ? AND category = ?`, toName, kind, fromName); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE recurring_transactions SET category = ? WHERE kind = ? AND category = ?`, toName, kind, fromName); err != nil {
		return err
	}
	return tx.Commit()
}

func normalizeCategories(values []string, label string) ([]string, error) {
	categories := cleanStringList(values)
	if len(categories) == 0 {
		return nil, errors.New(label + "至少保留一项")
	}
	return categories, nil
}

func isValidFontScale(value string) bool {
	return value == "default" || value == "large" || value == "xlarge"
}
