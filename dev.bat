@echo off
chcp 65001 >nul
echo ======================================
echo YouTube Matrix Development
echo ======================================
echo.

REM 清理旧的前端进程
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5174') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM 检查 Docker
docker version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop first.
    pause
    exit /b 1
)

REM 启动数据库
echo Starting services...
docker-compose up -d >nul 2>&1

REM 检查依赖
if not exist "youtube-matrix-frontend\node_modules" (
    echo Installing dependencies...
    cd youtube-matrix-frontend
    call npm install
    cd ..
)

REM 等待数据库就绪
timeout /t 3 /nobreak >nul

REM 构建后端
echo Building backend...
call npm run build

REM 启动后端
echo Starting backend API server...
start "YouTube Backend" cmd /k "chcp 65001 && npm run dev"

REM 等待后端启动
timeout /t 3 /nobreak >nul

REM 启动前端
echo Starting frontend...
cd youtube-matrix-frontend
start "YouTube Frontend" cmd /k "chcp 65001 && npm run dev"
cd ..

echo.
echo ======================================
echo ✓ All services started!
echo ======================================
echo Backend API: http://localhost:5989
echo Frontend:    http://localhost:5173
echo Database:    localhost:5987
echo Redis:       localhost:5988
echo pgAdmin:     http://localhost:8082
echo ======================================
echo.
echo Press any key to stop all services...
pause >nul

REM 停止所有服务
echo.
echo Stopping services...
taskkill /FI "WindowTitle eq YouTube Frontend*" /T /F >nul 2>&1
taskkill /FI "WindowTitle eq YouTube Backend*" /T /F >nul 2>&1
docker-compose down
echo Done!