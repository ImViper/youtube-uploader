// 直接启动服务器进行测试
require('dotenv').config()
const path = require('path')

// 设置环境变量
process.env.NODE_ENV = 'development'
process.env.PORT = process.env.PORT || 3000

// 启动服务器
console.log('启动服务器...')
require('../dist/server.js')