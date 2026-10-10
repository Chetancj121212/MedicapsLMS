#!/usr/bin/env bash
set -e

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if [[ -x "$ROOT/backend/venv/bin/python" ]]; then
  BACKEND_PYTHON="$ROOT/backend/venv/bin/python"
else
  BACKEND_PYTHON="python3"
fi

cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

if command -v docker >/dev/null 2>&1; then
  echo "Ensuring PostgreSQL container is running..."
  (cd "$ROOT" && (docker compose up -d db >/dev/null 2>&1 || docker-compose up -d db >/dev/null 2>&1 || true))
fi

(
  cd "$ROOT/backend"
  "$BACKEND_PYTHON" -m uvicorn app.main:app --reload
) &
BACKEND_PID=$!

(
  cd "$ROOT/frontend"
  npm run dev
) &
FRONTEND_PID=$!

echo "Courseportel services started."
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:8000"

wait