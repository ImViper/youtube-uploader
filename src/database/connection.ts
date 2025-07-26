import { Pool, PoolConfig, QueryResult } from 'pg';
import pino from 'pino';
import { getErrorMessage } from '../utils/error-utils';

const logger = pino({
  name: 'database',
  level: process.env.LOG_LEVEL || 'info'
});

export interface DatabaseConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  max?: number; // maximum number of clients in the pool
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export class DatabaseConnection {
  private pool: Pool;
  private isConnected: boolean = false;

  constructor(config?: DatabaseConfig) {
    const poolConfig: PoolConfig = {
      host: config?.host || process.env.DB_HOST || 'localhost',
      port: config?.port || parseInt(process.env.DB_PORT || '5987'),
      database: config?.database || process.env.DB_NAME || 'youtube_uploader',
      user: config?.user || process.env.DB_USER || 'postgres',
      password: config?.password || process.env.DB_PASSWORD,
      max: config?.max || 20,
      idleTimeoutMillis: config?.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config?.connectionTimeoutMillis || 2000,
    };

    this.pool = new Pool(poolConfig);

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle database client', err);
    });

    this.pool.on('connect', () => {
      logger.debug('New client connected to database pool');
    });

    this.pool.on('remove', () => {
      logger.debug('Client removed from database pool');
    });
  }

  /**
   * Test database connection
   */
  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      this.isConnected = true;
      logger.info('Successfully connected to database');
    } catch (error) {
      logger.error('Failed to connect to database', error);
      throw new Error(`Database connection failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Execute a query with parameters
   */
  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<any>> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug({ text, duration, rows: result.rowCount }, 'Executed query');
      return result;
    } catch (error) {
      logger.error({ text, error }, 'Query failed');
      throw error;
    }
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Initialize database schema
   */
  async initializeSchema(schemaPath: string): Promise<void> {
    const fs = require('fs-extra');
    try {
      const schema = await fs.readFile(schemaPath, 'utf8');
      await this.query(schema);
      logger.info('Database schema initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database schema', error);
      throw error;
    }
  }

  /**
   * Check if database is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1');
      return result.rowCount === 1;
    } catch (error) {
      logger.error('Database health check failed', error);
      return false;
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  /**
   * Close all database connections
   */
  async close(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connection pool closed');
    } catch (error) {
      logger.error('Error closing database pool', error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
let databaseInstance: DatabaseConnection | null = null;

/**
 * Get or create database connection instance
 */
export function getDatabase(config?: DatabaseConfig): DatabaseConnection {
  if (!databaseInstance) {
    databaseInstance = new DatabaseConnection(config);
  }
  return databaseInstance;
}

/**
 * Close database connection and reset singleton
 */
export async function closeDatabase(): Promise<void> {
  if (databaseInstance) {
    await databaseInstance.close();
    databaseInstance = null;
  }
}