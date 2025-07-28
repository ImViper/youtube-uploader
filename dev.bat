@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM 配置
set BACKEND_PORT=5989
set FRONTEND_PORT=5173
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "RESET=[0m"

cls
echo %GREEN%======================================%RESET%
echo %GREEN%YouTube Matrix Development%RESET%
echo %GREEN%======================================%RESET%
echo.

REM 检查参数
if "%1"=="--help" goto :help
if "%1"=="--stop" goto :stop
if "%1"=="--status" goto :status
if "%1"=="--logs" goto :logs
if "%1"=="--test" goto :test_mode
if "%1"=="--restart" goto :restart

REM 检查 Docker
docker version >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR] Docker is not running!%RESET%
    echo Please start Docker Desktop first.
    pause
    exit /b 1
)

REM 清理端口
echo Cleaning up ports...

REM 先尝试关闭已知的进程
taskkill /FI "WindowTitle eq YouTube Backend*" /T /F >nul 2>&1
taskkill /FI "WindowTitle eq YouTube Frontend*" /T /F >nul 2>&1
taskkill /FI "WindowTitle eq YouTube Test Backend*" /T /F >nul 2>&1

REM 清理后端端口 5989
echo   Checking port %BACKEND_PORT%...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%BACKEND_PORT%') do (
    set "pid=%%a"
    if not "!pid!"=="" (
        echo   Killing process on port %BACKEND_PORT% (PID: !pid!)
        taskkill /F /PID !pid! >nul 2>&1
        timeout /t 1 /nobreak >nul
    )
)

REM 清理前端端口 5173
echo   Checking port %FRONTEND_PORT%...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%FRONTEND_PORT%') do (
    set "pid=%%a"
    if not "!pid!"=="" (
        echo   Killing process on port %FRONTEND_PORT% (PID: !pid!)
        taskkill /F /PID !pid! >nul 2>&1
        timeout /t 1 /nobreak >nul
    )
)

REM 清理前端备用端口 5174
echo   Checking port 5174...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5174') do (
    set "pid=%%a"
    if not "!pid!"=="" (
        echo   Killing process on port 5174 (PID: !pid!)
        taskkill /F /PID !pid! >nul 2>&1
    )
)

REM 等待端口释放
timeout /t 2 /nobreak >nul

REM 启动数据库
echo Starting database services...
docker-compose up -d >nul 2>&1

REM 检查依赖
if not exist "node_modules" (
    echo Installing backend dependencies...
    call npm ci
)
if not exist "youtube-matrix-frontend\node_modules" (
    echo Installing frontend dependencies...
    cd youtube-matrix-frontend
    call npm ci
    cd ..
)

REM 等待数据库
echo Waiting for database...
timeout /t 3 /nobreak >nul

REM 构建并启动后端
echo Building backend...
call npm run build
if errorlevel 1 (
    echo %RED%Build failed! Check the code.%RESET%
    echo.
    echo Trying to build again to show error details:
    call npm run build
    pause
    exit /b 1
)

echo Starting backend...
start "YouTube Backend" /MIN cmd /k "npm run dev"

REM 启动前端
echo Starting frontend...
cd youtube-matrix-frontend
start "YouTube Frontend" /MIN cmd /k "npm run dev"
cd ..

REM 等待服务启动
timeout /t 3 /nobreak >nul

echo.
echo %GREEN%✓ All services started!%RESET%
echo.
echo Backend: http://localhost:%BACKEND_PORT%
echo Frontend: http://localhost:%FRONTEND_PORT%
echo pgAdmin: http://localhost:8082
echo.
echo Commands: dev --stop, dev --status, dev --logs, dev --test, dev --restart
echo Press any key to stop all services...
pause >nul
goto :stop

:stop
echo.
echo Stopping services...
taskkill /FI "WindowTitle eq YouTube*" /T /F >nul 2>&1
docker-compose down >nul 2>&1
echo Done!
goto :end

:status
echo.
echo Checking services...
powershell -Command "(New-Object Net.Sockets.TcpClient).Connect('localhost', %BACKEND_PORT%)" >nul 2>&1
if errorlevel 1 (echo Backend: %RED%Offline%RESET%) else (echo Backend: %GREEN%Online%RESET%)
powershell -Command "(New-Object Net.Sockets.TcpClient).Connect('localhost', %FRONTEND_PORT%)" >nul 2>&1
if errorlevel 1 (echo Frontend: %RED%Offline%RESET%) else (echo Frontend: %GREEN%Online%RESET%)
echo.
docker-compose ps
pause
goto :end

:logs
echo.
echo === Recent Logs ===
if exist server.log type server.log
pause
goto :end

:test_mode
echo.
echo %YELLOW%Starting in TEST MODE%RESET%
echo.

REM 清理测试服务器端口
echo Cleaning up test server port...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%BACKEND_PORT%') do (
    set "pid=%%a"
    if not "!pid!"=="" (
        echo   Killing process on port %BACKEND_PORT% (PID: !pid!)
        taskkill /F /PID !pid! >nul 2>&1
        timeout /t 1 /nobreak >nul
    )
)

REM 等待端口释放
timeout /t 2 /nobreak >nul

REM 构建manual-tests
echo Building manual-tests...
cd manual-tests
call node build.js
if errorlevel 1 (
    echo %RED%Build failed!%RESET%
    cd ..
    pause
    exit /b 1
)

REM 启动测试服务器
echo Starting test server...
start "YouTube Test Backend" /MIN cmd /k "node start-server-local.js"
cd ..

REM 等待服务启动
timeout /t 3 /nobreak >nul

echo.
echo %GREEN%✓ Test server started!%RESET%
echo.
echo Test Server: http://localhost:%BACKEND_PORT%
echo.
echo Run tests in manual-tests directory
echo Press any key to stop test server...
pause >nul
goto :stop

:restart
echo.
echo %YELLOW%Restarting all services...%RESET%
goto :stop

:help
echo.
echo Usage: dev [options]
echo   (no args)  Start all services (normal mode)
echo   --test     Start in test mode (manual-tests)
echo   --restart  Restart all services
echo   --stop     Stop all services  
echo   --status   Check service status
echo   --logs     View recent logs
echo   --help     Show this help
pause
goto :end

:end
endlocal