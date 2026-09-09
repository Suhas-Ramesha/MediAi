@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

REM Slow / flaky networks: default pip timeout is 15s and often fails on PyPI.
set PIP_DEFAULT_TIMEOUT=120

if not exist ".venv\Scripts\python.exe" (
  echo Creating .venv...
  python -m venv .venv
  if errorlevel 1 (
    echo Try: py -m venv .venv
    exit /b 1
  )
)

call ".venv\Scripts\activate.bat"

echo Upgrading pip (helps with large wheels / slow links^)...
python -m pip install --upgrade pip setuptools wheel --default-timeout=120 --retries 10
if errorlevel 1 (
  echo ERROR: pip upgrade failed. Check internet, VPN, firewall, or corporate proxy.
  exit /b 1
)

echo Installing dependencies from requirements.txt ^(this may take a few minutes^)...
python -m pip install --default-timeout=120 --retries 10 -r requirements.txt
if errorlevel 1 (
  echo.
  echo ERROR: Dependency install failed. Nothing was started.
  echo Try: run this script again on a better connection, or from a shell run:
  echo   cd /d "%~dp0"
  echo   .venv\Scripts\activate.bat
  echo   pip install -r requirements.txt --default-timeout=300 --retries 15
  exit /b 1
)

echo Starting ML service on http://127.0.0.1:5050 ...
python -m uvicorn main:app --host 127.0.0.1 --port 5050
