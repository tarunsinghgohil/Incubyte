# ACME Compensation Hub — AI Implementation & Product Build Guide

> **Purpose:** This document is the detailed implementation specification for the ACME salary-management assessment. Give this file to the coding agent together with `requirements.md`, `architecture.md`, `ai-usage.md`, and `demo-script.md`.
>
> **Decision rule:** Preserve the existing product scope and architecture unless the assessment owner explicitly approves a change. Do not turn this into a full payroll, HRIS, or employee self-service platform.

---

## 1. Product goal and user

Build a dependable web application for the **ACME HR Manager** to understand and maintain annual base-salary data for **10,000 synthetic employees across multiple countries, departments, and currencies**.

The product should replace the recurring spreadsheet workflow for these tasks:

1. See an accurate organization-level compensation overview.
2. Compare headcount and compensation across countries and departments.
3. Find an employee quickly using search, filters, sorting, and pagination.
4. Inspect an employee's employment context and current salary.
5. Record a salary adjustment with a reason, confirmation, and immutable history.

The product's central question is: **“How does ACME pay people?”** The dashboard and analytics must answer this with useful aggregate information, not just display a generic set of cards.

**Primary persona:** HR Manager. Payroll administrators and employees are not initial users.

**Success criteria:**
- A clean setup produces exactly 10,000 synthetic employee records.
- Dashboard totals agree with the seeded database and the documented currency-comparison rules.
- The HR Manager can find an employee and understand their compensation quickly.
- A valid salary adjustment updates the current salary and creates a corresponding history record atomically.
- Invalid changes are rejected by the API and show understandable feedback in the UI.
- Core tests pass from a clean checkout.
- The deployed demo uses persistent storage and access protection; no real employee data or credentials are committed.

## 2. Scope: build now vs deliberately leave out

### MVP — must implement

| Area | Required behaviour |
|---|---|
| Dashboard | Total headcount, estimated annual payroll, median base salary, average base salary, country and department breakdowns |
| Employee directory | Server-side search, filters, sorting, pagination, loading/empty/error states |
| Employee detail | Employee profile, current annual base salary in local currency, USD-equivalent comparison, salary adjustment history |
| Salary adjustment | Validate amount, require reason, show confirmation, save salary and history in one database transaction |
| Data | Deterministic seed script generating exactly 10,000 varied synthetic employees |
| Access protection | Deployment-level HTTP Basic Authentication for the hosted demo; no claim that this is production SSO/RBAC |
| Quality | Unit/integration tests for core calculations, API validation, directory queries, analytics, seed count, and salary audit behaviour |
| Delivery | Production build, single-service deployment, persistent SQLite disk, demo walkthrough |

### Deliberately out of scope for this assessment

Do **not** implement these unless the MVP is complete and there is clear time left:

- Actual salary disbursement, bank transfer, payslips, payroll runs, or payment-gateway integration.
- Country-specific tax calculation, tax filing, statutory deductions, or legal/compliance engines.
- Bonus, equity, commissions, benefits, complex compensation packages, or payroll component configuration.
- Full authentication product, SSO, multi-factor authentication, detailed production RBAC, or employee login portal. The hosted demo's Basic Auth gate is only access protection.
- Approval workflows, compensation planning cycles, or manager self-service.
- Attendance, leave, recruitment, performance management, or a complete HRIS.
- Excel/CSV import and export, PDF report generation, or bulk employee editing. These were useful ideas for a broader product but are explicitly outside the current requirements document.
- Live FX provider integration. The current design uses a static illustrative FX map for comparison only.
- Microservices, queues, Kubernetes, or a distributed database. They add complexity without helping this 10,000-row, single-node assessment.

**Important product boundary:** The app manages and analyzes salary information. It does not execute payroll or promise that USD comparisons are exchange-rate-accurate for payment, accounting, tax, or financial reporting.

## 3. Architecture and technology decisions

Retain the architecture already documented in `architecture.md`:

```text
React + TypeScript (Vite)
        │ HTTP / JSON (same origin in production)
        ▼
Express + TypeScript
  ├── routes/controllers: HTTP translation
  ├── services: validation and business rules
  └── repositories: parameterized SQL queries
        │
        ▼
SQLite (indexed tables, persistent disk in deployment)
```

### Required principles

- Use one TypeScript workspace where practical; do not split into microservices.
- Keep frontend and backend code clearly separated, for example `client/` and `server/`.
- Route/controller code must remain thin. Business rules belong in services. SQL belongs in repositories.
- Use parameterized SQL for every query. Never concatenate user input into SQL.
- Use server-side filtering, sorting, counting, and pagination. Do not load all 10,000 employees into the browser and filter locally.
- Use integer minor units for money (`salary_minor`) and an ISO 4217 currency code. Never use floating-point arithmetic as the stored source of truth.
- Use database transactions for a salary change and its audit/history row.
- Keep the UI's validation for usability, but the API is authoritative.
- Use the existing framework and dependency versions if the repository already has a working setup. Do not perform an unnecessary major-version migration just to match this guide.

