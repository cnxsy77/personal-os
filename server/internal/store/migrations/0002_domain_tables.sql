ALTER TABLE settings ADD COLUMN monthly_budget_cents INTEGER NOT NULL DEFAULT 0;

CREATE TABLE payment_orders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  expected_total_cents INTEGER NOT NULL CHECK (expected_total_cents >= 0),
  created_at TEXT NOT NULL
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category TEXT NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  tag TEXT,
  order_id TEXT REFERENCES payment_orders(id) ON DELETE SET NULL,
  stage TEXT,
  recurring_id TEXT,
  related_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  counterparty TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  source_trade_no TEXT,
  occurred_at TEXT,
  import_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX transactions_date_idx ON transactions(date DESC, created_at DESC);
CREATE UNIQUE INDEX transactions_source_trade_no_unique
  ON transactions(source, source_trade_no)
  WHERE source_trade_no IS NOT NULL AND source_trade_no <> '';

CREATE TABLE recurring_transactions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  next_date TEXT NOT NULL,
  note TEXT,
  active INTEGER NOT NULL CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE bill_imports (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('alipay', 'wechat')),
  file_name TEXT NOT NULL,
  imported_at TEXT NOT NULL
);

CREATE TABLE bill_import_transactions (
  import_id TEXT NOT NULL REFERENCES bill_imports(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (import_id, transaction_id)
);

CREATE TABLE learning_paths (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  target_minutes INTEGER NOT NULL CHECK (target_minutes >= 0),
  created_at TEXT NOT NULL
);

CREATE TABLE learning_resources (
  id TEXT PRIMARY KEY,
  path_id TEXT REFERENCES learning_paths(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  platform TEXT,
  source_url TEXT,
  external_id TEXT,
  target_minutes INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE learning_lessons (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES learning_resources(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  status TEXT NOT NULL,
  expected_minutes INTEGER,
  source_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE study_logs (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  minutes INTEGER NOT NULL CHECK (minutes > 0),
  date TEXT NOT NULL,
  path_id TEXT REFERENCES learning_paths(id) ON DELETE SET NULL,
  platform TEXT,
  resource_id TEXT REFERENCES learning_resources(id) ON DELETE SET NULL,
  lesson_id TEXT REFERENCES learning_lessons(id) ON DELETE SET NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE learning_note_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE learning_notes (
  id TEXT PRIMARY KEY,
  folder_id TEXT REFERENCES learning_note_folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  resource_id TEXT REFERENCES learning_resources(id) ON DELETE SET NULL,
  lesson_id TEXT REFERENCES learning_lessons(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE learning_note_tags (
  note_id TEXT NOT NULL REFERENCES learning_notes(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (note_id, tag)
);

CREATE TABLE weekly_reviews (
  id TEXT PRIMARY KEY,
  week_start_date TEXT NOT NULL UNIQUE,
  wins TEXT NOT NULL,
  blockers TEXT NOT NULL,
  next_focus TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE workouts (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  notes TEXT NOT NULL,
  plan TEXT,
  focus TEXT,
  warmup TEXT,
  finisher TEXT,
  soreness_areas TEXT,
  coach_notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE workout_kinds (
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (workout_id, kind)
);

CREATE TABLE workout_exercises (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prescription TEXT,
  target TEXT,
  sort_order INTEGER NOT NULL
);

CREATE TABLE health_metrics (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  sleep_hours REAL NOT NULL CHECK (sleep_hours >= 0),
  weight_kg REAL,
  condition TEXT NOT NULL,
  menstruation_flow TEXT,
  menstruation_symptoms TEXT,
  menstruation_note TEXT,
  created_at TEXT NOT NULL
);
