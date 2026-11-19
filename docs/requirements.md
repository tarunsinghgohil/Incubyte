# ACME Compensation Hub — Product Requirements

**Goal.** Give an HR Manager a reliable web workspace to manage salary data for 10,000 employees and answer the recurring question, “how do we pay people?” without downloading and reconciling spreadsheets. Success means a manager can find an employee, understand compensation distribution by country/department, and record a salary adjustment in under two minutes.

**Primary user.** The HR Manager owns data quality and compensation planning. They need a quick executive view before leadership reviews, plus a safe way to investigate and update an individual record. Payroll administrators and employees are not initial users.

**In scope.**

1. A dashboard with total headcount, payroll, median base salary, average salary, and headcount/payroll/average compensation by country and department.
2. A server-side paginated directory with search by employee/name/email, filters for country and department, sortable salary and name columns, and clear empty/loading/error states.
3. An employee detail surface showing employment context and salary in local currency and USD equivalent.
4. Salary update workflow: currency-aware amount validation, required reason, explicit confirmation before saving, success/error feedback, and an immutable adjustment history.
5. A deterministic seed script that generates 10,000 realistic, varied employee records across countries, departments, and currencies. The app is usable immediately after setup.

**Deliberately out of scope.** Full product authentication/RBAC, approvals, bonus/equity calculations, tax withholding, payroll execution, imports/exports, and employee self-service are intentionally excluded. Each needs policy, identity, audit, and regional-compliance decisions that would distract from validating the HR-manager workflow. A deployment-level Basic Authentication gate protects the public synthetic-data demo; it is not a substitute for production identity and authorization. The data model leaves room for future controls (adjustment history and currency fields), but they should be designed with stakeholders before implementation.

**Quality and scale requirements.** The directory must remain responsive at 10,000 records: filter/sort/paginate in the database and return only the requested page. Salary changes must validate on the server and be transactionally recorded with their old and new values. Values are stored in integer minor units to avoid floating-point money errors. Tests use an isolated database and cover seed size, grouped analytics, validation, salary-change auditing, and access protection.

**Measures of success.** A seeded environment opens to an accurate aggregate dashboard; an HR manager can filter the directory and update a salary; all actions give legible feedback; and the test suite passes from a clean checkout.
