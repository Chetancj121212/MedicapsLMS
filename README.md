# Courseportel LMS MVP

Courseportel is a small Learning Management System for the Medicaps University Electronics Engineering department. The MVP supports public course browsing, student authentication, sequential video learning, quizzes, progress tracking, certificates, certificate verification, and an admin portal.

## Stack

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, Lucide React
- Backend: FastAPI, SQLAlchemy, asyncpg, Pydantic
- Database: PostgreSQL (Docker Compose)
- Media and certificates: local video storage, ReportLab PDFs, QR verification

## Project Structure

```text
backend/                 FastAPI API, models, services, migrations, seed data
frontend/src/app/        Next.js routes and pages
frontend/src/components/ Shared UI and course/video components
frontend/src/config/     Runtime and site configuration
frontend/src/lib/        API and authentication helpers
frontend/src/types/      Shared TypeScript domain types
frontend/public/         Static assets
data/                    SQLite database, uploaded videos, and certificates
```

## Local Setup

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m app.seed
uvicorn app.main:app --reload
```

### Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

The frontend runs at `http://localhost:3000` and the API at `http://localhost:8000`.

## Docker Compose

Docker Compose runs the frontend, FastAPI backend, and PostgreSQL database together.
Uploaded videos and generated certificates persist in `data/`, and database records persist in the `postgres_data` volume.

```powershell
Copy-Item .env.example .env
docker compose up --build -d
docker compose exec backend python -m app.seed
```

Open `http://localhost:3000`. The API health endpoint is available at
`http://localhost:8000/api/health`.

Useful commands:

```powershell
docker compose logs -f
docker compose ps
docker compose down
```

Set `SECRET_KEY` in `.env` before using the stack outside local development.
Do not commit `.env`, uploaded media, certificates, or database files.

## Environment Variables

Backend values belong in `backend/.env`; frontend values belong in `frontend/.env.local`. Use the example files as templates. Secret and environment files are ignored by Git. `NEXT_PUBLIC_API_URL` may be left blank to use the Next.js development proxy.

## Demo Data

Running `python -m app.seed` creates the current demo admin, student, ECE-301 course, modules, lectures, quizzes, enrollment, and verification certificate. Account credentials remain local seed configuration and are not documentation secrets. Replace `backend/app/data/demo_config.py` and the seed records when connecting an API or database.

## GitHub

The repository includes GitHub Actions in `.github/workflows/ci.yml`. Pull
requests and pushes to `main` or `master` run backend tests, frontend lint and
build checks, and Docker image builds.

The CI workflow does not need application secrets. Production deployments
should provide secrets through the hosting platform and set at least
`SECRET_KEY`, `NEXT_PUBLIC_API_URL`, `FRONTEND_URL`, and `CORS_ORIGINS` for the
target environment.

## Future Plan

The application is backed by PostgreSQL with async SQLAlchemy and asyncpg. Future work can add API/database-backed course administration, production secret management, and external object storage without changing the current page flows.
