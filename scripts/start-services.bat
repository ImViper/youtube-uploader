@echo off
echo Starting YouTube Uploader Services...
echo.

REM 检查 Docker 是否在运行
docker version >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not running!
    echo Please start Docker Desktop first.
    pause
    exit /b 1
)

REM 启动 Docker Compose 服务
echo Starting PostgreSQL and Redis...
docker-compose up -d

REM 等待服务启动
echo.
echo Waiting for services to be ready...
timeout /t 5 /nobreak >nul

REM 检查服务状态
echo.
echo Checking service status...
docker-compose ps

echo.
echo Services started successfully!
echo.
echo PostgreSQL: localhost:5987
echo Redis: localhost:5988
echo Redis Commander: http://localhost:8081
echo pgAdmin: http://localhost:8082
echo.
echo To stop services, run: stop-services.bat
pause