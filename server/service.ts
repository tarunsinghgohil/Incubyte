import { db } from "./db.js";
import type { Employee } from "./types.js";
import { fxRates, toUsd, toUsdMinor } from "./types.js";

type DirectoryQuery = {
  search?: string;
  country?: string;
  department?: string;
  status?: string;
  sortBy?: string;
  sort?: string;
  sortOrder?: string;
  direction?: string;
  page: number;
  pageSize: number;
};

const sortableColumns: Record<string, string> = {
  name: "first_name",
  employeeCode: "employee_code",
  country: "country",
  department: "department",
  annualSalary: "salary_minor",
  salary: "salary_minor",
  hireDate: "start_date",
};

export function parseAnnualSalary(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const minor = whole * 100 + fraction;
  return Number.isSafeInteger(minor) && minor > 0 && minor <= 100_000_000 ? minor : null;
}

export function present(employee: Employee & { [key: string]: unknown }) {
  return {
    ...employee,
    name: `${employee.first_name} ${employee.last_name}`,
    country: employee.country_name ?? employee.country,
    country_code: (employee as { country_code?: string }).country_code ?? employee.country,
    hire_date: employee.hire_date ?? employee.start_date,
    employment_status: employee.employment_status ?? "active",
    salary_usd: toUsd(employee.salary_minor, employee.currency),
  };
}

export function listEmployees(q: DirectoryQuery) {
  const clauses: string[] = [];
  const args: unknown[] = [];
  if (q.search) {
    clauses.push("(lower(employee_code) LIKE ? OR lower(first_name || ' ' || last_name) LIKE ? OR lower(email) LIKE ?)");
    const value = `%${q.search.toLowerCase()}%`;
    args.push(value, value, value);
  }
  if (q.country) {
    clauses.push("(country = ? OR country_name = ?)");
    args.push(q.country, q.country);
  }
  if (q.department) {
    clauses.push("department = ?");
    args.push(q.department);
  }
  if (q.status) {
    clauses.push("employment_status = ?");
    args.push(q.status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const totalRow = db.prepare(`SELECT COUNT(*) AS count FROM employees ${where}`).get(...args) as { count: number };
  const sortKey = q.sortBy ?? q.sort ?? "annualSalary";
  const column = sortableColumns[sortKey];
  if (!column) throw new Error("Invalid sort column");
  const direction = (q.sortOrder ?? q.direction) === "asc" ? "ASC" : "DESC";
  const rows = db.prepare(`
    SELECT * FROM employees ${where}
    ORDER BY ${column} ${direction}, id ASC
    LIMIT ? OFFSET ?
  `).all(...args, q.pageSize, (q.page - 1) * q.pageSize) as Employee[];

  return {
    data: rows.map(present),
    meta: {
      total: totalRow.count,
      page: q.page,
      pageSize: q.pageSize,
      pages: Math.max(1, Math.ceil(totalRow.count / q.pageSize)),
    },
  };
}

export function getEmployee(id: number) {
  const row = db.prepare("SELECT * FROM employees WHERE id = ?").get(id) as Employee | undefined;
  if (!row) return null;
  const history = db.prepare(`
    SELECT id, employee_id, old_salary_minor, new_salary_minor,
           COALESCE(currency, ?) AS currency,
           reason, COALESCE(effective_date, date(changed_at)) AS effective_date,
           COALESCE(changed_by, 'ACME HR') AS changed_by,
           COALESCE(created_at, changed_at) AS created_at,
           changed_at
    FROM salary_changes
    WHERE employee_id = ?
    ORDER BY COALESCE(created_at, changed_at) DESC, id DESC
  `).all(row.currency, id);
  return { ...present(row), history };
}

export function updateSalary(
  id: number,
  newSalaryMinor: number,
  reason: string,
  effectiveDate = new Date().toISOString().slice(0, 10),
) {
  const change = db.transaction(() => {
    const row = db.prepare("SELECT * FROM employees WHERE id = ?").get(id) as Employee | undefined;
    if (!row) return null;
    const now = new Date().toISOString();
    db.prepare("UPDATE employees SET salary_minor = ?, updated_at = ? WHERE id = ?")
      .run(newSalaryMinor, now, id);
    db.prepare(`
      INSERT INTO salary_changes(
        employee_id, old_salary_minor, new_salary_minor, reason,
        changed_at, currency, effective_date, changed_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, row.salary_minor, newSalaryMinor, reason, now, row.currency, effectiveDate, "ACME HR Demo", now);
    return getEmployee(id);
  });
  return change();
}

export function filters() {
  return {
    countries: (db.prepare(`
      SELECT DISTINCT COALESCE(country_name, country) AS value
      FROM employees ORDER BY value
    `).all() as Array<{ value: string }>).map((row) => row.value),
    departments: (db.prepare("SELECT DISTINCT department AS value FROM employees ORDER BY value")
      .all() as Array<{ value: string }>).map((row) => row.value),
    statuses: ["active", "inactive"],
  };
}

export function analytics() {
  const all = db.prepare(`
    SELECT salary_minor, currency, country, country_name, department
    FROM employees WHERE employment_status = 'active'
  `).all() as Array<{
    salary_minor: number;
    currency: string;
    country: string;
    country_name: string | null;
    department: string;
  }>;

  const usdMinor = all.map((employee) => toUsdMinor(employee.salary_minor, employee.currency)).sort((a, b) => a - b);
  const payrollMinor = usdMinor.reduce((sum, value) => sum + value, 0);

  const countryMap = new Map<string, { headcount: number; payrollMinor: number }>();
  const departmentMap = new Map<string, { headcount: number; payrollMinor: number }>();
  for (const employee of all) {
    const converted = toUsdMinor(employee.salary_minor, employee.currency);
    const country = employee.country_name ?? employee.country;
    for (const [map, key] of [[countryMap, country], [departmentMap, employee.department]] as const) {
      const group = map.get(key) ?? { headcount: 0, payrollMinor: 0 };
      group.headcount += 1;
      group.payrollMinor += converted;
      map.set(key, group);
    }
  }

  const summarize = (map: Map<string, { headcount: number; payrollMinor: number }>) =>
    Array.from(map, ([name, group]) => ({
      name,
      headcount: group.headcount,
      payrollUsd: Math.round(group.payrollMinor / 100),
      averageUsd: Math.round(group.payrollMinor / group.headcount / 100),
    })).sort((a, b) => b.headcount - a.headcount || a.name.localeCompare(b.name));

  let medianMinor = 0;
  if (usdMinor.length) {
    const middle = Math.floor(usdMinor.length / 2);
    medianMinor = usdMinor.length % 2
      ? usdMinor[middle]
      : Math.round((usdMinor[middle - 1] + usdMinor[middle]) / 2);
  }

  return {
    headcount: all.length,
    payrollUsd: Math.round(payrollMinor / 100),
    averageUsd: all.length ? Math.round(payrollMinor / all.length / 100) : 0,
    medianUsd: medianMinor / 100,
    byCountry: summarize(countryMap).map(({ name, ...group }) => ({ country: name, ...group })),
    byDepartment: summarize(departmentMap).map(({ name, ...group }) => ({ department: name, ...group })),
    fxRates,
  };
}
