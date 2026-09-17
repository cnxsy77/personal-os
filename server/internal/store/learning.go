package store

import (
	"context"
	"database/sql"
	"errors"
	"net/url"
	"regexp"
	"strings"

	"github.com/google/uuid"

	"personal-os/server/internal/model"
)

func (s *Store) RecordStudyLog(ctx context.Context, input model.StudyLogInput) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	item, err := validateStudyLog(ctx, tx, input)
	if err != nil {
		return err
	}
	if err := insertStudyLog(ctx, tx, model.StudyLog{
		ID: uuid.NewString(), Topic: item.Topic, Minutes: item.Minutes, Date: item.Date,
		PathID: item.PathID, Platform: item.Platform, ResourceID: item.ResourceID,
		LessonID: item.LessonID, Note: textFromPtr(item.Note),
	}); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) UpdateStudyLog(ctx context.Context, id string, input model.StudyLogInput) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var exists string
	err = tx.QueryRowContext(ctx, `SELECT id FROM study_logs WHERE id = ?`, id).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New("学习记录不存在")
	}
	if err != nil {
		return err
	}
	item, err := validateStudyLog(ctx, tx, input)
	if err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `
		UPDATE study_logs SET topic = ?, minutes = ?, date = ?, path_id = ?, platform = ?, resource_id = ?, lesson_id = ?, note = ?
		WHERE id = ?
	`, item.Topic, item.Minutes, item.Date, nullStringValue(item.PathID), string(item.Platform),
		nullStringValue(item.ResourceID), nullStringValue(item.LessonID), nullStringFromValue(textFromPtr(item.Note)), id); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) DeleteStudyLog(ctx context.Context, id string) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM study_logs WHERE id = ?`, id)
	return checkAffected(result, err, "学习记录不存在")
}

func (s *Store) CreateLearningPath(ctx context.Context, input model.LearningPathInput) error {
	validated, err := validateLearningPath(input)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO learning_paths (id, title, target_minutes, created_at) VALUES (?, ?, ?, ?)
	`, uuid.NewString(), validated.Title, validated.TargetMinutes, nowTimestamp())
	return err
}

func (s *Store) UpdateLearningPath(ctx context.Context, id string, input model.LearningPathInput) error {
	validated, err := validateLearningPath(input)
	if err != nil {
		return err
	}
	result, err := s.db.ExecContext(ctx, `
		UPDATE learning_paths SET title = ?, target_minutes = ? WHERE id = ?
	`, validated.Title, validated.TargetMinutes, id)
	return checkAffected(result, err, "学习路径不存在")
}

func (s *Store) DeleteLearningPath(ctx context.Context, id string) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM learning_paths WHERE id = ?`, id)
	return checkAffected(result, err, "学习路径不存在")
}

func (s *Store) CreateLearningResource(ctx context.Context, input model.LearningResourceInput) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	item, err := validateLearningResource(ctx, tx, input)
	if err != nil {
		return err
	}
	if err := insertLearningResource(ctx, tx, model.LearningResource{
		ID: uuid.NewString(), PathID: item.PathID, Title: item.Title, Kind: item.Kind,
		Status: item.Status, Platform: item.Platform, SourceURL: item.SourceURL,
		ExternalID: item.ExternalID, TargetMinutes: item.TargetMinutes,
	}); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) UpdateLearningResource(ctx context.Context, id string, input model.LearningResourceInput) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var exists string
	err = tx.QueryRowContext(ctx, `SELECT id FROM learning_resources WHERE id = ?`, id).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New("学习资料不存在")
	}
	if err != nil {
		return err
	}
	item, err := validateLearningResource(ctx, tx, input)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `
		UPDATE learning_resources SET path_id = ?, title = ?, kind = ?, status = ?, platform = ?, source_url = ?, external_id = ?, target_minutes = ?
		WHERE id = ?
	`, nullStringValue(item.PathID), item.Title, item.Kind, item.Status, string(item.Platform),
		nullStringFromValue(item.SourceURL), nullStringFromValue(item.ExternalID), nullInt(item.TargetMinutes), id)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) DeleteLearningResource(ctx context.Context, id string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `
		UPDATE study_logs SET lesson_id = NULL
		WHERE lesson_id IN (SELECT id FROM learning_lessons WHERE resource_id = ?)
	`, id); err != nil {
		return err
	}
	// Clearing the non-foreign-key study log link first avoids dangling IDs
	// when SQLite cascades lesson deletion below.
	if _, err = tx.ExecContext(ctx, `DELETE FROM learning_resources WHERE id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) SetLearningResourceStatus(ctx context.Context, id, status string) error {
	if !isLearningStatus(status) {
		return errors.New("资料状态无效")
	}
	result, err := s.db.ExecContext(ctx, `UPDATE learning_resources SET status = ? WHERE id = ?`, status, id)
	return checkAffected(result, err, "学习资料不存在")
}