### Suggested folder structure

Adapt to the existing repository rather than moving files without reason.

```text
client/
  src/
    app/                 # router, providers, app shell
    components/          # shared UI components
    features/
      dashboard/         # KPI cards, charts, dashboard queries
      employees/         # directory, filters, table, detail
      salary/            # adjustment form, history timeline
    lib/                 # API client, formatting, shared utilities
    types/               # frontend types
server/
  src/
    routes/              # API route registration
    controllers/         # request/response mapping
    services/            # domain logic and validation
    repositories/        # SQLite queries
    db/                  # connection, migrations/schema, seed
    middleware/          # error handler, demo access gate
    utils/               # money, FX, pagination helpers
shared/                  # shared schemas/types only if useful
 tests/                  # unit and integration tests
 docs/                   # assessment artefacts
```

Do not create abstractions that have no current use. A small, readable implementation is preferable to a speculative enterprise framework.

## 4. Data model and business rules

Use a relational schema with foreign keys enabled.

### `employees`

| Field | Type / rule | Notes |
|---|---|---|
| `id` | Integer primary key | Internal identifier |
| `employee_code` | Text, unique, not null | Human-readable employee ID |
| `full_name` | Text, not null | Synthetic name |
| `email` | Text, unique, not null | Synthetic email |
| `country_code` | Text, not null | ISO 3166-1 alpha-2 code where possible |
| `country_name` | Text, not null | Display name |
| `department` | Text, not null | Seeded department |
| `job_title` | Text, not null | Role/designation |
| `hire_date` | ISO date text, not null | `YYYY-MM-DD` |
| `employment_status` | Text, not null | Initially use `active` or `inactive` |
| `created_at` | ISO timestamp | Creation time |
| `updated_at` | ISO timestamp | Last profile update |

### `employee_salaries`

One current salary row per employee for the MVP.

| Field | Type / rule | Notes |
|---|---|---|
| `id` | Integer primary key | |
| `employee_id` | Foreign key, unique, not null | References `employees.id` |
| `annual_salary_minor` | Integer, not null, greater than zero | Annual base salary in cents/paise or the currency's minor unit |
| `currency` | Text, not null | ISO 4217 code, e.g. `USD`, `INR`, `EUR`, `GBP` |
| `effective_date` | ISO date text, not null | Date current salary became effective |
| `updated_at` | ISO timestamp | |

### `salary_adjustments`

Append-only history of changes. Do not overwrite or delete prior history records through the UI/API.

| Field | Type / rule | Notes |
|---|---|---|
| `id` | Integer primary key | |
| `employee_id` | Foreign key, not null | References `employees.id` |
| `old_salary_minor` | Integer, not null | Previous annual salary |
| `new_salary_minor` | Integer, not null | New annual salary |
| `currency` | Text, not null | Keep the employee's current salary currency for the MVP |
| `reason` | Text, not null | Trimmed, required, reasonable max length e.g. 500 |
| `effective_date` | ISO date text, not null | User-selected effective date |
| `changed_by` | Text, not null | Use a configured demo HR identity; do not pretend this is full user identity management |
| `created_at` | ISO timestamp, not null | Server-generated timestamp |

If an existing schema uses different names, keep it if the meaning and invariants are equivalent. Document the mapping rather than rebuilding a working database unnecessarily.

### Salary and currency rules

1. Treat the stored salary as **annual base salary**, matching the demo walkthrough's annual salary adjustment.
2. A salary value belongs to exactly one ISO currency. Do not add amounts in different currencies directly.
3. Store the amount as an integer minor-unit value. The UI may accept a decimal amount, but convert and validate it without floating-point rounding errors before persistence.
4. For MVP, salary adjustment changes the annual base salary amount in the employee's existing currency. Do not silently change an employee's currency or perform an FX conversion during salary edits.
5. A monthly equivalent may be displayed as `annual salary / 12`, clearly labelled as an estimate. It is not a monthly payroll calculation.
6. A salary adjustment must contain a positive, valid amount, a non-empty reason, and an effective date.
7. A salary change and its history record must commit together. If either operation fails, roll back both.
8. The history row records old and new values, currency, reason, effective date, actor label, and server timestamp.
9. Never expose or use real personal employee information. Seed synthetic data only.

### FX comparison rules

