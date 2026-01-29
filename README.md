# API Status Dashboard

Monitor API endpoints: add URLs, see uptime status and response times, and view check history. Built with **Next.js** (frontend) and **Django** (REST API + health checks) on **Vercel**, with **Neon Postgres** for persistence.

## Stack

- **Next.js 15** – Dashboard UI (App Router)
- **Django 5** – REST API at `/api/v1/` (endpoints CRUD, check history, cron runner)
- **Neon Postgres** – Database (optional: use SQLite locally)
- **Vercel** – Hosting + cron (runs the check runner every 1 minute)

## Local development

### 1. Backend (Django)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Django runs at **http://localhost:8000**. It uses SQLite by default; set `DATABASE_URL` or Neon `PG*` env vars to use Postgres.

### 2. Frontend (Next.js)

```bash
# From project root
npm install
# Set API base so the app calls Django in dev:
# Windows PowerShell:
$env:NEXT_PUBLIC_API_BASE="http://localhost:8000"
npm run dev
```

Next.js runs at **http://localhost:3000**. Add `NEXT_PUBLIC_API_BASE=http://localhost:8000` to a `.env.local` file so the dashboard fetches from Django.

### 3. Run checks manually (optional)

The cron job that pings endpoints is only active on Vercel. Locally, trigger it once:

```bash
curl "http://localhost:8000/api/v1/cron/run-checks?secret=YOUR_CRON_SECRET"
# or
curl -H "Authorization: Bearer YOUR_CRON_SECRET" "http://localhost:8000/api/v1/cron/run-checks"
```

Set `CRON_SECRET` in your env (or `.env`) and use the same value in the request.

### CORS and using the deployed API

- **CORS**: The backend allows requests from `http://localhost:3000` and `http://127.0.0.1:3000` by default. If you see a CORS error, open the app with the same host you use in the API (e.g. use `http://localhost:3000` in the browser if your API is `http://localhost:8000`), or set `CORS_ORIGINS` in `.env` to include your frontend origin (comma-separated, no trailing slash).
- **Using the deployed API (e.g. api-status-phi.vercel.app)**: To point the frontend at your Vercel API instead of local Django, set:
  - **Frontend (local or in `.env.local`)**: `NEXT_PUBLIC_API_BASE=https://api-status-phi.vercel.app` (no trailing slash).
  - **Vercel project env** (so the deployed API accepts requests from your frontend): `CORS_ORIGINS=http://localhost:3000,https://api-status-phi.vercel.app` (or whatever origin your UI is served from). `ALLOWED_HOSTS` already includes `.vercel.app`, so the domain is accepted.

## Deploy to Vercel

1. Push the repo to GitHub and import the project in [Vercel](https://vercel.com).
2. Set **Environment Variables** in the Vercel project:
   - `SECRET_KEY` – Django secret (generate a random string).
   - `CRON_SECRET` – Secret for the cron endpoint (generate a random string).
   - `DATABASE_URL` – Neon Postgres connection string (from [Neon Console](https://console.neon.tech)).
3. **Neon**: Create a project in Neon, copy the connection string, and add it as `DATABASE_URL`.
4. **Migrations**: Run Django migrations against Neon before or after the first deploy:
   - Either in a one-off step: `cd backend && python manage.py migrate` with `DATABASE_URL` set.
   - Or add a build step / release phase that runs `python manage.py migrate` (e.g. in `vercel.json` or a script that Vercel runs).
5. Deploy. Vercel will build Next.js and deploy the Python function for `/api/v1/*`. The cron job will hit `/api/v1/cron/run-checks` every minute; ensure `CRON_SECRET` is set so the endpoint accepts the request (you may need to configure the cron to send the secret in a header or query param depending on Vercel’s cron features).

## How checks work

- **Check interval (per endpoint)**  
  Each endpoint has a **check interval** (e.g. 1, 5, 15, 30, or 60 minutes). You set it when adding or editing an endpoint.

- **Background job (Vercel Cron)**  
  On Vercel, a cron job runs **every minute** and calls `GET /api/v1/cron/run-checks` (with `CRON_SECRET`). That request is handled by Django.

- **Who gets checked**  
  Django loads all endpoints. For each endpoint it decides if it is **due**:
  - If the endpoint has **no previous check**, it is due and is checked.
  - If the **last check** was at least **interval_minutes** ago, it is due and is checked.
  - Otherwise the endpoint is **skipped** for that run (so a 5‑minute interval endpoint is only checked about every 5 minutes).

- **What a check does**  
  For each due endpoint, the backend sends an **HTTP GET** request to the endpoint’s URL (with a 10s timeout). It then stores a **CheckResult**: status code, response time (ms), success (true if 2xx), and any error message. That record is what you see in the dashboard and in check history.

- **Manual check**  
  You can run a check immediately for one endpoint with **Run check now** on the endpoint detail page (no need to wait for the next cron run).

## Project structure

```
├── app/                 # Next.js App Router (dashboard, endpoints CRUD)
├── api/v1/index.py     # Vercel serverless entry – forwards /api/v1/* to Django
├── backend/            # Django project
│   ├── api/            # Settings, urls, wsgi
│   └── apps/core/      # Endpoint & CheckResult models, DRF views, cron logic
├── vercel.json         # Routes + cron schedule
├── requirements.txt    # Python deps for Vercel (backend deps)
└── package.json        # Next.js
```

## API (Django)

- `GET /api/v1/health/` – Health check
- `GET/POST /api/v1/endpoints/` – List, create
- `GET/PATCH/DELETE /api/v1/endpoints/:id/` – Detail, update, delete
- `GET /api/v1/endpoints/:id/checks/` – Check history (query: `?limit=100`)
- `GET/POST /api/v1/cron/run-checks` – Run checks (requires `CRON_SECRET` in header or `?secret=`)

## License

MIT
