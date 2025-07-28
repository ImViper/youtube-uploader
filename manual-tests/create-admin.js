const bcrypt = require('bcrypt');
const { Client } = require('pg');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function createAdmin() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5987'),
    user: process.env.DB_USER || 'youtube_user',
    password: process.env.DB_PASSWORD || 'qiyuan123',
    database: process.env.DB_NAME || 'youtube_uploader'
  });
  
  try {
    await client.connect();
    
    // Check if admin exists
    const checkResult = await client.query(
      'SELECT id FROM accounts WHERE email = $1',
      ['admin@youtube-matrix.com']
    );
    
    if (checkResult.rows.length === 0) {
      // Create admin account
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await client.query(
        'INSERT INTO accounts (email, encrypted_credentials, browser_profile_id, status) VALUES ($1, $2, $3, $4)',
        ['admin@youtube-matrix.com', hashedPassword, 'admin-profile', 'active']
      );
      console.log('✅ Admin account created successfully');
    } else {
      console.log('ℹ️  Admin account already exists');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

createAdmin();