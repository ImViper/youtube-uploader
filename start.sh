#!/bin/bash

echo "======================================"
echo "YouTube Matrix Development"
echo "======================================"
echo

# 检查 Docker
if ! docker version &>/dev/null; then
    echo "[ERROR] Docker is not running!"
    echo "Please start Docker first."
    exit 1
fi

# 启动数据库
echo "Starting services..."
docker-compose up -d

# 检查依赖
if [ ! -d "youtube-matrix-frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd youtube-matrix-frontend
    npm install
    cd ..
fi

if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
fi

# 等待数据库就绪
echo "Waiting for database..."
sleep 3

# 构建后端
echo "Building backend..."
npm run build

# 启动后端
echo "Starting backend API server..."
npm run dev &
BACKEND_PID=$!

# 等待后端启动
sleep 3

# 启动前端
echo "Starting frontend..."
cd youtube-matrix-frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo
echo "======================================"
echo "✓ All services started!"
echo "======================================"
echo "Backend API: http://localhost:5989"
echo "Frontend:    http://localhost:5173"
echo "Database:    localhost:5987"
echo "Redis:       localhost:5988"
echo "pgAdmin:     http://localhost:8082"
echo "======================================"
echo
echo "Press Ctrl+C to stop all services..."

# 捕获 Ctrl+C
trap 'echo -e "\n\nStopping services..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; docker-compose down; echo "Done!"; exit' INT

# 保持脚本运行
wait