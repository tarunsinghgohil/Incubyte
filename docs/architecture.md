# Architecture and trade-offs

```
React + TypeScript (Vite) ── HTTP/JSON ── Express + TypeScript ── SQLite
       dashboard/directory/detail              validation/services       indexed tables
```

The project uses one TypeScript workspace to minimize setup cost while retaining a clean boundary: route handlers translate HTTP, services own business rules, and the repository owns SQL. SQLite is a strong fit for the assessment's single-node, 10k-row workload; the repository interface and parameterized SQL make a later Postgres migration contained.

Money is stored as `salary_minor` (integer cents/paise) plus ISO currency. USD reporting uses a maintained static FX map only for comparison; it is explicitly not a payroll conversion source. Salary updates run inside one transaction, updating the employee and adding an audit event atomically. SQLite indexes support the directory’s filters and ordering.

The deployment is a single Render Node web service. Express serves the Vite build and same-origin API; `DB_PATH` points to a persistent disk. Production startup requires environment-provided demo credentials and protects the UI and API with HTTP Basic Authentication. The unauthenticated health route reports readiness only. A persistent disk and one service instance are important for SQLite's single-node deployment model.

The demo gate is intentionally not full authentication/RBAC. A real production system still needs SSO/RBAC, migration tooling, an append-only externally retained audit log, approved FX/market data, encryption/backups, observability, and country-specific compliance review.
