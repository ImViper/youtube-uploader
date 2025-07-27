@echo off
REM 快速启动脚本 - 跳过所有检查，假设环境已准备好
chcp 65001 >nul
echo [Quick Start] YouTube Matrix
echo.

REM 快速清理端口
taskkill /FI "WindowTitle eq YouTube*" /T /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5989') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5174') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak >nul

REM 启动所有服务
docker-compose up -d >nul 2>&1
npm run build >nul 2>&1
start /MIN cmd /k "npm run dev"
cd youtube-matrix-frontend && start /MIN cmd /k "npm run dev" && cd ..

echo Backend: http://localhost:5989
echo Frontend: http://localhost:5173
echo Press any key to stop...
pause >nul

taskkill /FI "WindowTitle eq cmd*" /T /F >nul 2>&1
docker-compose down >nul 2>&1