func (s *Store) AddLearningLessons(ctx context.Context, input model.LearningLessonsInput) error {
	if len(input.Lessons) == 0 {
		return errors.New("请输入至少一个课时")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var resourceID string
	err = tx.QueryRowContext(ctx, `SELECT id FROM learning_resources WHERE id = ?`, input.ResourceID).Scan(&resourceID)
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New("学习课程不存在")
	}
	if err != nil {
		return err
	}
	var existingCount int
	if err = tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM learning_lessons WHERE resource_id = ?`, input.ResourceID).Scan(&existingCount); err != nil {
		return err
	}
	for index, draft := range input.Lessons {
		item, err := validateLessonDraft(draft)
		if err != nil {
			return err
		}
		if _, err = tx.ExecContext(ctx, `
			INSERT INTO learning_lessons (id, resource_id, title, sort_order, status, expected_minutes, source_url, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`, uuid.NewString(), input.ResourceID, item.Title, existingCount+index+1, item.Status,
			nullInt(item.ExpectedMinutes), nullStringFromValue(item.SourceURL), nowTimestamp()); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) SetLearningLessonStatus(ctx context.Context, id, status string) error {
	if !isLearningStatus(status) {
		return errors.New("课时状态无效")
	}
	result, err := s.db.ExecContext(ctx, `UPDATE learning_lessons SET status = ? WHERE id = ?`, status, id)
	return checkAffected(result, err, "学习课时不存在")
}

func (s *Store) UpdateLearningLesson(ctx context.Context, id string, input model.LearningLessonUpdateInput) error {
	title := cleanString(input.Title)
	if title == "" {
		return errors.New("课时名称不能为空")
	}
	if input.ExpectedMinutes != nil && *input.ExpectedMinutes <= 0 {
		return errors.New("课时预计时长必须大于 0 分钟")
	}
	if !isLearningStatus(input.Status) {
		return errors.New("课时状态无效")
	}
	sourceURL := cleanString(input.SourceURL)
	if sourceURL != "" && !isHTTPURL(sourceURL) {
		return errors.New("请输入有效的课时链接")
	}
	result, err := s.db.ExecContext(ctx, `
		UPDATE learning_lessons SET title = ?, status = ?, expected_minutes = ?, source_url = ? WHERE id = ?
	`, title, input.Status, nullInt(input.ExpectedMinutes), nilIfEmpty(sourceURL), id)
	return checkAffected(result, err, "学习课时不存在")
}

func (s *Store) DeleteLearningLesson(ctx context.Context, id string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `DELETE FROM learning_lessons WHERE id = ?`, id)
	if err := checkAffected(result, err, "学习课时不存在"); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE study_logs SET lesson_id = NULL WHERE lesson_id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) CreateLearningNoteFolder(ctx context.Context, name string) error {
	folderName := cleanString(name)
	if folderName == "" {
		return errors.New("笔记文件夹名称不能为空")
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO learning_note_folders (id, name, created_at) VALUES (?, ?, ?)
	`, uuid.NewString(), folderName, localDate(localToday()))
	return err
}

func (s *Store) UpdateLearningNoteFolder(ctx context.Context, id, name string) error {
	folderName := cleanString(name)
	if folderName == "" {
		return errors.New("笔记文件夹名称不能为空")
	}
	result, err := s.db.ExecContext(ctx, `UPDATE learning_note_folders SET name = ? WHERE id = ?`, folderName, id)
	return checkAffected(result, err, "笔记文件夹不存在")
}

