@echo off
setlocal enabledelayedexpansion

set "ROOT=%~dp0.."
cd /d "%ROOT%"

if not exist "frontend\dist\index.html" (
  echo frontend\dist is missing.
  echo Ask Codex to run the package build again before sending this folder.
  pause
  exit /b 1
)

set "PYTHON_CMD="
where py >nul 2>nul
if not errorlevel 1 set "PYTHON_CMD=py -3"

if not defined PYTHON_CMD (
  where python >nul 2>nul
  if not errorlevel 1 set "PYTHON_CMD=python"
)

if not defined PYTHON_CMD (
  echo Python 3 was not found.
  echo Install Python 3.11 or newer from https://www.python.org/downloads/windows/
  echo During installation, tick "Add python.exe to PATH".
  pause
  exit /b 1
)

set "VENV=%ROOT%\.demo-venv"

if not exist "%VENV%\Scripts\python.exe" (
  echo Creating local Python environment at .demo-venv ...
  %PYTHON_CMD% -m venv "%VENV%"
  if errorlevel 1 (
    echo Failed to create Python virtual environment.
    pause
    exit /b 1
  )

  "%VENV%\Scripts\python.exe" -m pip install --upgrade pip
  if errorlevel 1 (
    echo Failed to upgrade pip.
    pause
    exit /b 1
  )

  "%VENV%\Scripts\python.exe" -m pip install -r "%ROOT%\backend\requirements.txt"
  if errorlevel 1 (
    echo Failed to install Python dependencies.
    pause
    exit /b 1
  )
)

set "PORT="
for /f "usebackq delims=" %%p in (`"%VENV%\Scripts\python.exe" "%ROOT%\scripts\find_free_port.py"`) do set "PORT=%%p"

if not defined PORT (
  echo No free local port found in 8000-8010.
  pause
  exit /b 1
)

set "URL=http://127.0.0.1:%PORT%"

echo.
echo Project A demo is starting.
echo Open this address if the browser does not open automatically:
echo %URL%
echo.
echo Leave this window open during the demo. Press Ctrl+C to stop.
echo.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process '%URL%'"
set "PYTHONPATH=%ROOT%\backend;%PYTHONPATH%"
"%VENV%\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port %PORT%

pause
