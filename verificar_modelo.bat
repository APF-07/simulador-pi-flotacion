@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
    py -m unittest discover -s tests -v
    py control_pid.py
) else (
    python -m unittest discover -s tests -v
    python control_pid.py
)
pause
