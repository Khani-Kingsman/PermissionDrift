@echo off
echo ===================================================
echo Stopping PermissionDrift Background Daemon...
echo ===================================================

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000') do (
    taskkill /F /PID %%a 2>nul
)

echo PermissionDrift daemon stopped successfully.
pause
