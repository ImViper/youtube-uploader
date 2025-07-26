import { getDatabase } from './connection';
import path from 'path';
import pino from 'pino';
import { getErrorMessage } from '../utils/error-utils';

const logger = pino({
  name: 'db-init',
  level: process.env.LOG_LEVEL || 'info'
});

/**
 * Initialize database with schema
 */
export async function initializeDatabase(): Promise<void> {
  const db = getDatabase();
  
  try {
    // Connect to database
    await db.connect();
    logger.info('Connected to database');

    // Initialize schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    await db.initializeSchema(schemaPath);
    logger.info('Database schema initialized');

    // Verify tables exist
    const tables = ['accounts', 'upload_tasks', 'browser_instances', 'upload_history'];
    for (const table of tables) {
      const result = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [table]
      );
      
      if (!result.rows[0].exists) {
        throw new Error(`Table ${table} was not created`);
      }
    }
    
    logger.info('All tables verified successfully');
  } catch (error) {
    logger.error('Database initialization failed', error);
    throw error;
  }
}

/**
 * Drop all tables (for testing/development)
 */
export async function dropAllTables(): Promise<void> {
  const db = getDatabase();
  
  try {
    await db.connect();
    
    // Drop views first
    await db.query('DROP VIEW IF EXISTS task_queue_status CASCADE');
    await db.query('DROP VIEW IF EXISTS account_health_summary CASCADE');
    
    // Drop tables
    await db.query('DROP TABLE IF EXISTS upload_history CASCADE');
    await db.query('DROP TABLE IF EXISTS browser_instances CASCADE');
    await db.query('DROP TABLE IF EXISTS upload_tasks CASCADE');
    await db.query('DROP TABLE IF EXISTS accounts CASCADE');
    
    // Drop functions
    await db.query('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE');
    await db.query('DROP FUNCTION IF EXISTS reset_daily_upload_counts() CASCADE');
    
    logger.info('All tables dropped successfully');
  } catch (error) {
    logger.error('Failed to drop tables', error);
    throw error;
  }
}

/**
 * Reset daily upload counts for all accounts
 */
export async function resetDailyUploadCounts(): Promise<void> {
  const db = getDatabase();
  
  try {
    await db.query('SELECT reset_daily_upload_counts()');
    logger.info('Daily upload counts reset successfully');
  } catch (error) {
    logger.error('Failed to reset daily upload counts', error);
    throw error;
  }
}

// CLI support for running initialization
if (require.main === module) {
  const command = process.argv[2];
  
  async function run() {
    try {
      switch (command) {
        case 'init':
          await initializeDatabase();
          console.log('Database initialized successfully');
          break;
        case 'drop':
          await dropAllTables();
          console.log('All tables dropped successfully');
          break;
        case 'reset-daily':
          await resetDailyUploadCounts();
          console.log('Daily upload counts reset successfully');
          break;
        default:
          console.log('Usage: ts-node init.ts [init|drop|reset-daily]');
          process.exit(1);
      }
      process.exit(0);
    } catch (error) {
      console.error('Error:', getErrorMessage(error));
      process.exit(1);
    }
  }
  
  run();
}