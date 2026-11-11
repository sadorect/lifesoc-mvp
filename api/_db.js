// The app's own SQLite database: Better Auth's tables (user, session, account,
// verification) plus `entitlement`, which replaces Clerk's user metadata.
// Lives on a Docker volume in production (DATA_DIR=/data).
import './_env.js'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'

const dir = process.env.DATA_DIR ?? 'selfhost/data'
mkdirSync(dir, { recursive: true })

export const db = new Database(process.env.DB_PATH ?? join(dir, 'lifesoc.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 5000')

// One row per reader who has redeemed (or been given) access.
// Mirrors the old Clerk fields: privateMetadata.{bookRedeemed, redeemedAt,
// accessType, reviewer, reviewerCode} and publicMetadata.canDownload.
db.exec(`
  CREATE TABLE IF NOT EXISTS entitlement (
    user_id       TEXT PRIMARY KEY,
    book_redeemed INTEGER NOT NULL DEFAULT 0,
    redeemed_at   TEXT,
    access_type   TEXT,
    reviewer      TEXT,
    reviewer_code TEXT,
    can_download  INTEGER NOT NULL DEFAULT 0,
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )
`)

// Admin-managed data (2026-11-11).
db.exec(`
  CREATE TABLE IF NOT EXISTS setting (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE TABLE IF NOT EXISTS reviewer_code (
    code       TEXT PRIMARY KEY,           -- stored normalised (lowercase, trimmed)
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    revoked_at TEXT
  );
  -- One row per counted action, for the admin overview (no content is stored).
  CREATE TABLE IF NOT EXISTS usage_event (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    kind    TEXT NOT NULL,                  -- chat | scan | redeem
    at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS usage_event_at ON usage_event (at);
  CREATE TABLE IF NOT EXISTS admin_audit (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    admin  TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    detail TEXT
  );
`)

// Manual access extensions override the default 365 days from redemption.
if (!db.prepare('PRAGMA table_info(entitlement)').all().some((c) => c.name === 'access_until')) {
  db.exec('ALTER TABLE entitlement ADD COLUMN access_until TEXT')
}
