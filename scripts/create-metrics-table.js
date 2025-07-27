require('dotenv').config();
const { Pool } = require('pg');

async function createMetricsTable() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5987'),
    database: process.env.DB_NAME || 'youtube_uploader',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
  });

  try {
    console.log('Creating metrics_history table...');
    const client = await pool.connect();
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS metrics_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        timestamp TIMESTAMP NOT NULL,
        metric_type VARCHAR(50) NOT NULL,
        metric_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query('CREATE INDEX IF NOT EXISTS idx_metrics_history_timestamp ON metrics_history(timestamp)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_metrics_history_type ON metrics_history(metric_type)');
    
    console.log('Table created successfully!');
    client.release();
  } catch (error) {
    console.error('Failed to create table:', error);
  } finally {
    await pool.end();
  }
}

createMetricsTable();