@echo off
REM PermissionDrift — Scheduled Task Manager Batch Launcher
setlocal
set SCRIPT_DIR=%~dp0
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%schedule_task.ps1" %*
endlocal
