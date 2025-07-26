#!/bin/bash

echo "======================================"
echo "Stopping YouTube Matrix Services"
echo "======================================"
echo

# 停止所有 Node.js 进程
echo "Stopping Node.js processes..."
pkill -f "npm run dev" 2>/dev/null
pkill -f "vite" 2>/dev/null
pkill -f "node" 2>/dev/null

# 停止 Docker 服务
echo "Stopping Docker services..."
docker-compose down

echo
echo "All services stopped!"