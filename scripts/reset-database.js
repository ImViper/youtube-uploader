const { getDatabase } = require('../dist/database/connection');
const { initializeDatabase } = require('../dist/database/init');
const pino = require('pino');

const logger = pino({
  name: 'db-reset',
  level: process.env.LOG_LEVEL || 'info'
});

async function resetDatabase() {
  const db = getDatabase();
  
  try {
    logger.info('Starting database reset...');
    
    // Connect to database
    await db.connect();
    logger.info('Connected to database');
    
    // Drop all views first
    logger.info('Dropping views...');
    await db.query('DROP VIEW IF EXISTS task_queue_status CASCADE');
    await db.query('DROP VIEW IF EXISTS account_health_summary CASCADE');
    
    // Drop all tables
    logger.info('Dropping tables...');
    await db.query('DROP TABLE IF EXISTS upload_history CASCADE');
    await db.query('DROP TABLE IF EXISTS browser_instances CASCADE');
    await db.query('DROP TABLE IF EXISTS upload_tasks CASCADE');
    await db.query('DROP TABLE IF EXISTS accounts CASCADE');
    await db.query('DROP TABLE IF EXISTS metrics_history CASCADE');
    await db.query('DROP TABLE IF EXISTS upload_errors CASCADE');
    await db.query('DROP TABLE IF EXISTS queue_stats CASCADE');
    await db.query('DROP TABLE IF EXISTS system_metrics CASCADE');
    await db.query('DROP TABLE IF EXISTS custom_metrics CASCADE');
    await db.query('DROP TABLE IF EXISTS migrations CASCADE');
    await db.query('DROP TABLE IF EXISTS browser_window_mapping CASCADE');
    
    // Drop functions
    logger.info('Dropping functions...');
    await db.query('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE');
    await db.query('DROP FUNCTION IF EXISTS reset_daily_upload_counts() CASCADE');
    
    logger.info('All database objects dropped successfully');
    
    // Close connection
    await db.close();
    
    // Reinitialize database
    logger.info('Reinitializing database...');
    await initializeDatabase();
    
    logger.info('Database reset completed successfully');
  } catch (error) {
    logger.error('Database reset failed:', error);
    throw error;
  } finally {
    await db.close();
  }
}

// Run if called directly
if (require.main === module) {
  resetDatabase()
    .then(() => {
      logger.info('Database reset completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Database reset failed:', error);
      process.exit(1);
    });
}

module.exports = { resetDatabase };