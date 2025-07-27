require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5987'),
    database: process.env.DB_NAME || 'youtube_uploader',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
  });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    
    console.log('Reading schema file...');
    const schemaPath = path.join(__dirname, 'src/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Executing schema...');
    await client.query(schema);
    
    console.log('Database initialized successfully!');
    client.release();
  } catch (error) {
    console.error('Database initialization failed:', error);
  } finally {
    await pool.end();
  }
}

initDatabase();