@echo off
chcp 65001 >nul

:menu
cls
echo ======================================
echo YouTube Matrix Dev Tools
echo ======================================
echo.
echo [1] View Logs
echo [2] Database Console (pgAdmin)
echo [3] Clear Cache & Rebuild
echo [4] Run Tests
echo [5] Check Status
echo [0] Exit
echo.
set /p choice="Select: "

if "%choice%"=="1" goto :logs
if "%choice%"=="2" start http://localhost:8082 && goto :menu
if "%choice%"=="3" goto :clean
if "%choice%"=="4" npm test && pause && goto :menu
if "%choice%"=="5" goto :status
if "%choice%"=="0" exit /b 0
goto :menu

:logs
cls
echo === Logs ===
echo [1] Backend logs
echo [2] Docker logs
echo [3] Clear logs
echo [4] Back
echo.
set /p log="Select: "
if "%log%"=="1" (
    if exist server.log type server.log
    pause
)
if "%log%"=="2" docker-compose logs && pause
if "%log%"=="3" del *.log 2>nul && echo Logs cleared && pause
goto :menu

:clean
echo Cleaning...
rmdir /S /Q dist 2>nul
docker exec youtube-uploader-redis-1 redis-cli FLUSHALL >nul 2>&1
echo Building...
npm run build
echo Done!
pause
goto :menu

:status
echo.
echo === Service Status ===
netstat -an | findstr :5989 >nul 2>&1
if errorlevel 1 (echo Backend: Offline) else (echo Backend: Online)
netstat -an | findstr :5173 >nul 2>&1
if errorlevel 1 (echo Frontend: Offline) else (echo Frontend: Online)
echo.
docker-compose ps
pause
goto :menu