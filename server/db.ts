import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const dbPath = process.env.DB_PATH ?? "data/acme.db";
mkdirSync(dirname(dbPath), { recursive: true });
export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

export function initialize() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY, employee_code TEXT NOT NULL UNIQUE, first_name TEXT NOT NULL,
      last_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, department TEXT NOT NULL,
      country TEXT NOT NULL, currency TEXT NOT NULL, salary_minor INTEGER NOT NULL CHECK(salary_minor >= 0),
      job_title TEXT NOT NULL, start_date TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS salary_changes (
      id INTEGER PRIMARY KEY, employee_id INTEGER NOT NULL REFERENCES employees(id),
      old_salary_minor INTEGER NOT NULL, new_salary_minor INTEGER NOT NULL, reason TEXT NOT NULL,
      changed_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_employee_filters ON employees(country, department, salary_minor);
    CREATE INDEX IF NOT EXISTS idx_change_employee ON salary_changes(employee_id, changed_at DESC);
  `);
}
