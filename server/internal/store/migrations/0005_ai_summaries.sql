CREATE TABLE IF NOT EXISTS ai_summaries (
    id TEXT PRIMARY KEY,
    period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
    scope TEXT NOT NULL CHECK (scope IN ('all', 'health', 'finance', 'learning', 'workbench')),
    period_key TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    file_path TEXT,
    generated_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_summaries_lookup_idx
    ON ai_summaries (period, scope, period_key, generated_at DESC);