- Keep a small, explicit, static FX map in one backend module/config file.
- Document the base currency and the illustrative rates in code and in the UI (for example: “Illustrative USD comparison — static rates, not payroll FX”).
- Rates must be deterministic for tests. Do not fetch live rates in the assessment MVP.
- Never label a converted aggregate as an actual accounting/payroll total.
- For a group with multiple currencies, convert each employee's annual salary to the comparison currency before calculating a cross-country average or median.
- For country-level displays, show local-currency totals where all records share the same currency. If a country contains more than one currency, show a USD-equivalent estimate and label it clearly.
- Do not sum unlike currencies in a single raw total.

## 5. Seed data specification

Create a deterministic `npm run seed` command.

- Generate **exactly 10,000 employees** and exactly one current salary record per employee.
- Use a fixed seed/random generator so a fresh seed creates repeatable data and test expectations.
- Use synthetic names and reserved/example email domains; do not use real personal data.
- Include multiple countries and currencies such as USD, INR, EUR, and GBP; keep country-to-currency mapping internally consistent.
- Include multiple departments, job titles, joining dates, and active/inactive statuses.
- Use varied salary ranges appropriate to each synthetic country/currency. The values are demo data, not market compensation research.
- Ensure employee codes and emails are unique.
- Use a database transaction or efficient batch inserts; do not insert 10,000 rows with a separate slow round trip per field.
- `npm run seed` is destructive for the local demo dataset if it resets tables. Document this clearly and require the developer to run it deliberately.
- Do **not** run a destructive seed automatically on every production deployment or application startup. For hosted demo data, initialize deliberately and preserve the persistent disk.
- Test that seed output contains exactly 10,000 employees and 10,000 current salary rows.

## 6. UI/UX specification

### Overall visual direction

Build a professional, calm enterprise SaaS interface suitable for an HR Manager reviewing sensitive compensation information.

- Desktop-first because the main workflow is data-heavy, but responsive down to tablet/mobile widths.
- Use a light neutral background, white or near-white surfaces, restrained borders, readable typography, and one consistent primary accent colour.
- Avoid excessive gradients, glass effects, large decorative illustrations, and unnecessary animations.
- Use consistent spacing, border radius, shadows, form heights, table density, and chart styles.
- All currency values must show currency codes/symbols and use locale-aware formatting.
- Add explicit labels to approximate/conversion-based values.
- Use accessible contrast, semantic headings, visible keyboard focus, button labels, and form error messages.

### App shell and navigation

Create a persistent left sidebar on desktop and a collapsible navigation on smaller screens.

- Product mark/name: **ACME Compensation Hub**.
- Navigation: `Dashboard`, `Employees`.
- Top bar: page title/breadcrumb, small environment/demo indicator if useful, and current demo HR identity.
- Keep navigation intentionally simple; do not add empty pages or non-functional menu items.
- Routes: `/dashboard`, `/employees`, `/employees/:employeeId`.
- Unknown routes show a proper not-found page.

### Page A — Dashboard (`/dashboard`)

The dashboard should answer “How does ACME pay people?” within a quick scan.

**Top KPI cards (four):**

1. **Total Employees** — count of employees included in the agreed headcount (default: active employees; show the filter basis in the label or helper text).
2. **Estimated Annual Payroll** — sum of annual base salaries after conversion to the comparison currency; display `USD equivalent` and an info/helper note explaining static illustrative FX.
3. **Median Annual Base Salary** — median of converted annual base salary values in USD equivalent; label the comparison currency.
4. **Average Annual Base Salary** — average of converted annual base salary values in USD equivalent; label the comparison currency.

Do not call these metrics “monthly payroll” or “take-home pay”. They are annual base-salary analytics, not payments.

**Dashboard layout:**

- Row 1: four KPI cards.
- Row 2: `Headcount by Country` chart and `Annual Salary by Country` chart/table.
- Row 3: `Headcount by Department` chart and `Average Annual Base Salary by Department` chart/table.
- Optional after the above works: salary distribution bands (for example, ranges in the comparison currency) and a “Top paid” summary. Do not expose employee names on the executive dashboard by default.
- Include a small explanatory note near charts: “Amounts are annual base salary. Cross-currency values are illustrative USD equivalents using static demo rates.”

**Charts:**
- Use bar charts for country/department comparisons where labels need to be read accurately.
- Use a donut chart only for simple headcount share if it remains legible; otherwise use a bar chart.
- Tooltips must display the group name, exact employee count, currency/measure, and formatted value.
- Show a useful empty/error state if analytics cannot load. Never display fabricated fallback totals.
- Avoid too many colours. Keep the same series colours/legend semantics across charts.

