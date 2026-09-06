@echo off
rem Starts the WPL-2026 site server in the background and keeps it running.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed or not on PATH. & exit /b 1)
start "WPL-2026" /min cmd /c "node server.js 8080 >> server.log 2>&1"
