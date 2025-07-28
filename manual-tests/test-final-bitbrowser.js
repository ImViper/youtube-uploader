/**
 * 最终测试脚本 - 验证 bitbrowser_window_name 字段功能
 */

require('dotenv').config()
const axios = require('axios')
const { Client } = require('pg')

const API_BASE_URL = process.env.API_URL || 'http://localhost:5989/api/v1'

// 创建数据库客户端
const dbClient = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5987,
  database: process.env.DB_NAME || 'youtube_uploader',
  user: process.env.DB_USER || 'youtube_user',
  password: process.env.DB_PASSWORD || 'qiyuan123'
})

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
}

function success(msg) {
  console.log(`${colors.green}✅ ${msg}${colors.reset}`)
}

function error(msg) {
  console.log(`${colors.red}❌ ${msg}${colors.reset}`)
}

function info(msg) {
  console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`)
}

function warning(msg) {
  console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`)
}

async function login() {
  try {
    const loginResponse = await axios.post(
      `${API_BASE_URL.replace('/v1', '')}/auth/login`,
      {
        username: 'admin',
        password: 'admin123'
      }
    )
    return loginResponse.data.accessToken
  } catch (error) {
    console.error('登录失败:', error.message)
    throw error
  }
}

async function testAccountCreation() {
  console.log('\n========================================')
  console.log('    BitBrowser Window Name 功能测试')
  console.log('========================================\n')
  
  let token
  let createdAccountId
  
  try {
    // 获取认证令牌
    info('正在获取认证令牌...')
    token = await login()
    success('获取令牌成功')
    
    // 连接数据库
    await dbClient.connect()
    success('数据库连接成功')
    
    // 准备测试数据
    const timestamp = Date.now()
    const testAccount = {
      email: `test-${timestamp}@example.com`,
      password: 'TestPassword123!',
      bitbrowser_window_name: `TestWindow_${timestamp}`,
      dailyUploadLimit: 5,
      proxy: {
        host: '192.168.1.100',
        port: 8080
      },
      metadata: {
        notes: '测试账号，验证 bitbrowser_window_name 字段',
        tags: ['test', 'development']
      }
    }
    
    console.log('\n📝 测试数据准备:')
    console.log('  Email:', testAccount.email)
    console.log('  BitBrowser Window Name:', testAccount.bitbrowser_window_name)
    console.log('  Daily Upload Limit:', testAccount.dailyUploadLimit)
    
    // ===================
    // 测试 1: 创建账号
    // ===================
    console.log('\n\n【测试 1: 创建账号】')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    info('调用 API 创建账号...')
    const response = await axios.post(
      `${API_BASE_URL}/accounts`,
      testAccount,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (response.status === 201) {
      success('API 调用成功，状态码: 201')
    } else {
      warning(`API 调用成功，但状态码不是 201: ${response.status}`)
    }
    
    const createdAccount = response.data.data || response.data
    createdAccountId = createdAccount.id
    
    console.log('\n📊 API 返回数据:')
    console.log('  ID:', createdAccount.id)
    console.log('  Email:', createdAccount.email)
    console.log('  BitBrowser Window Name:', createdAccount.bitbrowser_window_name)
    console.log('  Daily Upload Limit:', createdAccount.dailyUploadLimit)
    
    // 直接从数据库验证
    info('\n从数据库验证数据...')
    const dbResult = await dbClient.query(
      'SELECT * FROM accounts WHERE id = $1',
      [createdAccountId]
    )
    
    if (dbResult.rows.length === 0) {
      throw new Error('账号未在数据库中找到')
    }
    
    const dbAccount = dbResult.rows[0]
    
    console.log('\n🔍 数据库验证结果:')
    
    // 验证 bitbrowser_window_name
    if (dbAccount.bitbrowser_window_name === testAccount.bitbrowser_window_name) {
      success(`bitbrowser_window_name 正确保存: ${dbAccount.bitbrowser_window_name}`)
    } else {
      error(`bitbrowser_window_name 保存失败`)
      console.log(`    期望: ${testAccount.bitbrowser_window_name}`)
      console.log(`    实际: ${dbAccount.bitbrowser_window_name}`)
    }
    
    // 验证 daily_upload_limit
    if (dbAccount.daily_upload_limit === testAccount.dailyUploadLimit) {
      success(`daily_upload_limit 正确保存: ${dbAccount.daily_upload_limit}`)
    } else {
      error(`daily_upload_limit 保存失败`)
      console.log(`    期望: ${testAccount.dailyUploadLimit}`)
      console.log(`    实际: ${dbAccount.daily_upload_limit}`)
    }
    
    // 验证 API 返回值
    if (createdAccount.bitbrowser_window_name === testAccount.bitbrowser_window_name) {
      success(`API 返回正确的 bitbrowser_window_name`)
    } else {
      error(`API 返回的 bitbrowser_window_name 不正确`)
      console.log(`    期望: ${testAccount.bitbrowser_window_name}`)
      console.log(`    实际: ${createdAccount.bitbrowser_window_name}`)
    }
    
    // ===================
    // 测试 2: 更新账号
    // ===================
    console.log('\n\n【测试 2: 更新账号】')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    const updateData = {
      bitbrowser_window_name: `UpdatedWindow_${Date.now()}`
    }
    
    console.log('\n📝 更新数据:')
    console.log('  New BitBrowser Window Name:', updateData.bitbrowser_window_name)
    
    info('\n调用 API 更新账号...')
    const updateResponse = await axios.put(
      `${API_BASE_URL}/accounts/${createdAccountId}`,
      updateData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (updateResponse.status === 200) {
      success('API 更新成功')
    } else {
      warning(`API 更新成功，但状态码不是 200: ${updateResponse.status}`)
    }
    
    // 再次从数据库验证
    info('\n从数据库验证更新结果...')
    const dbResultAfterUpdate = await dbClient.query(
      'SELECT * FROM accounts WHERE id = $1',
      [createdAccountId]
    )
    
    const updatedDbAccount = dbResultAfterUpdate.rows[0]
    
    if (updatedDbAccount.bitbrowser_window_name === updateData.bitbrowser_window_name) {
      success(`bitbrowser_window_name 更新成功: ${updatedDbAccount.bitbrowser_window_name}`)
    } else {
      error(`bitbrowser_window_name 更新失败`)
      console.log(`    期望: ${updateData.bitbrowser_window_name}`)
      console.log(`    实际: ${updatedDbAccount.bitbrowser_window_name}`)
    }
    
    // ===================
    // 测试 3: 获取账号详情
    // ===================
    console.log('\n\n【测试 3: 获取账号详情】')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    info('调用 API 获取账号详情...')
    const getResponse = await axios.get(
      `${API_BASE_URL}/accounts/${createdAccountId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )
    
    const fetchedAccount = getResponse.data.data || getResponse.data
    
    console.log('\n📊 API 返回的账号详情:')
    console.log('  Email:', fetchedAccount.email)
    console.log('  BitBrowser Window Name:', fetchedAccount.bitbrowser_window_name)
    console.log('  Daily Upload Limit:', fetchedAccount.dailyUploadLimit)
    
    if (fetchedAccount.bitbrowser_window_name === updatedDbAccount.bitbrowser_window_name) {
      success('获取的账号数据正确')
    } else {
      error('获取的账号数据不正确')
    }
    
    // ===================
    // 清理测试数据
    // ===================
    console.log('\n\n【清理测试数据】')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    info('删除测试账号...')
    await dbClient.query('DELETE FROM accounts WHERE id = $1', [createdAccountId])
    success('测试数据已清理')
    
    // ===================
    // 测试总结
    // ===================
    console.log('\n\n========================================')
    console.log('              测试完成！')
    console.log('========================================')
    success('所有测试通过！bitbrowser_window_name 功能正常工作。')
    
  } catch (err) {
    console.error('\n\n❌ 测试失败:')
    console.error('错误类型:', err.name)
    console.error('错误消息:', err.message)
    
    if (err.response) {
      console.error('API 响应状态:', err.response.status)
      console.error('API 响应数据:', JSON.stringify(err.response.data, null, 2))
    }
    
    if (err.stack) {
      console.error('\n堆栈跟踪:')
      console.error(err.stack)
    }
    
    // 尝试清理数据
    if (createdAccountId) {
      try {
        await dbClient.query('DELETE FROM accounts WHERE id = $1', [createdAccountId])
        info('\n已清理测试数据')
      } catch (cleanupError) {
        warning('清理测试数据失败')
      }
    }
  } finally {
    // 关闭数据库连接
    await dbClient.end()
    info('\n数据库连接已关闭')
  }
}

// 运行测试
console.clear()
testAccountCreation()