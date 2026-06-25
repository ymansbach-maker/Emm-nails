// Uses Node's built-in SQLite (node:sqlite, Node >= 22.5) — no native build step,
// which keeps installs trivial on both Windows dev machines and Render.
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_BUSINESS } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DATA_DIR lets Render mount a persistent disk; defaults to server/data locally.
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'gemmys.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS businesses (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
  );

  -- The UNIQUE(business_id, date, time) constraint is the hard guarantee
  -- against double bookings: two concurrent inserts for the same slot can
  -- never both succeed, regardless of what the UI shows.
  CREATE TABLE IF NOT EXISTS appointments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id),
    date        TEXT NOT NULL,
    time        TEXT NOT NULL,
    name        TEXT NOT NULL,
    phone       TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    UNIQUE (business_id, date, time)
  );

  -- Admin-blocked slots. time = '' means the entire day is blocked.
  CREATE TABLE IF NOT EXISTS blocks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id),
    date        TEXT NOT NULL,
    time        TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    UNIQUE (business_id, date, time)
  );

  CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(business_id, date);
  CREATE INDEX IF NOT EXISTS idx_blocks_date ON blocks(business_id, date);
`);

db.prepare('INSERT OR IGNORE INTO businesses (slug, name) VALUES (?, ?)')
  .run(DEFAULT_BUSINESS.slug, DEFAULT_BUSINESS.name);

// Recovery: if a previous migration left _appt_mig behind, finish it.
{
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  if (tables.includes('_appt_mig') && !tables.includes('appointments')) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('ALTER TABLE _appt_mig RENAME TO appointments');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(business_id, date)');
  } else if (tables.includes('_appt_mig')) {
    db.exec('DROP TABLE _appt_mig');
  }
}

// Migrations — safe to re-run (ALTER TABLE is a no-op if column exists).
try { db.exec('ALTER TABLE appointments ADD COLUMN email TEXT'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE appointments ADD COLUMN service TEXT'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE appointments ADD COLUMN duration INTEGER DEFAULT 30'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE appointments ADD COLUMN notes TEXT'); } catch { /* already exists */ }

// Migration: make time nullable so after-hours appointments (no specific time) can coexist.
// SQLite UNIQUE treats NULLs as distinct, so multiple after-hours per day work correctly.
// Each statement is a separate exec() call so a partial failure is diagnosable and the
// recovery block at the top can finish the rename on the next startup.
{
  const tcol = db.prepare("PRAGMA table_info('appointments')").all().find((c) => c.name === 'time');
  if (tcol?.notnull === 1) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('DROP TABLE IF EXISTS _appt_mig');
    db.exec(`CREATE TABLE _appt_mig (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id    INTEGER NOT NULL,
      date           TEXT NOT NULL,
      time           TEXT,
      name           TEXT NOT NULL,
      phone          TEXT NOT NULL,
      created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      email          TEXT,
      service        TEXT,
      duration       INTEGER DEFAULT 30,
      notes          TEXT,
      is_personal    INTEGER NOT NULL DEFAULT 0,
      is_after_hours INTEGER NOT NULL DEFAULT 0,
      UNIQUE (business_id, date, time)
    )`);
    db.exec(`INSERT INTO _appt_mig (id, business_id, date, time, name, phone, created_at, email, service, duration, notes)
      SELECT id, business_id, date, time, name, phone, created_at, email, service, duration, notes FROM appointments`);
    db.exec('DROP TABLE appointments');
    db.exec('ALTER TABLE _appt_mig RENAME TO appointments');
    db.exec('CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(business_id, date)');
    db.exec('PRAGMA foreign_keys = ON');
  }
}
try { db.exec('ALTER TABLE appointments ADD COLUMN is_personal    INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE appointments ADD COLUMN is_after_hours INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE appointments ADD COLUMN paid           INTEGER NOT NULL DEFAULT 0'); } catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS waiting_list (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id),
    date        TEXT NOT NULL,
    name        TEXT NOT NULL,
    phone       TEXT NOT NULL,
    email       TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS idx_waiting_list_date ON waiting_list(business_id, date);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS service_colors (
    service TEXT PRIMARY KEY,
    color   TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    phone      TEXT NOT NULL,
    rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    text       TEXT,
    anonymous  INTEGER NOT NULL DEFAULT 0,
    approved   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS idx_reviews_approved ON reviews(approved, created_at);
`);

// True when an insert failed because the row already exists.
export function isUniqueViolation(err) {
  return err instanceof Error && /UNIQUE constraint failed/.test(err.message);
}

export default db;
