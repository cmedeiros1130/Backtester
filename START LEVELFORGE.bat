@echo off
setlocal EnableExtensions
title LevelForge
cd /d "%~dp0"

REM ===========================================================================
REM  Starts LevelForge and opens it in your browser.
REM
REM  Everything stays on this PC. The database and your screenshots are read
REM  from the "data" folder next to this file -- this script deliberately does
REM  NOT set LEVELFORGE_DATA_DIR, so the server uses its normal local default.
REM ===========================================================================

echo.
echo    LevelForge
echo    ==========
echo.

REM --- Node present? ---------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
  echo    ERROR: Node.js was not found.
  echo.
  echo    LevelForge needs Node 24. Install it from https://nodejs.org
  echo    then double-click this file again.
  echo.
  pause
  exit /b 1
)

REM --- Which port does the server actually use? ------------------------------
set "PORT="
for /f "usebackq delims=" %%p in (`node "scripts\port.js" 2^>nul`) do set "PORT=%%p"
if not defined PORT set "PORT=4310"
set "URL=http://localhost:%PORT%"

REM --- Already running? Then just open it. -----------------------------------
call :isRunning
if not errorlevel 1 (
  echo    Already running - opening %URL%
  start "" "%URL%"
  ping -n 3 127.0.0.1 >nul
  exit /b 0
)

REM --- First run: install dependencies ---------------------------------------
if not exist "node_modules\" (
  echo    First run - installing dependencies. This takes a minute...
  echo.
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :installFailed
  echo.
)

REM --- Build the interface if it is missing -----------------------------------
if not exist "client\dist\index.html" (
  echo    Building the interface...
  echo.
  call npm run build
  if errorlevel 1 goto :buildFailed
  echo.
)

REM --- Start the server in its own minimised window --------------------------
echo    Starting LevelForge...
if exist "levelforge-server.log" del "levelforge-server.log" >nul 2>&1
set "NODE_ENV=production"
start "LevelForge server" /min cmd /c "node server\src\index.js > levelforge-server.log 2>&1"

REM --- Wait until it is genuinely ready --------------------------------------
set /a tries=0
:waitLoop
set /a tries+=1
call :isRunning
if not errorlevel 1 goto :ready
if %tries% GEQ 40 goto :startFailed
ping -n 2 127.0.0.1 >nul
goto :waitLoop

:ready
echo    Ready. Opening %URL%
start "" "%URL%"
echo.
echo    ------------------------------------------------------------
echo      LevelForge is running at %URL%
echo.
echo      Your data:  %CD%\data
echo.
echo      Leave it running while you work.
echo      To stop it, double-click "STOP LEVELFORGE.bat".
echo    ------------------------------------------------------------
echo.
ping -n 7 127.0.0.1 >nul
exit /b 0

REM ===========================================================================
REM  Helpers
REM ===========================================================================

REM Returns errorlevel 0 when LevelForge answers on the port, 1 otherwise.
REM Asks the health endpoint rather than just checking the port, so something
REM else listening on %PORT% is never mistaken for LevelForge.
:isRunning
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -Uri '%URL%/api/health' -TimeoutSec 3 -UseBasicParsing; if ($r.StatusCode -eq 200 -and $r.Content -match 'levelforge|ok') { exit 0 } } catch { }; exit 1" >nul 2>&1
exit /b %errorlevel%

:installFailed
echo.
echo    ERROR: Could not install dependencies.
echo    Check your internet connection and try again.
echo.
pause
exit /b 1

:buildFailed
echo.
echo    ERROR: Could not build the interface.
echo.
pause
exit /b 1

:startFailed
echo.
echo    ERROR: The server did not start within 40 seconds.
echo.
if exist "levelforge-server.log" (
  echo    Last lines of levelforge-server.log:
  echo    ------------------------------------------------------------
  powershell -NoProfile -Command "Get-Content 'levelforge-server.log' -Tail 20"
  echo    ------------------------------------------------------------
) else (
  echo    No log file was produced - the server may not have launched at all.
)
echo.
echo    A common cause is another program already using port %PORT%.
echo.
pause
exit /b 1
