@echo off
echo ========================================
echo  Intelligent Log Analyzer - Startup
echo ========================================
echo.
echo Starting Backend (FastAPI)...
start cmd /k "cd backend && uvicorn main:app --reload --port 8000"
timeout /t 3 /nobreak > nul

echo.
echo Starting Frontend (React + Vite)...
start cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo  Services Starting...
echo ========================================
echo.
echo Backend API:  http://localhost:8000
echo API Docs:     http://localhost:8000/docs
echo Frontend:     http://localhost:5173
echo.
echo Press any key to exit this window...
pause > nul
