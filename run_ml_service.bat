@echo off
REM Start ML risk API from repo root (uvicorn must run with cwd = ml_service so "main" imports).
cd /d "%~dp0ml_service"
call start.bat
