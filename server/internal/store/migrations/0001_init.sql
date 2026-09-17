CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  weekly_workout_target INTEGER NOT NULL,
  expense_categories TEXT NOT NULL,
  income_categories TEXT NOT NULL,
  font_scale TEXT NOT NULL,
  reduced_motion INTEGER NOT NULL CHECK (reduced_motion IN (0, 1))
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  meta TEXT NOT NULL,
  done INTEGER NOT NULL CHECK (done IN (0, 1)),
  date TEXT NOT NULL,
  time TEXT,
  category TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  goal TEXT NOT NULL,
  status TEXT NOT NULL,
  next_action TEXT NOT NULL,
  due_date TEXT,
  created_at TEXT NOT NULL
);
