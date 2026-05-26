@echo off
REM Start Flood Intelligence Board Frontend

echo Starting Flood Intelligence Board Frontend...
echo ============================================

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

echo.
echo Starting Next.js development server on http://localhost:3000
echo.

npm run dev