**Metric calculation contract:**
- Headcount = count of employees matching the dashboard's documented status basis.
- Estimated annual payroll = sum of each included employee's annual salary converted to USD-equivalent using the static map.
- Average = sum of converted annual salaries / included employee count.
- Median = middle value of the sorted converted annual salary list; for an even count, average the two middle values.
- Country/department breakdowns must use the same population and conversion policy as the headline metrics.
- Handle zero employees safely (show `—` or zero according to the metric, not `NaN` or infinity).
- Define rounding once (e.g. display two decimals for per-employee averages; larger totals may use compact formatting) and use it consistently. Keep full precision for calculations until display.

### Page B — Employee directory (`/employees`)

Provide a fast, server-paginated directory for 10,000 records.

**Header:** page title, a short count summary such as “10,000 employee records”, and a search field.

**Search:**
- Match employee code/ID, full name, and email.
- Debounce typing on the client (roughly 250–350 ms) to avoid a request for every keystroke.
- Search is case-insensitive where supported by the chosen SQLite query/collation.
- Clear button resets the search.

**Filters:**
- Country.
- Department.
- Employment status (active/inactive).
- Optional salary range only if implemented with correct currency semantics. Do not compare raw amounts across different currencies as if they were the same unit.
- Filters must be combinable and reflected in the URL query string where practical so a view can be refreshed/shared.

**Table columns:**
- Employee ID.
- Employee name and email.
- Country.
- Department.
- Job title.
- Annual base salary with currency.
- Employment status.
- Action: `View` / row click to open detail.

**Table behaviour:**
- Server-side pagination; default page size 25, options 10/25/50, maximum 100.
- Show total matching count and current page.
- Sorting: name, employee code, country, department, annual salary, and hire date where available.
- Use an allowlist for sortable database columns; never accept arbitrary SQL column names from a request.
- Provide skeleton/loading, no-results, API-error/retry, and disabled-pagination states.
- Preserve current filters and sort when moving between pages.
- Do not fetch all employees to populate filter options; get distinct options from a small metadata endpoint or fixed seeded dimensions.

### Page C — Employee detail (`/employees/:employeeId`)

Show the employee's current employment and compensation context.

**Profile section:**
- Employee ID, name, email, country, department, job title, hire date, and employment status.

**Current salary section:**
- Annual base salary in local currency (primary value).
- USD-equivalent comparison value (secondary value, clearly labelled illustrative).
- Optional monthly equivalent, labelled “annual salary ÷ 12 estimate”.
- Effective date of the current salary.
- `Update salary` action.

**Salary history section:**
- Reverse-chronological timeline/table.
- Effective date, old annual salary, new annual salary, percentage change if safely calculated, reason, changed-by label, and recorded timestamp.
- Empty state: “No salary adjustments recorded yet.”
- Do not allow editing or deleting historical entries through the MVP UI.

### Salary adjustment interaction

Open a dialog/drawer or a clearly separated form from the employee detail page.

