#\!/bin/bash
echo "==================================="
echo "YouTube Matrix Frontend 系统验证"
echo "==================================="
echo ""
echo "1. 检查环境依赖..."
node -v
npm -v
echo ""
echo "2. 检查构建状态..."
if [ -d "dist" ]; then
    echo "✓ 生产构建已完成"
else
    echo "⚠ 需要运行 npm run build"
fi
echo ""
echo "3. 检查关键模块..."
if [ -f "src/components/monitoring/PerformanceCharts.tsx" ]; then
    echo "✓ 性能监控模块"
fi
if [ -f "src/components/settings/SettingsForm.tsx" ]; then
    echo "✓ 设置管理模块"
fi
if [ -f "src/components/security/SecureInput.tsx" ]; then
    echo "✓ 安全功能模块"
fi
echo ""
echo "==================================="
echo "可用命令："
echo "npm run dev    - 启动开发服务器"
echo "npm run build  - 构建生产版本"
echo "npm test       - 运行测试"
echo "==================================="
