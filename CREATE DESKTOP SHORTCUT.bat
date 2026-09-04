@echo off
setlocal EnableExtensions
title Create LevelForge desktop shortcut
cd /d "%~dp0"

REM ===========================================================================
REM  Puts a "LevelForge" shortcut on your desktop that launches the starter.
REM
REM  The shortcut opens minimised, so you get a taskbar item rather than a
REM  command window in your face -- but if startup fails the window is still
REM  there to click on and read the error.
REM ===========================================================================

echo.
echo    Creating desktop shortcut
echo    =========================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $desktop = $ws.SpecialFolders('Desktop'); $lnk = $ws.CreateShortcut((Join-Path $desktop 'LevelForge.lnk')); $lnk.TargetPath = (Join-Path '%CD%' 'START LEVELFORGE.bat'); $lnk.WorkingDirectory = '%CD%'; $lnk.WindowStyle = 7; $lnk.Description = 'LevelForge - trading research library'; $lnk.IconLocation = 'shell32.dll,43'; $lnk.Save(); Write-Host ('   Created: ' + (Join-Path $desktop 'LevelForge.lnk'))"

if errorlevel 1 (
  echo.
  echo    ERROR: Could not create the shortcut.
  echo.
  pause
  exit /b 1
)

echo.
echo    Double-click "LevelForge" on your desktop to start.
echo.
pause
exit /b 0
