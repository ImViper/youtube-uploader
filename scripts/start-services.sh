#!/bin/bash

echo "Starting YouTube Uploader Services..."
echo

# 检查 Docker 是否在运行
if ! docker version >/dev/null 2>&1; then
    echo "Error: Docker is not running!"
    echo "Please start Docker first."
    exit 1
fi

# 启动 Docker Compose 服务
echo "Starting PostgreSQL and Redis..."
docker-compose up -d

# 等待服务启动
echo
echo "Waiting for services to be ready..."
sleep 5

# 检查服务状态
echo
echo "Checking service status..."
docker-compose ps

echo
echo "Services started successfully!"
echo
echo "PostgreSQL: localhost:5987"
echo "Redis: localhost:5988"
echo "Redis Commander: http://localhost:8081"
echo "pgAdmin: http://localhost:8082"
echo
echo "To stop services, run: ./stop-services.sh"