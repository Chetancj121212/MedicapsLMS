@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo ========================================
echo Courseportel setup
echo ========================================
echo.

where python >nul 2>&1
if not errorlevel 1 (
    set "PYTHON=python"
) else (
    where py >nul 2>&1
    if not errorlevel 1 (
        set "PYTHON=py"
    ) else (
        echo ERROR: Python was not found.
        echo Install Python 3.10 or newer from https://www.python.org/downloads/
        exit /b 1
    )
)

where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm was not found.
    echo Install Node.js LTS from https://nodejs.org/
    exit /b 1
)

echo Python:
%PYTHON% --version
echo npm:
npm --version
echo.

if not exist "backend\venv\Scripts\python.exe" (
    echo Creating backend virtual environment...
    %PYTHON% -m venv backend\venv
    if errorlevel 1 goto :failed
) else (
    echo Backend virtual environment already exists.
)

echo Installing backend dependencies...
call "backend\venv\Scripts\python.exe" -m pip install -r "backend\requirements.txt"
if errorlevel 1 goto :failed

if not exist "backend\.env" (
    echo Creating backend\.env from backend\.env.example...
    copy /Y "backend\.env.example" "backend\.env" >nul
    if errorlevel 1 goto :failed
) else (
    echo Keeping existing backend\.env.
)

echo Installing frontend dependencies...
pushd frontend
if exist package-lock.json (
    call npm ci
) else (
    call npm install
)
if errorlevel 1 (
    popd
    goto :failed
)
popd

echo.
echo Setup complete.
echo Run start.bat to launch the backend and frontend.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8000
exit /b 0

:failed
echo.
echo ERROR: Setup failed. Review the message above and try again.
exit /b 1