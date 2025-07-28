// 直接启动服务器进行测试
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

// 设置环境变量
process.env.NODE_ENV = 'development'
process.env.PORT = process.env.PORT || 5989

// 启动服务器
console.log('启动服务器...')
console.log('端口:', process.env.PORT)
console.log('环境:', process.env.NODE_ENV)

// 使用manual-tests目录下的编译文件
require('./dist/server.js')