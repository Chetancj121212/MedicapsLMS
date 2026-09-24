@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND_PYTHON=%ROOT%backend\venv\Scripts\python.exe"

if not exist "%BACKEND_PYTHON%" set "BACKEND_PYTHON=python"

start "Courseportel Backend" /D "%ROOT%backend" cmd /k ""%BACKEND_PYTHON%" -m uvicorn app.main:app --reload"
start "Courseportel Frontend" /D "%ROOT%frontend" cmd /k "npm run dev"

echo Courseportel services started.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8000

endlocal