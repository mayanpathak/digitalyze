@echo off
echo Starting Backend Server...
cd /d "%~dp0"
set PORT=5000
set NODE_ENV=development
set FRONTEND_URL=http://localhost:3000
echo Backend will accept requests from both localhost:3000 and localhost:3001
npm start
pause 