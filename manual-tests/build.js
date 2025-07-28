const { execSync } = require('child_process')
const path = require('path')

console.log('构建项目...')

try {
  // 切换到项目根目录
  process.chdir(path.join(__dirname, '..'))
  
  // 使用 manual-tests 中的 tsconfig.json
  execSync('npx tsc -p manual-tests/tsconfig.json', { stdio: 'inherit' })
  
  // 复制 SQL 文件
  execSync('npm run copy:sql', { stdio: 'inherit' })
  
  console.log('✅ 构建完成！')
} catch (error) {
  console.error('❌ 构建失败:', error.message)
  process.exit(1)
}