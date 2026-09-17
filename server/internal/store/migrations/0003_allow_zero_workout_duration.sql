CREATE TABLE workouts_new (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 0),
  notes TEXT NOT NULL,
  plan TEXT,
  focus TEXT,
  warmup TEXT,
  finisher TEXT,
  soreness_areas TEXT,
  coach_notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE workout_kinds_new (
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (workout_id, kind)
);

CREATE TABLE workout_exercises_new (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prescription TEXT,
  target TEXT,
  sort_order INTEGER NOT NULL
);

INSERT INTO workouts_new (
  id, date, kind, status, duration_minutes, notes, plan, focus, warmup,
  finisher, soreness_areas, coach_notes, created_at
)
SELECT id, date, kind, status, duration_minutes, notes, plan, focus, warmup,
       finisher, soreness_areas, coach_notes, created_at
FROM workouts;

INSERT INTO workout_kinds_new (workout_id, kind, sort_order)
SELECT workout_id, kind, sort_order FROM workout_kinds;

INSERT INTO workout_exercises_new (id, workout_id, name, prescription, target, sort_order)
SELECT id, workout_id, name, prescription, target, sort_order FROM workout_exercises;

DROP TABLE workout_exercises;
DROP TABLE workout_kinds;
DROP TABLE workouts;

ALTER TABLE workouts_new RENAME TO workouts;
ALTER TABLE workout_kinds_new RENAME TO workout_kinds;
ALTER TABLE workout_exercises_new RENAME TO workout_exercises;
