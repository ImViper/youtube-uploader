import { getDatabase } from './connection';
import { readFileSync } from 'fs';
import { join } from 'path';
import pino from 'pino';

const logger = pino({
  name: 'database-migration',
  level: process.env.LOG_LEVEL || 'info'
});

async function runMigrations() {
  const db = getDatabase();
  
  try {
    // Connect to database
    await db.connect();
    
    // Create migrations tracking table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Get list of applied migrations
    const appliedResult = await db.query('SELECT filename FROM migrations');
    const appliedMigrations = new Set(appliedResult.rows.map(row => row.filename));
    
    // Migration files in order
    const migrationFiles = [
      '001_add_browser_window_mapping.sql',
      '002_add_missing_tables.sql',
      '003_add_metrics_history.sql',
      '004_fix_database_issues.sql'
    ];
    
    // Run each migration
    for (const filename of migrationFiles) {
      if (appliedMigrations.has(filename)) {
        logger.info({ filename }, 'Migration already applied, skipping');
        continue;
      }
      
      const filePath = join(__dirname, 'migrations', filename);
      logger.info({ filename }, 'Applying migration');
      
      try {
        const sql = readFileSync(filePath, 'utf8');
        
        // Run migration in transaction
        await db.transaction(async (client) => {
          // Execute migration SQL
          await client.query(sql);
          
          // Record migration as applied
          await client.query(
            'INSERT INTO migrations (filename) VALUES ($1)',
            [filename]
          );
        });
        
        logger.info({ filename }, 'Migration applied successfully');
        
      } catch (error) {
        logger.error({ filename, error }, 'Migration failed');
        throw error;
      }
    }
    
    logger.info('All migrations completed successfully');
    
  } catch (error) {
    logger.error({ error }, 'Database migration failed');
    throw error;
  } finally {
    await db.close();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error }, 'Migration process failed');
      process.exit(1);
    });
}

export { runMigrations };