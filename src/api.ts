export type SalaryChange = {
  id: number;
  old_salary_minor: number;
  new_salary_minor: number;
  currency: string;
  reason: string;
  effective_date: string;
  changed_by: string;
  created_at: string;
  changed_at?: string;
};
export type Employee = {
  id: number;
  employee_code: string;
  name: string;
  email: string;
  department: string;
  country: string;
  currency: string;
  salary_minor: number;
  salary_usd: number;
  job_title: string;
  start_date: string;
  hire_date: string;
  employment_status: "active" | "inactive";
  history?: SalaryChange[];
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const r = await fetch(`/api${path}`, {
    ...init,
    headers,
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({})) as { error?: string | { message?: string } };
    const message = typeof body.error === "string"
      ? body.error
      : body.error?.message ?? "Something went wrong";
    throw new Error(message);
  }
  return r.json();
}

export const money = (minor: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
