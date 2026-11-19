# Demo walkthrough and recording guide

## Prepare a local demo

```powershell
npm ci
npm run seed
npm run dev
```

Open `http://localhost:5173`. The seeded employees use synthetic names, addresses, salaries, and currencies. `npm run seed` resets local employee and salary-history data.

## Walkthrough (about 2 minutes)

1. **Start with the dashboard.** Point out headcount, estimated annual payroll, median salary, and average salary in USD-equivalent comparison values.
2. **Compare groups.** Show average compensation and headcount by country and department. Clarify that static FX values are illustrative, not payroll rates.
3. **Find a person.** Search by name, email, or employee ID; apply a country or department filter; show the paginated salary list.
4. **Inspect an employee.** Open a record and identify the local-currency salary, USD comparison, job context, and adjustment history.
5. **Make a guarded change.** Enter a small new annual salary and a reason such as “annual merit review.” Save, accept the confirmation, and show the success message and recorded old/new values in the history.
6. **Close on scope.** Note that the directory is server-paginated and salary writes are validated and audited. Full SSO/RBAC, payroll execution, taxes, and approvals are intentionally outside this assessment scope.

To restore the synthetic dataset after the demo, stop the app and run `npm run seed` again. This resets all employee and salary-history changes.

## Recording checklist

- Record the browser window at a readable resolution; keep the pointer deliberate and pause briefly on each screen.
- Use the local seeded data or the access-protected Render demo. Do not record credentials, environment settings, or real employee data.
- Narrate the flow above and call out that the dataset and FX comparisons are synthetic/illustrative.
- Confirm the deployed URL loads and test the demo access prompt before recording a hosted walkthrough.
