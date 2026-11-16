@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -m pip install -r requirements.txt
  if errorlevel 1 goto error
  py app.py
) else (
  python -m pip install -r requirements.txt
  if errorlevel 1 goto error
  python app.py
)
pause
exit /b
:error
echo No se pudo instalar Flask. Verifica que Python este instalado y que tengas conexion.
pause
