package store

import (
	"context"
	"path/filepath"
	"testing"

	"personal-os/server/internal/model"
)

func TestBackupCreatesIndependentDatabase(t *testing.T) {
	ctx := context.Background()
	sourcePath := filepath.Join(t.TempDir(), "personal-os.db")
	source, err := Open(sourcePath)
	if err != nil {
		t.Fatalf("open source: %v", err)
	}
	if err := source.Migrate(ctx); err != nil {
		t.Fatalf("migrate source: %v", err)
	}
	if _, err := source.CreateTask(ctx, model.TaskInput{
		Title:    "备份验证",
		Date:     "2026-09-18",
		Category: model.TaskCategory("work"),
	}, false); err != nil {
		t.Fatalf("create task: %v", err)
	}

	backupPath := filepath.Join(t.TempDir(), "backup.db")
	if err := source.Backup(ctx, backupPath); err != nil {
		t.Fatalf("backup: %v", err)
	}
	if err := source.Close(); err != nil {
		t.Fatalf("close source: %v", err)
	}

	restored, err := Open(backupPath)
	if err != nil {
		t.Fatalf("open backup: %v", err)
	}
	defer restored.Close()
	state, err := restored.LoadState(ctx)
	if err != nil {
		t.Fatalf("load backup state: %v", err)
	}
	if len(state.Tasks) != 1 || state.Tasks[0].Title != "备份验证" {
		t.Fatalf("unexpected backup tasks: %+v", state.Tasks)
	}
}

func TestRestartPersistsRecords(t *testing.T) {
	ctx := context.Background()
	dbPath := filepath.Join(t.TempDir(), "personal-os.db")
	first, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open first: %v", err)
	}
	if err := first.Migrate(ctx); err != nil {
		t.Fatalf("migrate first: %v", err)
	}
	created, err := first.CreateTask(ctx, model.TaskInput{
		Title:    "重启后仍在",
		Date:     "2026-09-18",
		Category: model.TaskCategory("work"),
	}, false)
	if err != nil {
		t.Fatalf("create task: %v", err)
	}
	if err := first.Close(); err != nil {
		t.Fatalf("close first: %v", err)
	}

	second, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open second: %v", err)
	}
	defer second.Close()
	state, err := second.LoadState(ctx)
	if err != nil {
		t.Fatalf("load second: %v", err)
	}
	if len(state.Tasks) != 1 || state.Tasks[0].ID != created.ID || state.Tasks[0].Title != "重启后仍在" {
		t.Fatalf("unexpected persisted tasks: %+v", state.Tasks)
	}
}
