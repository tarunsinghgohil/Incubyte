# AI-assisted development log

AI assisted with reviewing the existing implementation against the assessment, identifying gaps, and iterating on code, tests, and deployment artifacts. The existing React/TypeScript, Express, and SQLite foundation was retained rather than replaced.

## Decisions and review

- Keep the product deliberately narrow for the HR Manager persona. The USD map is for comparison only, not payroll conversion.
- Keep server validation and transactional salary auditing authoritative; UI validation and confirmation improve the workflow but do not replace API checks.
- Isolate tests in disposable SQLite databases so test cleanup cannot erase a developer's seeded dataset.
- Require environment-configured access protection for a public demo, while documenting that this is not full product authentication/RBAC.
- Use a persistent Render disk and do not run the destructive seed command automatically during deployments.

AI-generated changes were checked against the existing code and validated with the test suite and TypeScript compiler. The production bundle command was also attempted; in the current Windows environment, application-control policy blocks loading Rollup's native module, so that bundle result must be verified in an unrestricted environment or CI.
