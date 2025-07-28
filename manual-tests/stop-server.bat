@echo off
echo 停止 Node.js 服务器...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5989" ^| find "LISTENING"') do (
    echo 找到进程 PID: %%a
    taskkill /F /PID %%a
)
echo 完成！