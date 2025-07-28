@echo off
echo ====================================
echo YouTube Matrix 上传测试
echo ====================================
echo.
echo 请选择要执行的操作:
echo 1. 启动 Worker (保持运行)
echo 2. 创建上传任务
echo 3. 检查队列状态
echo 4. 检查错误信息
echo 5. 清理失败任务
echo 6. 检查 BitBrowser 窗口
echo 7. 测试打开窗口 0629
echo 0. 退出
echo.
set /p choice=请输入选项 (0-7): 

if "%choice%"=="1" (
    echo.
    echo 启动 Worker...
    echo 请保持此窗口开启
    node start-worker-0629.js
) else if "%choice%"=="2" (
    echo.
    echo 创建上传任务...
    node create-upload-task-0629.js
) else if "%choice%"=="3" (
    echo.
    echo 检查队列状态...
    node check-queue-status.js
) else if "%choice%"=="4" (
    echo.
    echo 检查错误信息...
    node check-task-error.js
) else if "%choice%"=="5" (
    echo.
    echo 清理失败任务...
    node clean-failed-tasks.js
) else if "%choice%"=="6" (
    echo.
    echo 检查 BitBrowser 窗口...
    node check-bitbrowser-windows.js
) else if "%choice%"=="7" (
    echo.
    echo 测试打开窗口 0629...
    node test-bitbrowser-open.js
) else if "%choice%"=="0" (
    echo.
    echo 退出...
    exit /b
) else (
    echo.
    echo 无效的选项！
    pause
    run-test.bat
)

echo.
pause