# ACME Compensation Hub

A practical salary-management workspace for HR teams. It replaces spreadsheet-based salary review with a searchable employee directory, compensation analytics, and guarded salary updates.

## Quick start

```bash
npm install
npm run seed
npm run dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:3001`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the web app and API together |
| `npm run seed` | Recreate and seed the SQLite database with 10,000 employees |
| `npm test` | Run fast unit and API integration tests |
| `npm run build` | Typecheck and build the production web bundle |

## Product notes

See [docs/requirements.md](docs/requirements.md), [docs/architecture.md](docs/architecture.md), and [docs/ai-usage.md](docs/ai-usage.md).