func (s *Store) DeleteLearningNoteFolder(ctx context.Context, id string) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM learning_note_folders WHERE id = ?`, id)
	return checkAffected(result, err, "笔记文件夹不存在")
}

func (s *Store) SaveLearningNote(ctx context.Context, input model.LearningNoteInput) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	item, err := validateLearningNote(ctx, tx, input)
	if err != nil {
		return err
	}
	if input.ID == nil || *input.ID == "" {
		id := uuid.NewString()
		if err := insertLearningNote(ctx, tx, id, item); err != nil {
			return err
		}
		return tx.Commit()
	}
	var exists string
	err = tx.QueryRowContext(ctx, `SELECT id FROM learning_notes WHERE id = ?`, *input.ID).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New("学习笔记不存在")
	}
	if err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `
		UPDATE learning_notes SET folder_id = ?, title = ?, content = ?, resource_id = ?, lesson_id = ?, updated_at = ?
		WHERE id = ?
	`, nullStringValue(item.FolderID), item.Title, item.Content, nullStringValue(item.ResourceID),
		nullStringValue(item.LessonID), nowTimestamp(), *input.ID); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM learning_note_tags WHERE note_id = ?`, *input.ID); err != nil {
		return err
	}
	if err := insertNoteTags(ctx, tx, *input.ID, item.Tags); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) DeleteLearningNote(ctx context.Context, id string) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM learning_notes WHERE id = ?`, id)
	return checkAffected(result, err, "学习笔记不存在")
}

func (s *Store) SaveWeeklyReview(ctx context.Context, input model.WeeklyReviewInput) error {
	validated, err := validateWeeklyReview(input)
	if err != nil {
		return err
	}
	var existingID string
	err = s.db.QueryRowContext(ctx, `SELECT id FROM weekly_reviews WHERE week_start_date = ?`, validated.WeekStartDate).Scan(&existingID)
	if err == nil {
		_, err = s.db.ExecContext(ctx, `
			UPDATE weekly_reviews SET wins = ?, blockers = ?, next_focus = ? WHERE id = ?
		`, validated.Wins, validated.Blockers, validated.NextFocus, existingID)
		return err
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO weekly_reviews (id, week_start_date, wins, blockers, next_focus, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, uuid.NewString(), validated.WeekStartDate, validated.Wins, validated.Blockers, validated.NextFocus, nowTimestamp())
	return err
}

func (s *Store) UpdateWeeklyReview(ctx context.Context, id string, input model.WeeklyReviewInput) error {
	validated, err := validateWeeklyReview(input)
	if err != nil {
		return err
	}
	var duplicateID string
	err = s.db.QueryRowContext(ctx, `SELECT id FROM weekly_reviews WHERE week_start_date = ? AND id <> ?`, validated.WeekStartDate, id).Scan(&duplicateID)
	if err == nil {
		return errors.New("该周复盘已存在")
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	result, err := s.db.ExecContext(ctx, `
		UPDATE weekly_reviews SET week_start_date = ?, wins = ?, blockers = ?, next_focus = ? WHERE id = ?
	`, validated.WeekStartDate, validated.Wins, validated.Blockers, validated.NextFocus, id)
	return checkAffected(result, err, "周复盘不存在")
}

func (s *Store) DeleteWeeklyReview(ctx context.Context, id string) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM weekly_reviews WHERE id = ?`, id)
	return checkAffected(result, err, "周复盘不存在")
}

func validateStudyLog(ctx context.Context, tx *sql.Tx, input model.StudyLogInput) (model.StudyLogInput, error) {
	input.Topic = cleanString(input.Topic)
	input.Date = cleanString(input.Date)
	input.PathID = optionalID(input.PathID)
	input.ResourceID = optionalID(input.ResourceID)
	input.LessonID = optionalID(input.LessonID)
	if input.Topic == "" {
		return input, errors.New("学习主题不能为空")
	}
	if input.Minutes <= 0 {
		return input, errors.New("学习时长必须大于 0 分钟")
	}
	if !isValidDate(input.Date) {
		return input, errors.New("请选择有效的学习日期")
	}
	if input.PathID != nil {
		if err := ensureExists(ctx, tx, `SELECT id FROM learning_paths WHERE id = ?`, *input.PathID, "学习路径不存在"); err != nil {
			return input, err
		}
	}
	if input.Platform != "" && !isLearningPlatform(string(input.Platform)) {
		return input, errors.New("学习来源无效")
	}
	if input.ResourceID != nil {
		if err := ensureExists(ctx, tx, `SELECT id FROM learning_resources WHERE id = ?`, *input.ResourceID, "学习课程不存在"); err != nil {
			return input, err
		}
	}
	if input.LessonID != nil {
		var lessonResource string
		err := tx.QueryRowContext(ctx, `SELECT resource_id FROM learning_lessons WHERE id = ?`, *input.LessonID).Scan(&lessonResource)
		if errors.Is(err, sql.ErrNoRows) {
			return input, errors.New("学习课时不存在")
		}
		if err != nil {
			return input, err
		}
		if input.ResourceID == nil || lessonResource != *input.ResourceID {
			return input, errors.New("学习课时与课程不匹配")
		}
	}
	return input, nil
}

