@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND_PYTHON=%ROOT%backend\venv\Scripts\python.exe"

if not exist "%BACKEND_PYTHON%" set "BACKEND_PYTHON=python"

where docker >nul 2>&1
if not errorlevel 1 (
    echo Ensuring PostgreSQL container is running...
    pushd "%ROOT%"
    docker compose up -d db 2>nul || docker-compose up -d db
    if errorlevel 1 (
        echo.
        echo [WARNING] Could not start PostgreSQL container via Docker.
        echo Please ensure Docker Desktop is started!
        echo.
    )
    popd
)

start "Courseportel Backend" /D "%ROOT%backend" cmd /k ""%BACKEND_PYTHON%" -m uvicorn app.main:app --reload"
start "Courseportel Frontend" /D "%ROOT%frontend" cmd /k "npm run dev"

echo Courseportel services started.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8000

endlocal