@echo off
setlocal EnableExtensions
title Stop LevelForge
cd /d "%~dp0"

REM ===========================================================================
REM  Stops ONLY the LevelForge server.
REM
REM  It finds the process listening on LevelForge's port and stops that one
REM  process. It never runs anything like "taskkill /im node.exe", so other
REM  Node programs you have open are left alone.
REM ===========================================================================

echo.
echo    Stopping LevelForge
echo    ===================
echo.

set "PORT="
for /f "usebackq delims=" %%p in (`node "scripts\port.js" 2^>nul`) do set "PORT=%%p"
if not defined PORT set "PORT=4310"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ids = @(Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); if ($ids.Count -eq 0) { Write-Host '   LevelForge is not running.'; exit 0 }; $stopped = 0; foreach ($id in $ids) { $p = Get-Process -Id $id -ErrorAction SilentlyContinue; if (-not $p) { continue }; if ($p.ProcessName -eq 'node') { Stop-Process -Id $id -Force; Write-Host ('   Stopped LevelForge (node, PID ' + $id + ').'); $stopped++ } else { Write-Host ('   Left ' + $p.ProcessName + ' (PID ' + $id + ') alone - not LevelForge.') } }; if ($stopped -eq 0) { Write-Host '   Nothing belonging to LevelForge was running.' }"

echo.
ping -n 4 127.0.0.1 >nul
exit /b 0
