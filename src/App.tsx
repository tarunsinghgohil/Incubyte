import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { api, money, type Employee, type SalaryChange } from "./api";

type Analytics = {
  headcount: number;
  payrollUsd: number;
  medianUsd: number;
  averageUsd: number;
  byCountry: Array<{ country: string; headcount: number; payrollUsd: number; averageUsd: number }>;
  byDepartment: Array<{ department: string; headcount: number; payrollUsd: number; averageUsd: number }>;
};
type FilterOptions = { countries: string[]; departments: string[]; statuses: string[] };

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const navigate = (to: string) => {
    window.history.pushState({}, "", to);
    setPath(to);
  };

  let page: ReactNode;
  if (path === "/" || path === "/dashboard") page = <Dashboard />;
  else if (path === "/employees") page = <Directory navigate={navigate} />;
  else if (/^\/employees\/[^/]+$/.test(path)) {
    const id = path.split("/").pop();
    page = <EmployeeDetail id={Number(id)} navigate={navigate} />;
  } else page = <NotFound navigate={navigate} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("/dashboard")} aria-label="ACME Compensation Hub dashboard">
          <span className="brand-mark">A</span>
          <span><b>ACME</b><small>Compensation Hub</small></span>
        </button>
        <nav aria-label="Primary navigation">
          <button className={path.startsWith("/dashboard") || path === "/" ? "nav-active" : ""} onClick={() => navigate("/dashboard")}>Dashboard</button>
          <button className={path.startsWith("/employees") ? "nav-active" : ""} onClick={() => navigate("/employees")}>Employees</button>
        </nav>
        <div className="identity"><span>HR</span><div><b>ACME HR Manager</b><small>Demo access</small></div></div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">{path.startsWith("/employees") ? "People / Employees" : "People / Dashboard"}</div>
          <span className="demo-badge">Synthetic demo</span>
        </header>
        {page}
      </main>
    </div>
  );
}

function PageHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <header className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div></header>;
}

function Kpi({ title, value, note }: { title: string; value: string; note: string }) {
  return <article className="kpi"><span>{title}</span><strong>{value}</strong><small>{note}</small></article>;
}

function PageLoading() {
  return <div className="page loading-page"><div className="skeleton-line wide" /><div className="skeleton-grid">{[1,2,3,4].map((item) => <div className="panel skeleton-card" key={item} />)}</div></div>;
}

function StateError({ title, message }: { title: string; message: string }) {
  return <div className="page"><section className="state-error" role="alert"><h2>{title}</h2><p>{message}</p></section></div>;
}

