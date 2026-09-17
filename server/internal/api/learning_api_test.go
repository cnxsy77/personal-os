package api_test

import (
	"net/http"
	"testing"
)

func TestLearningWriteAPIs(t *testing.T) {
	handler := newTestServer(t)
	headers := map[string]string{"X-Personal-OS-Client": "local"}

	pathResponse := request(t, handler, http.MethodPost, "/api/learning-paths", map[string]any{
		"title": "AI 工程", "targetMinutes": 600,
	}, headers)
	if pathResponse.Code != http.StatusCreated {
		t.Fatalf("create path status = %d, body = %s", pathResponse.Code, pathResponse.Body.String())
	}
	pathState := decodeState(t, pathResponse)
	pathID := pathState.LearningPaths[0].ID

	resourceResponse := request(t, handler, http.MethodPost, "/api/learning-resources", map[string]any{
		"pathId": pathID, "title": "Transformer 课程", "kind": "course", "status": "todo",
		"sourceUrl": "https://www.bilibili.com/video/BV1q5YL69E44/",
	}, headers)
	if resourceResponse.Code != http.StatusCreated {
		t.Fatalf("create resource status = %d, body = %s", resourceResponse.Code, resourceResponse.Body.String())
	}
	resourceState := decodeState(t, resourceResponse)
	resource := resourceState.LearningResources[0]
	if resource.Platform != "bilibili" || resource.ExternalID != "BV1q5YL69E44" {
		t.Fatalf("source was not recognized: %+v", resource)
	}
	resourceID := resource.ID

	lessonsResponse := request(t, handler, http.MethodPost, "/api/learning-resources/"+resourceID+"/lessons", map[string]any{
		"lessons": []any{
			map[string]any{"title": "注意力机制", "expectedMinutes": 25},
			map[string]any{"title": "训练实践"},
		},
	}, headers)
	if lessonsResponse.Code != http.StatusCreated {
		t.Fatalf("add lessons status = %d, body = %s", lessonsResponse.Code, lessonsResponse.Body.String())
	}
	lessonState := decodeState(t, lessonsResponse)
	if len(lessonState.LearningLessons) != 2 || lessonState.LearningLessons[0].SortOrder != 1 {
		t.Fatalf("unexpected lessons: %+v", lessonState.LearningLessons)
	}
	lessonID := lessonState.LearningLessons[0].ID
	if status := request(t, handler, http.MethodPatch, "/api/learning-lessons/"+lessonID+"/status", map[string]any{"status": "doing"}, headers); status.Code != http.StatusOK {
		t.Fatalf("lesson status status = %d", status.Code)
	}

	studyResponse := request(t, handler, http.MethodPost, "/api/study-logs", map[string]any{
		"topic": "注意力机制", "minutes": 45, "date": "2026-09-17", "pathId": pathID,
		"resourceId": resourceID, "lessonId": lessonID, "note": "理解 Q/K/V",
	}, headers)
	if studyResponse.Code != http.StatusCreated {
		t.Fatalf("create study log status = %d, body = %s", studyResponse.Code, studyResponse.Body.String())
	}
	studyState := decodeState(t, studyResponse)
	studyID := studyState.StudyLogs[0].ID

	folderResponse := request(t, handler, http.MethodPost, "/api/learning-note-folders", map[string]any{"name": "AI"}, headers)
	if folderResponse.Code != http.StatusCreated {
		t.Fatalf("create folder status = %d", folderResponse.Code)
	}
	folderID := decodeState(t, folderResponse).LearningNoteFolders[0].ID
	noteResponse := request(t, handler, http.MethodPost, "/api/learning-notes", map[string]any{
		"folderId": folderID, "title": "注意力笔记", "content": "# Q/K/V\n注意维度对齐。",
		"tags": []string{"ai", " attention "}, "resourceId": resourceID, "lessonId": lessonID,
	}, headers)
	if noteResponse.Code != http.StatusCreated {
		t.Fatalf("create note status = %d, body = %s", noteResponse.Code, noteResponse.Body.String())
	}
	noteState := decodeState(t, noteResponse)
	if noteState.LearningNotes[0].Tags[0] != "ai" || noteState.LearningNotes[0].Tags[1] != "attention" {
		t.Fatalf("note tags were not normalized: %+v", noteState.LearningNotes[0].Tags)
	}

	firstReview := request(t, handler, http.MethodPost, "/api/weekly-reviews", map[string]any{
		"weekStartDate": "2026-09-14", "wins": "完成课程", "blockers": "时间少", "nextFocus": "实践",
	}, headers)
	if firstReview.Code != http.StatusCreated {
		t.Fatalf("create review status = %d", firstReview.Code)
	}
	upsertReview := request(t, handler, http.MethodPost, "/api/weekly-reviews", map[string]any{
		"weekStartDate": "2026-09-14", "wins": "完成两次复盘", "blockers": "", "nextFocus": "部署",
	}, headers)
	if upsertReview.Code != http.StatusCreated {
		t.Fatalf("upsert review status = %d", upsertReview.Code)
	}
	reviewState := decodeState(t, upsertReview)
	if len(reviewState.WeeklyReviews) != 1 || reviewState.WeeklyReviews[0].Wins != "完成两次复盘" {
		t.Fatalf("weekly review upsert failed: %+v", reviewState.WeeklyReviews)
	}

	deleteResource := request(t, handler, http.MethodDelete, "/api/learning-resources/"+resourceID, nil, headers)
	if deleteResource.Code != http.StatusOK {
		t.Fatalf("delete resource status = %d, body = %s", deleteResource.Code, deleteResource.Body.String())
	}
	resourceDeleteState := decodeState(t, deleteResource)
	if len(resourceDeleteState.LearningResources) != 0 || len(resourceDeleteState.LearningLessons) != 0 {
		t.Fatalf("resource and lessons were not removed")
	}
	studyLog := resourceDeleteState.StudyLogs[0]
	note := resourceDeleteState.LearningNotes[0]
	if studyLog.ResourceID != nil || studyLog.LessonID != nil || note.ResourceID != nil || note.LessonID != nil {
		t.Fatalf("deleting a course did not preserve and clear linked records: %+v %+v", studyLog, note)
	}

	deletePath := request(t, handler, http.MethodDelete, "/api/learning-paths/"+pathID, nil, headers)
	if deletePath.Code != http.StatusOK {
		t.Fatalf("delete path status = %d", deletePath.Code)
	}
	pathDeleteState := decodeState(t, deletePath)
	if len(pathDeleteState.LearningPaths) != 0 || pathDeleteState.StudyLogs[0].PathID != nil {
		t.Fatalf("path deletion did not preserve and clear study logs")
	}

	if invalid := request(t, handler, http.MethodPost, "/api/study-logs", map[string]any{
		"topic": "", "minutes": 0, "date": "bad",
	}, headers); invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid study log status = %d", invalid.Code)
	}
	if missing := request(t, handler, http.MethodDelete, "/api/study-logs/"+studyID+"-missing", nil, headers); missing.Code != http.StatusNotFound {
		t.Fatalf("missing study log status = %d", missing.Code)
	}
}
