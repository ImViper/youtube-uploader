@echo off
echo === YouTube 视频上传完整测试 ===
echo.

echo [1/6] 检查服务状态...

:: 检查 Redis
echo 检查 Redis...
redis-cli ping > nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Redis 未运行，请先启动 Redis
    exit /b 1
)
echo [√] Redis 正在运行

:: 检查 PostgreSQL
echo 检查 PostgreSQL...
pg_isready -h localhost -p 5432 > nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] PostgreSQL 未运行，请先启动 PostgreSQL
    exit /b 1
)
echo [√] PostgreSQL 正在运行

:: 检查 BitBrowser
echo 检查 BitBrowser API...
curl -s http://127.0.0.1:54345/browser/list > nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] BitBrowser API 未响应，可能需要手动启动
)
echo.

echo [2/6] 启动 API 服务器...
cd ..
start "API Server" cmd /c "npm run server"
echo 等待服务器启动...
timeout /t 5 /nobreak > nul

echo.
echo [3/6] 启动 Upload Worker...
start "Upload Worker" cmd /c "node dist/start-worker.js"
echo 等待 Worker 启动...
timeout /t 3 /nobreak > nul

echo.
echo [4/6] 运行上传测试...
cd manual-tests
node full-upload-test.js

echo.
echo 测试完成！
echo.
echo 请检查打开的窗口查看详细日志
echo 按任意键关闭所有服务...
pause > nul

:: 关闭服务
taskkill /FI "WindowTitle eq API Server*" /T /F > nul 2>&1
taskkill /FI "WindowTitle eq Upload Worker*" /T /F > nul 2>&1