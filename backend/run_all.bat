@echo off
title Zero-Trust IoT Security Framework
echo ========================================================================
echo   Starting Zero-Trust IoT Security Framework (Automated Run)
echo ========================================================================
echo.

cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" run_all.py
) else if exist "python-security\venv\Scripts\python.exe" (
    "python-security\venv\Scripts\python.exe" run_all.py
) else (
    python run_all.py
)

pause
