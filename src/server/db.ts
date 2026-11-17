import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'dojo.db');

const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const rawDb = new DatabaseSync(DB_PATH);
rawDb.exec('PRAGMA journal_mode = WAL;');
rawDb.exec('PRAGMA foreign_keys = ON;');

class StatementWrapper {
  private stmt: any;
  private paramNames: Set<string>;

  constructor(stmt: any, sql: string) {
    this.stmt = stmt;
    const matches = sql.match(/[@:$]([a-zA-Z0-9_]+)/g) || [];
    this.paramNames = new Set(matches.map(m => m.slice(1)));
  }

  private filterParams(args: any[]) {
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
      const obj = args[0];
      const filtered: Record<string, any> = {};
      for (const name of this.paramNames) {
        if (name in obj) {
          filtered[name] = obj[name] === undefined ? null : obj[name];
        } else if (`@${name}` in obj) {
          filtered[name] = obj[`@${name}`] === undefined ? null : obj[`@${name}`];
        } else if (`:${name}` in obj) {
          filtered[name] = obj[`:${name}`] === undefined ? null : obj[`:${name}`];
        } else if (`$${name}` in obj) {
          filtered[name] = obj[`$${name}`] === undefined ? null : obj[`$${name}`];
        }
      }
      return [filtered];
    }
    return args;
  }

  all(...args: any[]) {
    return this.stmt.all(...this.filterParams(args));
  }

  get(...args: any[]) {
    return this.stmt.get(...this.filterParams(args));
  }

  run(...args: any[]) {
    return this.stmt.run(...this.filterParams(args));
  }
}

class SqliteWrapper {
  exec(sql: string) {
    return rawDb.exec(sql);
  }

  prepare(sql: string) {
    const s = rawDb.prepare(sql);
    return new StatementWrapper(s, sql);
  }

  pragma(pragmaStr: string) {
    return rawDb.exec(`PRAGMA ${pragmaStr};`);
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => {
      rawDb.exec('BEGIN TRANSACTION;');
      try {
        const result = fn(...args);
        rawDb.exec('COMMIT;');
        return result;
      } catch (err) {
        try {
          rawDb.exec('ROLLBACK;');
        } catch {}
        throw err;
      }
    }) as T;
  }
}

const sqlite = new SqliteWrapper();

sqlite.exec(`
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

CREATE TABLE IF NOT EXISTS belt_levels (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  rank      INTEGER NOT NULL,
  color_hex TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  dob             TEXT,
  phone           TEXT DEFAULT '',
  parent_name     TEXT DEFAULT '',
  parent_phone    TEXT NOT NULL DEFAULT '',
  belt_level_id   INTEGER REFERENCES belt_levels(id),
  monthly_fee     INTEGER NOT NULL DEFAULT 1500,
  enrollment_date TEXT DEFAULT (date('now')),
  photo_path      TEXT DEFAULT '',
  status          TEXT DEFAULT 'ACTIVE',
  notes           TEXT DEFAULT '',
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attendance (
  id          TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL REFERENCES students(id),
  date        TEXT NOT NULL,
  status      TEXT NOT NULL,
  marked_at   TEXT DEFAULT (datetime('now')),
  notes       TEXT DEFAULT '',
  UNIQUE(student_id, date)
);

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

CREATE TABLE IF NOT EXISTS whatsapp_log (
  id           TEXT PRIMARY KEY,
  student_id   TEXT REFERENCES students(id),
  phone        TEXT NOT NULL,
  message_type TEXT NOT NULL,
  message      TEXT NOT NULL,
  sent_at      TEXT DEFAULT (datetime('now')),
  status       TEXT DEFAULT 'SENT'
);

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT NOT NULL UNIQUE,
  pin        TEXT NOT NULL,
  role       TEXT DEFAULT 'ADMIN',
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// Seed settings
const settingsRow = sqlite.prepare('SELECT id FROM settings WHERE id=1').get();
if (!settingsRow) {
  sqlite.prepare('INSERT INTO settings(id) VALUES(1)').run();
}

// Seed belts
const beltCount = (sqlite.prepare('SELECT COUNT(*) as cnt FROM belt_levels').get() as any).cnt;
if (beltCount === 0) {
  const insert = sqlite.prepare('INSERT INTO belt_levels(name, rank, color_hex) VALUES(?,?,?)');
  const belts = [
    ['White', 1, '#F8F8F8'],
    ['Yellow', 2, '#FFD700'],
    ['Orange', 3, '#FF8C00'],
    ['Green', 4, '#228B22'],
    ['Blue', 5, '#1E90FF'],
    ['Purple', 6, '#8B008B'],
    ['Red', 7, '#DC143C'],
    ['Brown', 8, '#8B4513'],
    ['Black', 9, '#1A1A1A'],
  ];
  for (const [name, rank, color_hex] of belts) {
    insert.run(name, rank, color_hex);
  }
}

// Seed admin
const adminExists = sqlite.prepare("SELECT id FROM users WHERE username='admin'").get();
if (!adminExists) {
  sqlite.prepare("INSERT INTO users(username, pin, role) VALUES('admin', '123456', 'ADMIN')").run();
}

export default sqlite;
