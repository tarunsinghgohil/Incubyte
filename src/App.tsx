import { useEffect, useState } from "react";
import { api, Employee, money } from "./api";

type GroupMetric = { headcount: number; payrollUsd: number; averageUsd: number };
type Analytics = {
  headcount: number;
  payrollUsd: number;
  averageUsd: number;
  medianUsd: number;
  byCountry: ({ country: string } & GroupMetric)[];
  byDepartment: ({ department: string } & GroupMetric)[];
};
type Filters = { countries: string[]; departments: string[] };
type DirectoryMeta = { total: number; page: number; pages: number; pageSize: number };
type Feedback = { text: string; error: boolean };

export default function App() {
  const [analytics, setAnalytics] = useState<Analytics>();
  const [filters, setFilters] = useState<Filters>({ countries: [], departments: [] });
  const [rows, setRows] = useState<Employee[]>([]);
  const [meta, setMeta] = useState<DirectoryMeta>({ total: 0, page: 1, pages: 1, pageSize: 25 });
  const [query, setQuery] = useState({
    search: "",
    country: "",
    department: "",
    sort: "salary",
    direction: "desc",
  });
  const [selected, setSelected] = useState<Employee>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api<Analytics>("/analytics", { signal: controller.signal }),
      api<Filters>("/filters", { signal: controller.signal }),
    ])
      .then(([summary, options]) => {
        setAnalytics(summary);
        setFilters(options);
      })
      .catch((cause: unknown) => {
        if (!(cause instanceof Error && cause.name === "AbortError")) {
          setError(errorMessage(cause));
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      ...query,
      page: String(meta.page),
      pageSize: String(meta.pageSize),
    });
    setLoading(true);
    api<{ data: Employee[]; meta: DirectoryMeta }>(`/employees?${params}`, {
      signal: controller.signal,
    })
      .then((result) => {
        setRows(result.data);
        setMeta(result.meta);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!(cause instanceof Error && cause.name === "AbortError")) {
          setRows([]);
          setError(errorMessage(cause));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, meta.page, meta.pageSize]);

  const updateQuery = (key: "search" | "country" | "department", value: string) => {
    setMeta((current) => ({ ...current, page: 1 }));
    setQuery((current) => ({ ...current, [key]: value }));
  };

  return (
    <main>
      <header>
        <div>
          <span className="eyebrow">ACME / PEOPLE OPERATIONS</span>
          <h1>Compensation Hub</h1>
        </div>
        <span className="live">● Data workspace</span>
      </header>
      {error && <p className="error" role="alert">{error}</p>}

      <section className="metrics" aria-label="Organization compensation metrics">
        {[
          ["Total headcount", analytics?.headcount?.toLocaleString()],
          ["Annual payroll (USD)", analytics && money(analytics.payrollUsd * 100)],
          ["Median salary (USD)", analytics && money(analytics.medianUsd * 100)],
          ["Average salary (USD)", analytics && money(analytics.averageUsd * 100)],
        ].map(([label, value]) => (
          <article key={label}>
            <small>{label}</small>
            <strong>{value ?? "—"}</strong>
            <span>Across active employees</span>
          </article>
        ))}
      </section>

      <section className="workspace">
        <div className="directory">
          <div className="section-title">
            <div>
              <span className="eyebrow">EMPLOYEE DIRECTORY</span>
              <h2>Salary records</h2>
            </div>
            <span>{meta.total.toLocaleString()} employees</span>
          </div>
          <div className="controls">
            <input
              aria-label="Search employees"
              placeholder="Search name, email or employee ID"
              value={query.search}
              onChange={(event) => updateQuery("search", event.target.value)}
            />
            <select
              aria-label="Filter by country"
              value={query.country}
              onChange={(event) => updateQuery("country", event.target.value)}
            >
              <option value="">All countries</option>
              {filters.countries.map((country) => <option key={country}>{country}</option>)}
            </select>
            <select
              aria-label="Filter by department"
              value={query.department}
              onChange={(event) => updateQuery("department", event.target.value)}
            >
              <option value="">All departments</option>
              {filters.departments.map((department) => <option key={department}>{department}</option>)}
            </select>
          </div>
          <table>
            <thead>
              <tr>
                <th>
                  <button
                    className="sort"
                    aria-label="Sort employees by first name"
                    onClick={() => setQuery((current) => ({
                      ...current,
                      sort: "name",
                      direction: current.sort === "name" && current.direction === "desc" ? "asc" : "desc",
                    }))}
                  >
                    Employee {query.sort === "name" ? (query.direction === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
                <th>Department</th>
                <th>Country</th>
                <th>
                  <button
                    className="sort"
                    onClick={() => setQuery((current) => ({
                      ...current,
                      sort: "salary",
                      direction: current.sort === "salary" && current.direction === "desc" ? "asc" : "desc",
                    }))}
                  >
                    Salary {query.sort === "salary" ? (query.direction === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((employee) => (
                <tr key={employee.id} onClick={() => setSelected(employee)}>
                  <td>
                    <b>{employee.name}</b>
                    <small>{employee.employee_code} · {employee.job_title}</small>
                  </td>
                  <td>{employee.department}</td>
                  <td>{employee.country}</td>
                  <td>
                    <b>{money(employee.salary_minor, employee.currency)}</b>
                    <small>{money(employee.salary_usd * 100)} USD equiv.</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <p className="empty" role="status">Loading employee records…</p>}
          {!loading && rows.length === 0 && <p className="empty">No people match these filters.</p>}
          <footer>
            <span>Page {meta.page} of {meta.pages}</span>
            <div>
              <button
                disabled={loading || meta.page === 1}
                onClick={() => setMeta((current) => ({ ...current, page: current.page - 1 }))}
              >
                Previous
              </button>
              <button
                disabled={loading || meta.page === meta.pages}
                onClick={() => setMeta((current) => ({ ...current, page: current.page + 1 }))}
              >
                Next
              </button>
            </div>
          </footer>
        </div>

        <aside aria-label="Compensation breakdown">
          <span className="eyebrow">COMPENSATION BREAKDOWN</span>
          <h2>By country</h2>
          {analytics?.byCountry.map((group) => (
            <div className="country" key={group.country}>
              <span>
                {group.country}
                <small>Payroll {money(group.payrollUsd * 100)} · Avg. {money(group.averageUsd * 100)} USD</small>
              </span>
              <b>{group.headcount.toLocaleString()}</b>
            </div>
          ))}
          <h2 className="breakdown-title">By department</h2>
          {analytics?.byDepartment.map((group) => (
            <div className="country" key={group.department}>
              <span>
                {group.department}
                <small>Payroll {money(group.payrollUsd * 100)} · Avg. {money(group.averageUsd * 100)} USD</small>
              </span>
              <b>{group.headcount.toLocaleString()}</b>
            </div>
          ))}
          <p>Amounts are shown in local currency. USD values are approximate comparison values, not payroll FX rates.</p>
        </aside>
      </section>

      {selected && (
        <Drawer
          employee={selected}
          close={() => setSelected(undefined)}
          refresh={() => setQuery((current) => ({ ...current }))}
        />
      )}
    </main>
  );
}

function Drawer({ employee, close, refresh }: { employee: Employee; close: () => void; refresh: () => void }) {
  const [detail, setDetail] = useState<Employee>();
  const [amount, setAmount] = useState(String(employee.salary_minor / 100));
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<Feedback>({ text: "", error: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api<Employee>(`/employees/${employee.id}`, { signal: controller.signal })
      .then(setDetail)
      .catch((cause: unknown) => {
        if (!(cause instanceof Error && cause.name === "AbortError")) {
          setFeedback({ text: errorMessage(cause), error: true });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [employee.id]);

  const save = async () => {
    const salaryMinor = parseSalaryMinor(amount);
    if (salaryMinor === null) {
      setFeedback({ text: "Enter a salary greater than zero with no more than two decimal places.", error: true });
      return;
    }
    if (reason.trim().length < 3 || reason.trim().length > 300) {
      setFeedback({ text: "Enter a reason between 3 and 300 characters.", error: true });
      return;
    }
    if (!window.confirm(`Change ${employee.name}'s annual salary to ${money(salaryMinor, employee.currency)}? This will be added to the adjustment history.`)) {
      return;
    }

    setSaving(true);
    setFeedback({ text: "", error: false });
    try {
      const updated = await api<Employee>(`/employees/${employee.id}/salary`, {
        method: "PATCH",
        body: JSON.stringify({ salaryMinor, reason: reason.trim() }),
      });
      setDetail(updated);
      setFeedback({ text: "Salary saved and audit event recorded.", error: false });
      refresh();
    } catch (cause: unknown) {
      setFeedback({ text: errorMessage(cause), error: true });
    } finally {
      setSaving(false);
    }
  };

  const current = detail ?? employee;
  return (
    <div className="overlay">
      <section className="drawer" aria-label={`${current.name} employee details`}>
        <button className="close" aria-label="Close employee details" onClick={close}>×</button>
        <span className="eyebrow">EMPLOYEE RECORD</span>
        <h2>{current.name}</h2>
        <p>{current.job_title} · {current.department}<br />{current.email} · {current.country}</p>
        <div className="salary">
          <small>CURRENT BASE SALARY</small>
          <strong>{money(current.salary_minor, current.currency)}</strong>
          <span>{money(current.salary_usd * 100)} USD equivalent</span>
        </div>
        <label>
          New annual salary ({current.currency})
          <input
            type="number"
            min="0.01"
            max="1000000"
            step="0.01"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label>
          Reason for change
          <textarea
            minLength={3}
            maxLength={300}
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g., promotion or annual merit review"
          />
        </label>
        <button className="primary" disabled={saving || loading} onClick={save}>
          {saving ? "Saving…" : "Save salary adjustment"}
        </button>
        {feedback.text && (
          <p className={feedback.error ? "notice error" : "notice"} role={feedback.error ? "alert" : "status"}>
            {feedback.text}
          </p>
        )}
        <h3>Adjustment history</h3>
        {loading && <p className="muted" role="status">Loading employee history…</p>}
        {!loading && current.history?.length ? (
          <ul>
            {current.history.map((change) => (
              <li key={change.id}>
                <b>{money(change.old_salary_minor, current.currency)} → {money(change.new_salary_minor, current.currency)}</b>
                <span>{change.reason} · {new Date(change.changed_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        ) : !loading && <p className="muted">No adjustments recorded yet.</p>}
      </section>
    </div>
  );
}

function parseSalaryMinor(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const minor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor > 0 && minor <= 100_000_000 ? minor : null;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Something went wrong.";
}
