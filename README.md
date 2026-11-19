# ACME Compensation Hub

A salary-management workspace for HR teams: a searchable 10,000-person employee directory, compensation analytics, and audited salary adjustments.

## Local quick start

Requires Node.js 20.19+ or 22.12+.

```bash
npm ci
npm run seed
npm run dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:3001`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the Vite UI and API together |
| `npm run seed` | Recreate the local SQLite dataset with 10,000 synthetic employees |
| `npm test` | Run isolated, deterministic unit/API tests (does not modify `data/acme.db`) |
| `npm run build` | Typecheck and build the production web bundle |
| `npm start` | Start the API; in production it also serves the built UI |

`npm run seed` replaces the employee and salary-history tables. Use it only to initialize or reset synthetic demo data.

## Render deployment

The repository includes [`render.yaml`](./render.yaml) for a single Node web service with a persistent SQLite disk. The Blueprint uses a paid Starter instance because Render's free web instances do not provide persistent disks.

1. Connect the GitHub repository to Render and create a Blueprint from `render.yaml`.
2. Set `DEMO_USERNAME` and `DEMO_PASSWORD` when prompted or in the service's environment settings. Use unique credentials and never commit them.
3. Wait for the first deploy. In the service Shell, run `npm run seed` **once** to initialize the synthetic dataset on the mounted disk. The command replaces existing records; do not rerun it after the app contains real data.
4. Open the Render URL and enter the demo credentials in the browser's Basic Authentication prompt.

The service uses `PORT` from Render and stores SQLite at `/var/data/acme.db`. Production startup fails if demo credentials are missing. The health endpoint is `/api/health`; it exposes only readiness and is exempt from the demo access prompt.

For local production-mode testing, build first and set `NODE_ENV=production`, `DEMO_USERNAME`, `DEMO_PASSWORD`, and `DB_PATH` before `npm start`.

## Product and assessment artifacts

- [Product requirements](./docs/requirements.md)
- [Architecture and trade-offs](./docs/architecture.md)
- [AI-assisted development log](./docs/ai-usage.md)
- [Demo walkthrough and recording guide](./docs/demo-script.md)
