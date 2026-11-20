import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const dbPath = process.env.DB_PATH ?? "data/acme.db";
mkdirSync(dirname(dbPath), { recursive: true });
export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initialize() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY, employee_code TEXT NOT NULL UNIQUE, first_name TEXT NOT NULL,
      last_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, department TEXT NOT NULL,
      country TEXT NOT NULL, country_name TEXT, currency TEXT NOT NULL, salary_minor INTEGER NOT NULL CHECK(salary_minor >= 0),
      job_title TEXT NOT NULL, start_date TEXT NOT NULL, hire_date TEXT, employment_status TEXT NOT NULL DEFAULT 'active',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS salary_changes (
      id INTEGER PRIMARY KEY, employee_id INTEGER NOT NULL REFERENCES employees(id),
      old_salary_minor INTEGER NOT NULL, new_salary_minor INTEGER NOT NULL, reason TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      currency TEXT,
      effective_date TEXT,
      changed_by TEXT,
      created_at TEXT
    );
  `);

  const employeeColumns = new Set(
    (db.prepare("PRAGMA table_info(employees)").all() as Array<{ name: string }>).map((column) => column.name),
  );
  if (!employeeColumns.has("country_name")) db.exec("ALTER TABLE employees ADD COLUMN country_name TEXT");
  if (!employeeColumns.has("hire_date")) db.exec("ALTER TABLE employees ADD COLUMN hire_date TEXT");
  if (!employeeColumns.has("employment_status")) {
    db.exec("ALTER TABLE employees ADD COLUMN employment_status TEXT NOT NULL DEFAULT 'active'");
  }

  const changeColumns = new Set(
    (db.prepare("PRAGMA table_info(salary_changes)").all() as Array<{ name: string }>).map((column) => column.name),
  );
  if (!changeColumns.has("currency")) db.exec("ALTER TABLE salary_changes ADD COLUMN currency TEXT");
  if (!changeColumns.has("effective_date")) db.exec("ALTER TABLE salary_changes ADD COLUMN effective_date TEXT");
  if (!changeColumns.has("changed_by")) db.exec("ALTER TABLE salary_changes ADD COLUMN changed_by TEXT");
  if (!changeColumns.has("created_at")) db.exec("ALTER TABLE salary_changes ADD COLUMN created_at TEXT");

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_employee_filters ON employees(country, department, salary_minor);
    CREATE INDEX IF NOT EXISTS idx_employee_status ON employees(employment_status);
    CREATE INDEX IF NOT EXISTS idx_employee_name ON employees(first_name, last_name);
    CREATE INDEX IF NOT EXISTS idx_employee_hire_date ON employees(start_date);
    CREATE INDEX IF NOT EXISTS idx_change_employee ON salary_changes(employee_id, changed_at DESC);
  `);

  db.exec(`
    UPDATE employees SET
      country_name = COALESCE(country_name, country),
      hire_date = COALESCE(hire_date, start_date),
      employment_status = COALESCE(employment_status, 'active')
    WHERE country_name IS NULL OR hire_date IS NULL OR employment_status IS NULL;
  `);
}