Fields:
- New annual base salary (decimal input with currency shown from the current employee salary).
- Reason (required; trim whitespace; max length 500 characters or the documented schema limit).
- Effective date (required; default to today in the app's local date handling, but allow user to change it).

Flow:
1. HR Manager enters a new salary and reason.
2. Client performs immediate usability validation.
3. Show a review/confirmation step with employee, current salary, proposed salary, currency, effective date, and reason.
4. On confirm, submit to API.
5. Disable repeated submission while saving.
6. On success, update the detail data and history, and show a clear success message.
7. On API validation/network failure, retain the user's input and show actionable field/general errors.

Do not implement an optimistic salary update that can show a change before the server confirms it. Invalidate/refetch the relevant employee and dashboard queries after a successful update.

## 7. API contract

Use `/api` as the API prefix. Response shapes should be consistent. Use a shared error format, for example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "details": { "annualSalary": "Enter a valid positive amount." }
  }
}
```

Suggested MVP endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Readiness only; no secrets or sensitive data |
| `GET` | `/api/dashboard/overview` | Headcount, annual payroll estimate, median, average |
| `GET` | `/api/dashboard/by-country` | Headcount and compensation by country |
| `GET` | `/api/dashboard/by-department` | Headcount and compensation by department |
| `GET` | `/api/employees` | Search, filters, sorting, pagination |
| `GET` | `/api/employees/:id` | Employee detail and current salary |
| `GET` | `/api/employees/:id/salary-history` | Salary adjustment history |
| `PATCH` | `/api/employees/:id/salary` | Validated salary adjustment + history transaction |
| `GET` | `/api/metadata/filters` | Distinct countries, departments, statuses, if needed |

**Directory query parameters (example):**

```text
GET /api/employees?page=1&pageSize=25&search=alex&country=US&department=Engineering&status=active&sortBy=annualSalary&sortOrder=desc
```

Validation rules:
- `page` must be an integer >= 1.
- `pageSize` must be an integer between 1 and 100; default 25.
- `sortBy` must be in a fixed allowlist; `sortOrder` is `asc` or `desc` only.
- Unknown/invalid filters should return a clear 400 response or be rejected according to one documented convention.
- Parameterized values for search and filters; allowlisted SQL identifiers for sort columns.

**Salary update request (recommended):**

```json
{
  "annualSalary": "85000.00",
  "reason": "Annual merit review",
  "effectiveDate": "2026-11-20"
}
```

The API obtains the currency from the employee's current salary record for the MVP. Parse the decimal string with a money-safe helper and persist integer minor units. Do not accept a client-supplied `oldSalary` as authoritative; load the current value from the database inside the transaction.

**Salary update transaction sequence:**
1. Begin transaction.
2. Load employee/current salary; return 404 if absent.
3. Validate the submitted amount, reason, and effective date on the server.
4. Update current salary and its effective date.
5. Insert append-only history with database-derived old value and requested new value.
6. Commit. On any failure, roll back.
7. Return the updated employee salary and newly created history record.

## 8. SQLite indexes and performance

At minimum, inspect query plans and add indexes that serve actual query patterns. Likely indexes:

- Unique index on `employees.employee_code`.
- Unique index on `employees.email`.
- Index on `employees.country_code`.
- Index on `employees.department`.
- Index on `employees.employment_status`.
- Index on `employees.full_name` only if it helps the chosen search method; a leading-wildcard search may not use a normal B-tree index.
- Unique index on `employee_salaries.employee_id`.
- Index on `employee_salaries.annual_salary_minor` if salary sorting/filtering is used within one currency.
- Index on `salary_adjustments(employee_id, created_at DESC)`.

Also:
- Enable SQLite foreign keys.
- Use prepared statements and bounded result sizes.
- Consider WAL mode for a single-node app with concurrent reads and writes.
- Avoid an N+1 query for employee salary rows; join or fetch the page's salary data efficiently.
- Compute analytics in SQL where straightforward; compute a small converted-salary list in the service only if required for correct median after per-currency conversion. For 10,000 records, this is acceptable if bounded and measured.
- Add a test/measurement for directory queries at 10,000 seeded rows. Do not claim a performance target that has not been measured.

## 9. Libraries and packages

First inspect `package.json` and the current source tree. **Do not reinstall packages that are already present, and do not replace a working library without a clear reason.** Package names below are a suggested compatible stack, not a mandate to migrate existing versions.

### Frontend — core

| Package | Use | Required? |
|---|---|---|
| `react`, `react-dom` | UI framework | Yes |
| `react-router-dom` | Client-side routes | Yes |
| `@tanstack/react-query` | API fetching, caching, loading/error states, invalidation | Recommended |
| `recharts` | Dashboard charts | Yes, for chart-based dashboard |
| `react-hook-form` | Salary form state/validation UX | Recommended |
| `zod` | Shared/runtime schema validation | Recommended |
| `@hookform/resolvers` | Connect Zod to React Hook Form | If both are used |
| `lucide-react` | Consistent icons | Recommended |
| `sonner` | Toast notifications | Optional; use one toast library only |
| `@tanstack/react-table` | Advanced table behaviours | Optional; use only if native table implementation becomes unwieldy |

### UI styling/components

- `tailwindcss` — utility styling, if the repository uses Tailwind.
- `@tailwindcss/vite` — Vite integration for Tailwind v4 projects; do not add it to a Tailwind v3 setup without intentionally migrating the config.
- `shadcn/ui` — copy-in component collection built on Radix UI and Tailwind. It is not a single runtime component package; use its CLI to add the components actually needed.
- Components to add/use: `button`, `card`, `input`, `label`, `select`, `table`, `badge`, `dialog`, `alert-dialog`, `dropdown-menu`, `popover`, `calendar`/date input, `skeleton`, `tooltip`, `separator`, `sheet`, `sonner` (only if using Sonner).

### Backend — core

| Package | Use | Required? |
|---|---|---|
| `express` | HTTP API and static frontend serving | Yes |
| `better-sqlite3` | SQLite driver | Recommended for this small synchronous single-process workload; keep an existing working SQLite driver if already implemented |
| `zod` | Validate API query/body input | Recommended |
| `helmet` | Sensible HTTP security headers | Recommended |
| `express-basic-auth` | Simple deployment/demo Basic Auth middleware | Optional; implement equivalent carefully if already present |

No CORS package is needed when the production UI and API are served from the same origin. For local development, use the Vite dev proxy to `/api` rather than introducing broad permissive CORS settings.

### Development, types, and tests

| Package | Use |
|---|---|
| `typescript` | Static type checking |
| `vite`, `@vitejs/plugin-react` | Frontend dev server/build |
| `tsx` | Run TypeScript server code in development |
| `concurrently` | Run client and server dev commands together |
| `vitest` | Unit/integration test runner |
| `@vitest/coverage-v8` | Coverage reporting |
| `supertest`, `@types/supertest` | HTTP API integration tests |
| `@types/node`, `@types/express`, `@types/better-sqlite3` | TypeScript types for Node/server packages |
| `@testing-library/react` | Component tests |
| `@testing-library/user-event` | Realistic user interaction tests |
| `@testing-library/jest-dom` | DOM assertions |
| `jsdom` | Browser-like test environment for Vitest |
| `eslint`, `prettier` | Linting and formatting |
| `playwright` | Optional end-to-end smoke tests for the critical user flow |

### Example installation commands

Run only the commands for packages missing from the current project. The coding agent must verify compatibility with the installed React/Vite/Tailwind versions first.

```bash
# Frontend runtime packages
npm install react-router-dom @tanstack/react-query recharts react-hook-form zod @hookform/resolvers lucide-react