func insertStudyLog(ctx context.Context, tx *sql.Tx, item model.StudyLog) error {
	_, err := tx.ExecContext(ctx, `
		INSERT INTO study_logs (id, topic, minutes, date, path_id, platform, resource_id, lesson_id, note, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, item.ID, item.Topic, item.Minutes, item.Date, nullStringValue(item.PathID), string(item.Platform),
		nullStringValue(item.ResourceID), nullStringValue(item.LessonID), nullStringFromValue(item.Note), nowTimestamp())
	return err
}

func validateLearningPath(input model.LearningPathInput) (model.LearningPathInput, error) {
	input.Title = cleanString(input.Title)
	if input.Title == "" {
		return input, errors.New("学习路径名称不能为空")
	}
	if input.TargetMinutes <= 0 {
		return input, errors.New("学习目标必须大于 0 分钟")
	}
	return input, nil
}

func validateLearningResource(ctx context.Context, tx *sql.Tx, input model.LearningResourceInput) (model.LearningResourceInput, error) {
	input.Title = cleanString(input.Title)
	input.SourceURL = cleanString(input.SourceURL)
	input.ExternalID = cleanString(input.ExternalID)
	input.PathID = optionalID(input.PathID)
	if input.Title == "" {
		return input, errors.New("资料名称不能为空")
	}
	if input.PathID != nil {
		if err := ensureExists(ctx, tx, `SELECT id FROM learning_paths WHERE id = ?`, *input.PathID, "学习路径不存在"); err != nil {
			return input, err
		}
	}
	if input.SourceURL != "" && !isHTTPURL(input.SourceURL) {
		return input, errors.New("请输入有效的课程链接")
	}
	if input.Platform != "" && !isLearningPlatform(string(input.Platform)) {
		return input, errors.New("学习来源无效")
	}
	if input.Platform == "" && input.SourceURL != "" {
		if platform, _ := parseLearningSource(input.SourceURL); platform != "" {
			input.Platform = platform
		}
	}
	if !isLearningKind(input.Kind) {
		return input, errors.New("资料类型无效")
	}
	if !isLearningStatus(input.Status) {
		return input, errors.New("资料状态无效")
	}
	if input.TargetMinutes != nil && *input.TargetMinutes <= 0 {
		return input, errors.New("课程目标必须大于 0 分钟")
	}
	if input.ExternalID == "" && input.SourceURL != "" {
		if _, externalID := parseLearningSource(input.SourceURL); externalID != "" {
			input.ExternalID = externalID
		}
	}
	return input, nil
}

func insertLearningResource(ctx context.Context, tx *sql.Tx, item model.LearningResource) error {
	_, err := tx.ExecContext(ctx, `
		INSERT INTO learning_resources (id, path_id, title, kind, status, platform, source_url, external_id, target_minutes, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, item.ID, nullStringValue(item.PathID), item.Title, item.Kind, item.Status, string(item.Platform),
		nullStringFromValue(item.SourceURL), nullStringFromValue(item.ExternalID), nullInt(item.TargetMinutes), nowTimestamp())
	return err
}

func validateLessonDraft(input model.LearningLessonDraftInput) (model.LearningLessonDraftInput, error) {
	input.Title = cleanString(input.Title)
	input.SourceURL = cleanString(input.SourceURL)
	if input.Title == "" {
		return input, errors.New("课时名称不能为空")
	}
	if input.ExpectedMinutes != nil && *input.ExpectedMinutes <= 0 {
		return input, errors.New("课时预计时长必须大于 0 分钟")
	}
	if input.Status == "" {
		input.Status = "todo"
	}
	if !isLearningStatus(input.Status) {
		return input, errors.New("课时状态无效")
	}
	if input.SourceURL != "" && !isHTTPURL(input.SourceURL) {
		return input, errors.New("请输入有效的课时链接")
	}
	return input, nil
}

func validateLearningNote(ctx context.Context, tx *sql.Tx, input model.LearningNoteInput) (model.LearningNoteInput, error) {
	input.Title = cleanString(input.Title)
	input.Content = cleanString(input.Content)
	input.FolderID = optionalID(input.FolderID)
	input.ResourceID = optionalID(input.ResourceID)
	input.LessonID = optionalID(input.LessonID)
	if input.Title == "" {
		return input, errors.New("笔记标题不能为空")
	}
	if input.Content == "" {
		return input, errors.New("笔记内容不能为空")
	}
	if input.FolderID != nil {
		if err := ensureExists(ctx, tx, `SELECT id FROM learning_note_folders WHERE id = ?`, *input.FolderID, "笔记文件夹不存在"); err != nil {
			return input, err
		}
	}
	if input.ResourceID != nil {
		if err := ensureExists(ctx, tx, `SELECT id FROM learning_resources WHERE id = ?`, *input.ResourceID, "学习课程不存在"); err != nil {
			return input, err
		}
	}
	if input.LessonID != nil {
		var lessonResource string
		err := tx.QueryRowContext(ctx, `SELECT resource_id FROM learning_lessons WHERE id = ?`, *input.LessonID).Scan(&lessonResource)
		if errors.Is(err, sql.ErrNoRows) {
			return input, errors.New("学习课时不存在")
		}
		if err != nil {
			return input, err
		}
		if input.ResourceID == nil || lessonResource != *input.ResourceID {
			return input, errors.New("学习课时与课程不匹配")
		}
	}
	input.Tags = cleanStringList(input.Tags)
	return input, nil
}

func insertLearningNote(ctx context.Context, tx *sql.Tx, id string, item model.LearningNoteInput) error {
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO learning_notes (id, folder_id, title, content, resource_id, lesson_id, updated_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, id, nullStringValue(item.FolderID), item.Title, item.Content, nullStringValue(item.ResourceID),
		nullStringValue(item.LessonID), nowTimestamp(), nowTimestamp()); err != nil {
		return err
	}
	return insertNoteTags(ctx, tx, id, item.Tags)
}

func insertNoteTags(ctx context.Context, tx *sql.Tx, noteID string, tags []string) error {
	for index, tag := range tags {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO learning_note_tags (note_id, tag, sort_order) VALUES (?, ?, ?)
		`, noteID, tag, index); err != nil {
			return err
		}
	}
	return nil
}

func validateWeeklyReview(input model.WeeklyReviewInput) (model.WeeklyReviewInput, error) {
	input.WeekStartDate = cleanString(input.WeekStartDate)
	input.Wins = cleanString(input.Wins)
	input.Blockers = cleanString(input.Blockers)
	input.NextFocus = cleanString(input.NextFocus)
	if !isValidDate(input.WeekStartDate) {
		return input, errors.New("请选择有效的周复盘日期")
	}
	return input, nil
}

func ensureExists(ctx context.Context, tx *sql.Tx, query string, args ...any) error {
	var found string
	label, _ := args[len(args)-1].(string)
	err := tx.QueryRowContext(ctx, query, args[:len(args)-1]...).Scan(&found)
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New(label)
	}
	return err
}

func nullInt(value *int) any {
	if value == nil {
		return nil
	}
	return *value
}

func nilIfEmpty(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func isLearningKind(value string) bool {
	switch value {
	case "course", "book", "article", "video", "docs":
		return true
	default:
		return false
	}
}

func isLearningStatus(value string) bool {
	return value == "todo" || value == "doing" || value == "done"
}

func isLearningPlatform(value string) bool {
	switch value {
	case "bilibili", "mooc", "plaso", "xiaoe", "baiduPan", "other":
		return true
	default:
		return false
	}
}

func isHTTPURL(value string) bool {
	parsed, err := url.Parse(value)
	return err == nil && (parsed.Scheme == "http" || parsed.Scheme == "https") && parsed.Host != ""
}

var bilibiliBVPattern = regexp.MustCompile(`(?i)(BV[0-9A-Za-z]+)`)
var plasoCoursePattern = regexp.MustCompile(`course/([0-9-]+)`)
var baiduPanPattern = regexp.MustCompile(`(?:/s/|surl=)([A-Za-z0-9_-]+)`)

func parseLearningSource(sourceURL string) (model.LearningPlatform, string) {
	parsed, err := url.Parse(sourceURL)
	if err != nil {
		return "", ""
	}
	host := strings.ToLower(parsed.Hostname())
	switch {
	case strings.Contains(host, "bilibili"):
		if match := bilibiliBVPattern.FindStringSubmatch(sourceURL); match != nil {
			return "bilibili", match[1]
		}
		return "bilibili", ""
	case strings.Contains(host, "plaso"):
		if match := plasoCoursePattern.FindStringSubmatch(parsed.Path); match != nil {
			return "plaso", match[1]
		}
		return "plaso", ""
	case strings.Contains(host, "icourse163") || strings.Contains(host, "mooc"):
		return "mooc", ""
	case strings.Contains(host, "xiaoe"):
		return "xiaoe", ""
	case strings.Contains(host, "pan.baidu"):
		if match := baiduPanPattern.FindStringSubmatch(parsed.Path + "?" + parsed.RawQuery); match != nil {
			return "baiduPan", match[1]
		}
		return "baiduPan", ""
	default:
		return "other", ""
	}
}
