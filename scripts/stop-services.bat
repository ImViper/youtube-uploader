@echo off
echo Stopping YouTube Uploader Services...
echo.

REM 停止 Docker Compose 服务
docker-compose down

echo.
echo Services stopped successfully!
pause