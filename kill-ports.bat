@echo off
echo Killing processes on YouTube Matrix ports...
echo.

REM 清理所有相关进程
echo Killing YouTube processes...
taskkill /FI "WindowTitle eq YouTube*" /T /F 2>nul
taskkill /FI "ImageName eq node.exe" /FI "WindowTitle eq *npm*" /T /F 2>nul

REM 清理端口 5989 (后端)
echo.
echo Cleaning port 5989 (Backend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5989') do (
    echo   Found process PID: %%a
    taskkill /F /PID %%a 2>nul
)

REM 清理端口 5173 (前端)
echo.
echo Cleaning port 5173 (Frontend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
    echo   Found process PID: %%a
    taskkill /F /PID %%a 2>nul
)

REM 清理端口 5174 (前端备用)
echo.
echo Cleaning port 5174 (Frontend alternate)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5174') do (
    echo   Found process PID: %%a
    taskkill /F /PID %%a 2>nul
)

echo.
echo Done! All ports should be free now.
pause