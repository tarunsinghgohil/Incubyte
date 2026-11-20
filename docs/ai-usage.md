# AI-assisted development log

AI assisted with reviewing the existing implementation against the assessment, identifying gaps, and iterating on code, tests, and deployment artifacts. The existing React/TypeScript, Express, and SQLite foundation was retained rather than replaced.

## Decisions and review

- Keep the product deliberately narrow for the HR Manager persona. The USD map is for comparison only, not payroll conversion.
- Keep server validation and transactional salary auditing authoritative; UI validation and confirmation improve the workflow but do not replace API checks.
- Isolate tests in disposable SQLite databases so test cleanup cannot erase a developer's seeded dataset.
- Require environment-configured access protection for a public demo, while documenting that this is not full product authentication/RBAC.
- Use a persistent Render disk and do not run the destructive seed command automatically during deployments.

The implementation also added native in-app routes and responsive data views without duplicating the existing dependency stack. Salary updates use the existing SQLite salary history table with currency, effective-date, actor, and server timestamp fields; tests remain isolated from the developer database.

The AI-assisted implementation was reviewed against the assessment guide, package scripts, and existing source. Validation commands, including tests and the production build, must be recorded exactly from the environment in which they run.