# Optional UI notification/table helpers
npm install sonner @tanstack/react-table

# Backend runtime packages
npm install express better-sqlite3 helmet express-basic-auth

# Development and testing packages
npm install -D typescript vite @vitejs/plugin-react tsx concurrently vitest @vitest/coverage-v8 supertest @types/supertest @types/node @types/express @types/better-sqlite3 eslint prettier jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

If using Tailwind v4 in a new/unconfigured project:

```bash
npm install -D tailwindcss @tailwindcss/vite
```

If using shadcn/ui, initialize it according to the current CLI instructions for the installed Vite/Tailwind setup, then add only the required components. Do not copy all available components into the project.

**Avoid dependency duplication:**
- Use one form solution, not several competing form libraries.
- Use one chart library, not Recharts plus Chart.js for the same dashboard.
- Use one toast/notification library.
- Use React Query for server state; do not put API cache data into Redux/Zustand without a real need.
- Do not add Redux, Zustand, Moment, Axios, or a large date library just because they are familiar. Native `fetch`, React Query, and `Intl` are enough for this MVP unless the existing code already uses a justified alternative.

## 10. Tests and quality gates

Tests must be deterministic, fast, and independent of the developer's seeded database.

### Backend unit tests

- Money parsing: valid decimal strings, zero/negative amount, too many decimal places, very large/unsafe values, currency minor-unit handling.
- Salary validation: positive amount, required trimmed reason, maximum reason length, valid date.
- FX conversion: fixed deterministic rates, missing rate handling, and no accidental raw cross-currency addition.
- Median/average calculations: odd/even counts, rounding, empty dataset.
- Pagination parsing: defaults, bounds, invalid page size, sort allowlist.

### Backend integration tests

- Fresh seed creates exactly 10,000 employee rows and 10,000 salary rows.
- Directory returns only the requested page and correct total count.
- Search matches employee code, name, and email.
- Country, department, and status filters can be combined.
- Sorting works for allowlisted columns and rejects unknown sort columns.
- Dashboard overview and country/department aggregates match independently calculated expected values from a fixture.
- Employee detail returns the expected profile and current salary.
- Salary update changes current salary and adds exactly one matching history record.
- Invalid salary update changes neither the salary nor history.
- A simulated failure during history insertion rolls back the salary update.
- Unknown employee returns 404.
- Health endpoint returns readiness only.
- Demo access protection rejects unauthenticated requests and accepts configured credentials; do not commit credentials in tests or source.

### Frontend tests

- Dashboard shows loading, success, and error states.
- KPI cards and chart labels show the correct currency/approximation wording.
- Directory search, filter, sort, and pagination update the request parameters correctly.
- Employee detail displays local salary and clearly labelled USD equivalent.
- Salary form rejects invalid input and requires a reason.
- Confirmation displays the correct old/new amount and effective date.
- Success refreshes salary details/history; failure leaves the user's input visible.

### Optional end-to-end smoke test

Use Playwright only if time permits:
1. Open demo app and authenticate.
2. Verify dashboard appears.
3. Search for a seeded employee.
4. Open employee detail.
5. Submit a salary adjustment in a disposable test database.
6. Verify updated current salary and history row.

### Test isolation rules

- Use a temporary SQLite file or in-memory database per test suite.
- Never point tests at the developer's normal `DB_PATH`.
- Do not run the destructive seed command as part of ordinary test cleanup.
- Fix the clock and FX rates in tests where date or conversion affects results.
- Test business rules at the service/API boundary, not only through UI snapshots.

## 11. Error handling, security, and accessibility

