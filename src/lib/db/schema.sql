-- Academy settings (single row)
CREATE TABLE IF NOT EXISTS settings (
  id              INTEGER PRIMARY KEY DEFAULT 1,
  academy_name    TEXT NOT NULL DEFAULT 'Dojo Master Academy',
  address         TEXT DEFAULT '',
  phone           TEXT DEFAULT '',
  whatsapp_number TEXT DEFAULT '',
  logo_path       TEXT DEFAULT '',
  monthly_fee_default INTEGER DEFAULT 1500,
  fee_due_day     INTEGER DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- Belt levels reference table
CREATE TABLE IF NOT EXISTS belt_levels (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  rank      INTEGER NOT NULL,
  color_hex TEXT NOT NULL
);

-- Students
CREATE TABLE IF NOT EXISTS students (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  dob             TEXT,
  phone           TEXT DEFAULT '',
  parent_name     TEXT DEFAULT '',
  parent_phone    TEXT NOT NULL,
  belt_level_id   INTEGER REFERENCES belt_levels(id),
  monthly_fee     INTEGER NOT NULL DEFAULT 1500,
  enrollment_date TEXT DEFAULT (date('now')),
  photo_path      TEXT DEFAULT '',
  status          TEXT DEFAULT 'ACTIVE',
  notes           TEXT DEFAULT '',
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- Attendance records
CREATE TABLE IF NOT EXISTS attendance (
  id          TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL REFERENCES students(id),
  date        TEXT NOT NULL,
  status      TEXT NOT NULL,
  marked_at   TEXT DEFAULT (datetime('now')),
  notes       TEXT DEFAULT '',
  UNIQUE(student_id, date)
);

-- Fee records (one per student per month)
CREATE TABLE IF NOT EXISTS fees (
  id              TEXT PRIMARY KEY,
  student_id      TEXT NOT NULL REFERENCES students(id),
  month           TEXT NOT NULL,
  amount_due      INTEGER NOT NULL,
  amount_paid     INTEGER DEFAULT 0,
  payment_status  TEXT DEFAULT 'UNPAID',
  payment_date    TEXT,
  payment_mode    TEXT DEFAULT 'CASH',
  receipt_number  TEXT,
  notes           TEXT DEFAULT '',
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now')),
  UNIQUE(student_id, month)
);

-- WhatsApp message log
CREATE TABLE IF NOT EXISTS whatsapp_log (
  id           TEXT PRIMARY KEY,
  student_id   TEXT REFERENCES students(id),
  phone        TEXT NOT NULL,
  message_type TEXT NOT NULL,
  message      TEXT NOT NULL,
  sent_at      TEXT DEFAULT (datetime('now')),
  status       TEXT DEFAULT 'SENT'
);

-- Admin users
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT NOT NULL UNIQUE,
  pin        TEXT NOT NULL,
  role       TEXT DEFAULT 'ADMIN',
  created_at TEXT DEFAULT (datetime('now'))
);
