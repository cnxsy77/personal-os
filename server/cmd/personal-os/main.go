package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"personal-os/server/internal/api"
	"personal-os/server/internal/ai"
	"personal-os/server/internal/store"
)

func main() {
	dbPath := flag.String("db", "data/personal-os.db", "SQLite database path")
	migrateOnly := flag.Bool("migrate-only", false, "run migrations and exit")
	backupPath := flag.String("backup", "", "create a SQLite backup at the path and exit")
	addr := flag.String("addr", "127.0.0.1:8787", "HTTP listen address")
	flag.Parse()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	st, err := store.Open(*dbPath)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer st.Close()
	if err := st.Migrate(ctx); err != nil {
		log.Fatalf("migrate database: %v", err)
	}
	if *migrateOnly {
		absolutePath, pathErr := filepath.Abs(*dbPath)
		if pathErr != nil {
			absolutePath = *dbPath
		}
		log.Printf("database ready: %s", absolutePath)
		return
	}
	if *backupPath != "" {
		if err := st.Backup(ctx, *backupPath); err != nil {
			log.Fatalf("backup database: %v", err)
		}
		log.Printf("database backup ready: %s", *backupPath)
		return
	}

	aiConfig, err := ai.LoadConfig(".env")
	if err != nil {
		log.Fatalf("load AI config: %v", err)
	}

	server := &http.Server{
		Addr:              *addr,
		Handler: api.New(
			st,
			api.WithAIClient(ai.NewClient(aiConfig)),
			api.WithReportsDir("reports/ai-summaries"),
		).Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()
	log.Printf("Personal OS API listening on http://%s", *addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server error: %v", err)
	}
}