function NotFound({ navigate }: { navigate: (to: string) => void }) {
  return <div className="page"><section className="state-error"><span className="eyebrow">404</span><h1>Page not found</h1><p>The requested compensation hub page does not exist.</p><button className="primary" onClick={() => navigate("/dashboard")}>Go to dashboard</button></section></div>;
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

function Dashboard() {
  const [data, setData] = useState<Analytics>();
  const [error, setError] = useState("");
  useEffect(() => {
    api<Analytics>("/dashboard/overview").then(setData).catch((cause) => setError(errorMessage(cause)));
  }, []);

  if (error) return <StateError title="Dashboard unavailable" message={error} />;
  if (!data) return <PageLoading />;

  return (
    <div className="page">
      <PageHeader eyebrow="Organization" title="Compensation overview" subtitle="Annual base-salary analytics for active employees" />
      <section className="metrics" aria-label="Organization compensation metrics">
        <Kpi title="Active employees" value={data.headcount.toLocaleString()} note="Active employee population" />
        <Kpi title="Estimated annual payroll" value={money(data.payrollUsd * 100)} note="Illustrative USD equivalent" />
        <Kpi title="Median annual base salary" value={money(data.medianUsd * 100)} note="USD equivalent" />
        <Kpi title="Average annual base salary" value={money(data.averageUsd * 100)} note="USD equivalent" />
      </section>
      <div className="chart-grid">
        <Breakdown title="Headcount by country" subtitle="Active employees" items={data.byCountry.map((x) => ({ name: x.country, value: x.headcount, label: x.headcount.toLocaleString() }))} />
        <Breakdown title="Annual salary by country" subtitle="Illustrative USD" items={data.byCountry.map((x) => ({ name: x.country, value: x.payrollUsd, label: money(x.payrollUsd * 100) }))} />
        <Breakdown title="Headcount by department" subtitle="Active employees" items={data.byDepartment.map((x) => ({ name: x.department, value: x.headcount, label: x.headcount.toLocaleString() }))} />
        <Breakdown title="Average salary by department" subtitle="Illustrative USD" items={data.byDepartment.map((x) => ({ name: x.department, value: x.averageUsd, label: money(x.averageUsd * 100) }))} />
      </div>
      <p className="info-note">Amounts are annual base salary. Cross-currency values are illustrative USD equivalents using static demo rates, not payroll FX.</p>
    </div>
  );
}

function Breakdown({ title, subtitle, items }: { title: string; subtitle: string; items: Array<{ name: string; value: number; label: string }> }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <section className="panel chart-panel">
      <div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div></div>
      {items.length === 0 ? <p className="empty">No data available.</p> : (
        <div className="bar-chart" role="img" aria-label={title}>
          {items.slice(0, 8).map((item) => (
            <div className="bar-row" key={item.name} title={`${item.name}: ${item.label}`}>
              <span className="bar-name">{item.name}</span>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(4, item.value / max * 100)}%` }} /></div>
              <strong>{item.label}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Directory({ navigate }: { navigate: (to: string) => void }) {
  const [options, setOptions] = useState<FilterOptions>({ countries: [], departments: [], statuses: [] });
  const [rows, setRows] = useState<Employee[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, pageSize: 25 });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [country, setCountry] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<FilterOptions>("/metadata/filters").then(setOptions).catch((cause) => setError(errorMessage(cause)));
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({
      page: String(meta.page),
      pageSize: String(meta.pageSize),
      sortBy,
      sortOrder,
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (country) params.set("country", country);
    if (department) params.set("department", department);
    if (status) params.set("status", status);
    api<{ data: Employee[]; meta: typeof meta }>(`/employees?${params}`, { signal: controller.signal })
      .then((result) => { setRows(result.data); setMeta(result.meta); setError(""); })
      .catch((cause) => { if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(errorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [debouncedSearch, country, department, status, sortBy, sortOrder, meta.page, meta.pageSize]);

  const changeSort = (column: string) => {
    setMeta((current) => ({ ...current, page: 1 }));
    if (sortBy === column) setSortOrder((current) => current === "asc" ? "desc" : "asc");
    else { setSortBy(column); setSortOrder("asc"); }
  };
  const reset = () => {
    setSearch(""); setCountry(""); setDepartment(""); setStatus("");
    setMeta((current) => ({ ...current, page: 1 }));
  };

  return (
    <div className="page">
      <PageHeader eyebrow="People" title="Employee directory" subtitle={`${meta.total.toLocaleString()} employee records`} />
      {error && <StateError title="Could not load employees" message={error} />}
      <section className="panel directory-panel">
        <div className="filters">
          <input className="search" aria-label="Search employees" value={search} onChange={(e) => { setSearch(e.target.value); setMeta((x) => ({ ...x, page: 1 })); }} placeholder="Search name, email or employee ID" />
          <select aria-label="Filter by country" value={country} onChange={(e) => { setCountry(e.target.value); setMeta((x) => ({ ...x, page: 1 })); }}><option value="">All countries</option>{options.countries.map((x) => <option key={x}>{x}</option>)}</select>
          <select aria-label="Filter by department" value={department} onChange={(e) => { setDepartment(e.target.value); setMeta((x) => ({ ...x, page: 1 })); }}><option value="">All departments</option>{options.departments.map((x) => <option key={x}>{x}</option>)}</select>
          <select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setMeta((x) => ({ ...x, page: 1 })); }}><option value="">All statuses</option>{options.statuses.map((x) => <option key={x}>{x}</option>)}</select>
          {(search || country || department || status) && <button className="text-button" onClick={reset}>Clear</button>}
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <SortHead label="Employee" column="employeeCode" active={sortBy} order={sortOrder} onSort={changeSort} />
              <SortHead label="Country" column="country" active={sortBy} order={sortOrder} onSort={changeSort} />
              <SortHead label="Department" column="department" active={sortBy} order={sortOrder} onSort={changeSort} />
              <th>Job title</th>
              <SortHead label="Annual base salary" column="annualSalary" active={sortBy} order={sortOrder} onSort={changeSort} />
              <th>Status</th><th><span className="sr-only">Action</span></th>
            </tr></thead>
            <tbody>
              {rows.map((employee) => (
                <tr key={employee.id} onClick={() => navigate(`/employees/${employee.id}`)}>
                  <td><b>{employee.name}</b><small>{employee.employee_code} · {employee.email}</small></td>
                  <td>{employee.country}</td>
                  <td>{employee.department}</td>
                  <td>{employee.job_title}</td>
                  <td><b>{money(employee.salary_minor, employee.currency)}</b><small>{money(employee.salary_usd * 100)} USD equiv.</small></td>
                  <td><span className={`status ${employee.employment_status}`}>{employee.employment_status}</span></td>
                  <td><button className="row-action" onClick={(e) => { e.stopPropagation(); navigate(`/employees/${employee.id}`); }}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && <p className="table-state" role="status">Loading employee records…</p>}
        {!loading && !error && rows.length === 0 && <p className="table-state">No employees match these filters.</p>}
        <footer className="pagination">
          <span>{meta.total ? `${(meta.page - 1) * meta.pageSize + 1}–${Math.min(meta.page * meta.pageSize, meta.total)} of ${meta.total}` : "0 results"}</span>
          <label>Rows <select value={meta.pageSize} onChange={(e) => setMeta((x) => ({ ...x, page: 1, pageSize: Number(e.target.value) }))}><option>10</option><option>25</option><option>50</option><option>100</option></select></label>
          <div><button disabled={loading || meta.page <= 1} onClick={() => setMeta((x) => ({ ...x, page: x.page - 1 }))}>Previous</button><button disabled={loading || meta.page >= meta.pages} onClick={() => setMeta((x) => ({ ...x, page: x.page + 1 }))}>Next</button></div>
        </footer>
      </section>
    </div>
  );
}

function SortHead({ label, column, active, order, onSort }: { label: string; column: string; active: string; order: string; onSort: (c: string) => void }) {
  return <th><button className="sort" onClick={() => onSort(column)}>{label}{active === column ? (order === "asc" ? " ↑" : " ↓") : ""}</button></th>;
}

function EmployeeDetail({ id, navigate }: { id: number; navigate: (to: string) => void }) {
  const [employee, setEmployee] = useState<Employee>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [feedback, setFeedback] = useState<{ text: string; error: boolean }>();
  const reload = () => {
    setLoading(true);
    api<Employee>(`/employees/${id}`).then((data) => { setEmployee(data); setAmount((data.salary_minor / 100).toFixed(2)); }).catch((cause) => setError(errorMessage(cause))).finally(() => setLoading(false));
  };
  useEffect(reload, [id]);
  const parsedMinor = useMemo(() => parseSalaryMinor(amount), [amount]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(undefined);
    if (!parsedMinor) { setFeedback({ text: "Enter a positive salary with no more than two decimal places.", error: true }); return; }
    if (reason.trim().length < 1 || reason.trim().length > 500) { setFeedback({ text: "Enter a reason between 1 and 500 characters.", error: true }); return; }
    if (!effectiveDate) { setFeedback({ text: "Choose an effective date.", error: true }); return; }
    setReviewing(true);
  };

  const confirmSave = async () => {
    if (!parsedMinor) return;
    setSaving(true);
    try {
      const updated = await api<Employee>(`/employees/${id}/salary`, {
        method: "PATCH",
        body: JSON.stringify({ annualSalary: amount.trim(), reason: reason.trim(), effectiveDate }),
      });
      setEmployee(updated); setReviewing(false); setFeedback({ text: "Salary saved and adjustment history updated.", error: false });
    } catch (cause) {
      setFeedback({ text: errorMessage(cause), error: true }); setReviewing(false);
    } finally { setSaving(false); }
  };

  if (loading) return <PageLoading />;
  if (error) return <StateError title="Employee unavailable" message={error} />;
  if (!employee) return <StateError title="Employee not found" message="This employee record does not exist." />;
  const monthlyMinor = employee.salary_minor / 12;

  return (
    <div className="page">
      <button className="back-button" onClick={() => navigate("/employees")}>← Back to employees</button>
      <div className="detail-grid">
        <div>
          <section className="panel profile-panel">
            <div className="profile-heading"><div className="avatar">{employee.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</div><div><span className="eyebrow">EMPLOYEE {employee.employee_code}</span><h1>{employee.name}</h1><p>{employee.job_title}</p></div></div>
            <dl className="profile-grid">
              <div><dt>Email</dt><dd>{employee.email}</dd></div><div><dt>Country</dt><dd>{employee.country}</dd></div>
              <div><dt>Department</dt><dd>{employee.department}</dd></div><div><dt>Hire date</dt><dd>{employee.hire_date}</dd></div>
              <div><dt>Status</dt><dd><span className={`status ${employee.employment_status}`}>{employee.employment_status}</span></dd></div>
            </dl>
          </section>
          <section className="panel history-panel">
            <div className="panel-heading"><div><h2>Salary adjustment history</h2><p>Immutable audit records</p></div></div>
            {!employee.history?.length ? <p className="empty">No salary adjustments recorded yet.</p> : (
              <div className="history-list">{employee.history.map((change: SalaryChange) => (
                <article key={change.id}><div><b>{money(change.old_salary_minor, employee.currency)} → {money(change.new_salary_minor, employee.currency)}</b><span>{change.reason}</span></div><dl><div><dt>Effective</dt><dd>{change.effective_date}</dd></div><div><dt>Changed by</dt><dd>{change.changed_by ?? "ACME HR"}</dd></div></dl></article>
              ))}</div>
            )}
          </section>
        </div>
        <aside className="detail-aside">
          <section className="salary-panel">
            <span>Annual base salary</span><strong>{money(employee.salary_minor, employee.currency)}</strong>
            <small>{money(employee.salary_usd * 100)} USD equivalent · illustrative</small>
            <hr /><div><span>Monthly estimate</span><b>{money(Math.round(monthlyMinor), employee.currency)}</b></div>
          </section>
          <section className="panel adjustment-panel">
            <h2>Update salary</h2>
            <form onSubmit={submit}>
              <label>New annual base salary ({employee.currency})<input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
              <label>Reason<textarea maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g., annual merit review" /></label>
              <label>Effective date<input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} /></label>
              {feedback && <p className={feedback.error ? "form-message error" : "form-message success"} role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
              <button className="primary" type="submit" disabled={saving}>Review adjustment</button>
            </form>
          </section>
        </aside>
      </div>
      {reviewing && <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
        <h2 id="review-title">Confirm salary adjustment</h2>
        <dl className="review-grid"><div><dt>Employee</dt><dd>{employee.name}</dd></div><div><dt>Current salary</dt><dd>{money(employee.salary_minor, employee.currency)}</dd></div><div><dt>New salary</dt><dd>{money(parsedMinor ?? 0, employee.currency)}</dd></div><div><dt>Effective date</dt><dd>{effectiveDate}</dd></div><div className="review-wide"><dt>Reason</dt><dd>{reason.trim()}</dd></div></dl>
        <div className="modal-actions"><button onClick={() => setReviewing(false)} disabled={saving}>Cancel</button><button className="primary" onClick={confirmSave} disabled={saving}>{saving ? "Saving…" : "Confirm & save"}</button></div>
      </section></div>}
    </div>
  );
}
