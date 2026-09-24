# Courseportel LMS MVP

Courseportel is a small Learning Management System for the Medicaps University Electronics Engineering department. The MVP supports public course browsing, student authentication, sequential video learning, quizzes, progress tracking, certificates, certificate verification, and an admin portal.

## Stack

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, Lucide React
- Backend: FastAPI, SQLAlchemy, Pydantic, SQLite for local development
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

## Environment Variables

Backend values belong in `backend/.env`; frontend values belong in `frontend/.env.local`. Use the example files as templates. Secret and environment files are ignored by Git. `NEXT_PUBLIC_API_URL` may be left blank to use the Next.js development proxy.

## Demo Data

Running `python -m app.seed` creates the current demo admin, student, ECE-301 course, modules, lectures, quizzes, enrollment, and verification certificate. Account credentials remain local seed configuration and are not documentation secrets. Replace `backend/app/data/demo_config.py` and the seed records when connecting an API or database.

## Future Plan

The MVP is intentionally SQLite-backed and keeps demo data easy to replace. Future work can add API/database-backed course administration, production secret management, and PostgreSQL without changing the current page flows.
