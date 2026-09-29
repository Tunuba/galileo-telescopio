@echo off
cd /d "%~dp0"
if exist guardian.pid (
  powershell -NoProfile -Command "if (Get-Process -Id (Get-Content guardian.pid) -ErrorAction SilentlyContinue) { exit 1 }"
  if errorlevel 1 goto abrir
)
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0mantener-encendido.ps1"
timeout /t 4 /nobreak >nul
:abrir
start "" "http://127.0.0.1:9610/maestro/"