- Validate all API inputs with typed schemas.
- Return consistent HTTP status codes: 400 for invalid input, 401 for missing/invalid demo credentials, 404 for unknown employee, 500 for unexpected server errors.
- Do not return SQL errors, stack traces, secrets, or environment variables to the browser.
- Add a central Express error handler and structured server-side logging.
- Never log Basic Auth passwords or full authorization headers.
- Use HTTPS in the deployed environment.
- Store demo credentials only in deployment environment variables; do not commit `.env`.
- Add `.env.example` with variable names and safe placeholders only.
- The health endpoint must not expose credentials, filesystem paths, DB contents, or internal configuration.
- Use labels for form fields, accessible dialog semantics, keyboard-operable controls, visible focus states, and meaningful chart summaries/legends.
- Sensitive employee salary data should not appear in unnecessary browser logs or error telemetry.

## 12. Deployment and environment

Follow the existing architecture decision: **one Render Node web service** serves the built Vite app and the Express `/api` endpoints from the same origin.

Expected environment variables (adapt to implementation):

```text
NODE_ENV=production
PORT=<provided by hosting platform>
DB_PATH=<path on persistent disk>/acme.sqlite
DEMO_USERNAME=<configured in hosting dashboard>
DEMO_PASSWORD=<configured in hosting dashboard>
```

Deployment checklist:
- Build frontend and backend in the deployment build step.
- Express serves the Vite production build and routes `/api/*` to the API.
- Configure the SQLite file path on a persistent disk.
- Use one service instance for SQLite; do not scale horizontally with multiple app instances sharing this SQLite file.
- Initialize/seed the hosted synthetic dataset deliberately once. Never wipe persistent data during every deploy or app startup.
- Configure demo access credentials outside source control.
- Confirm direct URL refresh works for client-side routes such as `/employees/:id` (Express SPA fallback must not swallow `/api` routes).
- Test the deployed health route, auth prompt, dashboard, employee search, detail page, and salary update.
- If hosting does not provide durable disk, do not claim hosted data persists across restarts; choose/configure a persistent disk.

Useful local commands should be documented in `README.md`. Preserve existing scripts if they already work; expected equivalents include:

```bash
npm ci
npm run seed
npm run dev
npm test
npm run build
npm start
```

## 13. Suggested incremental Git commits

Make small commits after working, tested milestones. Do not create fake or backdated commits. Example sequence:

1. `docs: define compensation hub scope and architecture`
2. `feat(db): add employee salary and adjustment schema`
3. `feat(seed): generate deterministic 10000 employee dataset`
4. `feat(api): add paginated employee directory and detail endpoints`
5. `feat(analytics): add dashboard compensation aggregates`
6. `feat(salary): add validated transactional salary adjustments`
7. `feat(ui): build dashboard and employee directory`
8. `feat(ui): add employee detail and salary history workflow`
9. `test: cover analytics directory and salary audit behaviour`
10. `chore(deploy): configure production build and demo access`
11. `docs: add AI usage and demo walkthrough evidence`

Each commit should leave the project in a coherent state where practical. Run relevant tests before committing. Do not bundle unrelated generated files or secrets.

## 14. Intentional AI-assisted development workflow

Use the AI coding agent as an implementation assistant, not as an unquestioned source of truth.

1. Ask it to inspect the complete repository, all five Markdown documents, `package.json`, scripts, and current Git status before editing.
2. Ask it to summarize the current implementation and identify gaps against this specification. It must not rewrite working code before reporting the gap list.
3. Implement one milestone at a time, starting with schema/seed and backend contracts, then UI, then tests/deployment.
4. Before adding a package, inspect whether an equivalent dependency already exists.
5. Require the agent to explain any scope or architecture deviation before making it.
6. Review generated SQL, currency calculations, API validation, security middleware, and transaction boundaries manually.
7. Run formatting/lint/typecheck/tests/build after meaningful changes. Report exact command results; do not claim a command passed if it was blocked or not run.
8. Keep `ai-usage.md` honest: record tools used, representative prompts, decisions accepted/rejected, test results, and any environment limitations.
9. Never fabricate test coverage, deployment status, screenshots, demo links, or commit history.

### Master prompt to give the coding agent

Copy this prompt into the AI coding tool after adding this document to the repository:

