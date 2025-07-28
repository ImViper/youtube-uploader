/**
 * 测试账号创建功能，特别是 bitbrowser_window_name 字段的保存
 * 根据最新代码进行更新
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
  console.log('=== 测试账号创建功能（更新版）===\n')
  
  let token
  try {
    // 获取认证令牌
    console.log('🔑 获取认证令牌...')
    token = await login()
    console.log('✅ 获取令牌成功')
    
    // 连接数据库
    await dbClient.connect()
    console.log('✅ 数据库连接成功')
    
    // 测试数据
    const testAccount = {
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      bitbrowser_window_name: `TestWindow_${Date.now()}`,
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
    
    console.log('\n📝 测试账号数据:')
    console.log(JSON.stringify(testAccount, null, 2))
    
    // 调用 API 创建账号
    console.log('\n🚀 调用 API 创建账号...')
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
    
    console.log('\n✅ API 响应成功:')
    console.log('状态码:', response.status)
    console.log('返回数据:', JSON.stringify(response.data, null, 2))
    
    const createdAccount = response.data.data || response.data
    
    // 直接从数据库验证
    console.log('\n🔍 从数据库验证账号数据...')
    const dbResult = await dbClient.query(
      'SELECT * FROM accounts WHERE email = $1',
      [testAccount.email]
    )
    
    if (dbResult.rows.length === 0) {
      throw new Error('账号未在数据库中找到')
    }
    
    const dbAccount = dbResult.rows[0]
    console.log('\n📊 数据库中的账号记录:')
    console.log('ID:', dbAccount.id)
    console.log('Email:', dbAccount.email)
    console.log('Browser Profile ID:', dbAccount.browser_profile_id)
    console.log('BitBrowser Window Name:', dbAccount.bitbrowser_window_name)
    console.log('BitBrowser Window ID:', dbAccount.bitbrowser_window_id)
    console.log('Is Window Logged In:', dbAccount.is_window_logged_in)
    console.log('Status:', dbAccount.status)
    console.log('Daily Upload Limit:', dbAccount.daily_upload_limit)
    console.log('Health Score:', dbAccount.health_score)
    console.log('Metadata:', dbAccount.metadata)
    console.log('Created At:', dbAccount.created_at)
    
    // 验证关键字段
    console.log('\n✅ 验证结果:')
    
    if (dbAccount.bitbrowser_window_name === testAccount.bitbrowser_window_name) {
      console.log('✅ bitbrowser_window_name 正确保存到数据库')
    } else {
      console.log('❌ bitbrowser_window_name 保存失败')
      console.log(`  期望值: ${testAccount.bitbrowser_window_name}`)
      console.log(`  实际值: ${dbAccount.bitbrowser_window_name}`)
    }
    
    if (dbAccount.daily_upload_limit === testAccount.dailyUploadLimit) {
      console.log('✅ daily_upload_limit 正确保存')
    } else {
      console.log('❌ daily_upload_limit 保存失败')
      console.log(`  期望值: ${testAccount.dailyUploadLimit}`)
      console.log(`  实际值: ${dbAccount.daily_upload_limit}`)
    }
    
    // 验证 API 返回值
    console.log('\n📋 API 返回值验证:')
    if (createdAccount.bitbrowser_window_name === testAccount.bitbrowser_window_name) {
      console.log('✅ API 返回的 bitbrowser_window_name 正确')
    } else {
      console.log('❌ API 返回的 bitbrowser_window_name 不正确')
      console.log(`  期望值: ${testAccount.bitbrowser_window_name}`)
      console.log(`  实际值: ${createdAccount.bitbrowser_window_name}`)
    }
    
    // 测试更新功能
    console.log('\n\n=== 测试账号更新功能 ===')
    
    const updateData = {
      bitbrowser_window_name: `UpdatedWindow_${Date.now()}`
    }
    
    console.log('\n📝 更新数据:')
    console.log(JSON.stringify(updateData, null, 2))
    
    const updateResponse = await axios.put(
      `${API_BASE_URL}/accounts/${createdAccount.id}`,
      updateData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    console.log('\n✅ 更新 API 响应成功')
    console.log('返回数据:', JSON.stringify(updateResponse.data, null, 2))
    
    // 再次从数据库验证
    const dbResultAfterUpdate = await dbClient.query(
      'SELECT * FROM accounts WHERE id = $1',
      [createdAccount.id]
    )
    
    const updatedDbAccount = dbResultAfterUpdate.rows[0]
    console.log('\n📊 更新后的数据库记录:')
    console.log('BitBrowser Window Name:', updatedDbAccount.bitbrowser_window_name)
    
    if (updatedDbAccount.bitbrowser_window_name === updateData.bitbrowser_window_name) {
      console.log('✅ bitbrowser_window_name 更新成功')
    } else {
      console.log('❌ bitbrowser_window_name 更新失败')
      console.log(`  期望值: ${updateData.bitbrowser_window_name}`)
      console.log(`  实际值: ${updatedDbAccount.bitbrowser_window_name}`)
    }
    
    // 清理测试数据
    console.log('\n🧹 清理测试数据...')
    await dbClient.query('DELETE FROM accounts WHERE id = $1', [createdAccount.id])
    console.log('✅ 测试数据已清理')
    
    console.log('\n\n🎉 测试完成！')
    
  } catch (error) {
    console.error('\n❌ 测试失败:')
    console.error('错误类型:', error.name)
    console.error('错误消息:', error.message)
    
    if (error.response) {
      console.error('API 响应状态:', error.response.status)
      console.error('API 响应数据:', error.response.data)
    }
    
    if (error.stack) {
      console.error('\n堆栈跟踪:')
      console.error(error.stack)
    }
  } finally {
    // 关闭数据库连接
    await dbClient.end()
    console.log('\n数据库连接已关闭')
  }
}

// 运行测试
console.log('开始测试账号创建功能...\n')
testAccountCreation()