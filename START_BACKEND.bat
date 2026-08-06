@echo off
echo ========================================
echo  Starting Backend API Server...
echo ========================================
cd backend
uvicorn main:app --reload --port 8000
pause