```text
You are the senior full-stack engineer implementing the ACME Compensation Hub assessment.

First inspect the entire repository, package.json, existing code, tests, Git status, and these documents:
- implementation-guide.md (detailed implementation specification)
- requirements.md (one-page product requirements and scope)
- architecture.md (architecture and trade-offs)
- ai-usage.md (AI development record)
- demo-script.md (demo flow)

Do not start by rewriting files. First give me:
1. A concise summary of the existing application and architecture.
2. A checklist mapping every MVP requirement to existing code or a missing task.
3. Any contradictions between documents/code, with a proposed resolution that preserves the documented product scope.
4. The exact packages that are missing (do not duplicate installed packages).
5. A milestone plan with the tests to run for each milestone.

Then implement the missing work incrementally. Preserve the React + TypeScript + Vite, Express + TypeScript, and SQLite architecture unless a real blocker requires a documented change. The product is for one primary persona: an ACME HR Manager managing 10,000 synthetic employees across countries. Do not turn it into a full payroll/HRIS product.

Non-negotiable rules:
- Exactly 10,000 deterministic synthetic employees after the seed command.
- Annual base salary is the stored compensation measure for this MVP.
- Store salary in integer minor units plus ISO currency.
- Never add unlike currency values without converting each employee through the documented static illustrative FX map.
- Label USD equivalents as illustrative and not payroll/payment FX.
- All directory search, filtering, sorting, and pagination must happen server-side; cap page size at 100.
- SQL must be parameterized; sorting must use a strict allowlist.
- Validate requests on the server.
- A salary adjustment must update the current salary and append an immutable history record in one transaction; failure must roll back both.
- Require a non-empty reason and effective date; show a confirmation before saving.
- Tests must use an isolated disposable database, never the developer's normal seeded DB.
- Do not run destructive seeding on every deployment/startup.
- Hosted demo credentials must be environment variables and must never be committed.
- Do not implement out-of-scope payroll payments, taxes, SSO/RBAC, approvals, imports/exports, or employee self-service for the MVP.

Build the dashboard, employee directory, employee detail, and salary adjustment workflow to the UI specification. Include loading, empty, error, validation, and success states. Make the desktop data views readable and responsive on smaller screens. Use accessible labels, keyboard-friendly controls, and consistent formatting.

For every milestone:
1. State the files you plan to change and why.
2. Make the smallest coherent implementation.
3. Add/update tests for the behaviour.
4. Run the relevant tests, typecheck, lint, and build where available.
5. Report exact pass/fail/blocker results.
6. Suggest a meaningful Git commit message; do not create commits unless I ask or the repo workflow permits it.

Do not invent functionality, test results, deployment links, credentials, or claims. If an item cannot be completed, explain the blocker and leave the repository in a working state. Update the relevant Markdown artefacts when a real design decision changes.
```

## 15. Demo walkthrough — align with `demo-script.md`

Keep the demo to roughly two minutes:

1. Open the dashboard and explain headcount, estimated annual payroll, median, and average salary.
2. Compare country and department charts. Explicitly state that cross-currency USD values use static illustrative rates.
3. Search for an employee by name/email/employee ID and apply country or department filters.
4. Open the employee detail and show local-currency annual salary, comparison value, and salary history.
5. Update the annual salary with a reason and effective date; confirm the change; show the success state and old/new history record.
6. Close by explaining server-side pagination, API validation, transactional audit history, seeded synthetic data, and the deliberately limited scope.

Before recording:
- Confirm the deployed URL is live and the demo credentials work.
- Use only synthetic data.
- Do not record passwords, environment variables, or private settings.
- Do not claim full production authentication, tax compliance, payroll execution, or live FX.
- Re-seed only a local demo database when you intentionally want to reset the walkthrough data.

---

## 16. Final acceptance checklist

### Product and UX
- [ ] ACME Compensation Hub has a consistent app shell and working navigation.
- [ ] Dashboard shows four correct KPI cards and country/department breakdowns.
- [ ] Currency conversions are clearly marked as illustrative USD equivalents.
- [ ] Employee directory searches employee code, name, and email.
- [ ] Country, department, and status filters combine correctly.
- [ ] Pagination and sorting are server-side and stable.
- [ ] Employee detail shows profile, local salary, comparison value, and history.
- [ ] Salary update requires a valid amount, reason, effective date, and confirmation.
- [ ] Success and error messages are clear and do not lose form input unnecessarily.

### Backend and data
- [ ] Seed creates exactly 10,000 unique synthetic employees and matching salary rows.
- [ ] Money is persisted as integer minor units plus currency.
- [ ] All SQL parameters are bound; sort columns are allowlisted.
- [ ] Salary update and history insert are atomic.
- [ ] Historical adjustments cannot be edited/deleted through the app.
- [ ] Database indexes support actual query patterns.

### Engineering and delivery
- [ ] Tests run against an isolated database and pass.
- [ ] TypeScript typecheck, lint, and production build pass (or documented blockers are provided).
- [ ] No secrets or real employee data are committed.
- [ ] Git history shows genuine incremental development.
- [ ] Render demo uses persistent storage and environment-based access protection.
- [ ] README contains setup, seed, run, test, build, and deployment instructions.
- [ ] `ai-usage.md` and `demo-script.md` reflect what was actually implemented and tested.

**Definition of done:** A reviewer can open the protected deployed demo, understand the organization-level compensation picture, find a synthetic employee, inspect their salary history, perform a guarded salary update, and verify that the change was recorded correctly.
