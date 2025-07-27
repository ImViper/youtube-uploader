// Load environment variables
require('dotenv').config();

console.log('Environment variables:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***SET***' : 'NOT SET');
console.log('DB_PASSWORD type:', typeof process.env.DB_PASSWORD);
console.log('DB_PASSWORD length:', process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 0);

// Now test with loaded env
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5987'),
  database: process.env.DB_NAME || 'youtube_uploader',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function test() {
  try {
    const client = await pool.connect();
    console.log('\nDatabase connection successful!');
    
    const result = await client.query('SELECT COUNT(*) FROM accounts');
    console.log('Account count:', result.rows[0].count);
    
    client.release();
  } catch (error) {
    console.error('\nDatabase connection failed:', error.message);
  } finally {
    await pool.end();
  }
}

test();