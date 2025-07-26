import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { getDatabase } from '../database/connection';
import { AccountManager } from '../accounts/manager';
import { getEncryptionService } from '../security/encryption';
import pino from 'pino';
import { Credentials } from '../types';

const logger = pino({
  name: 'migration',
  level: process.env.LOG_LEVEL || 'info'
});

export interface MigrationOptions {
  cookiesPath?: string;
  credentialsPath?: string;
  accountsJsonPath?: string;
  dryRun?: boolean;
  skipValidation?: boolean;
}

export interface LegacyAccount {
  email: string;
  password: string;
  cookies?: any[];
  metadata?: Record<string, any>;
}

export interface MigrationResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{
    account: string;
    error: string;
  }>;
}

/**
 * Migration utility for importing legacy accounts and cookies
 */
export class MigrationUtility {
  private db = getDatabase();
  private accountManager = new AccountManager();
  private encryptionService = getEncryptionService();

  /**
   * Migrate cookies from legacy format
   */
  async migrateCookies(options: MigrationOptions): Promise<MigrationResult> {
    logger.info({ options }, 'Starting cookie migration');

    const result: MigrationResult = {
      total: 0,
      successful: 0,
      failed: 0,
      errors: []
    };

    if (!options.cookiesPath || !existsSync(options.cookiesPath)) {
      logger.error('Cookies file not found');
      return result;
    }

    try {
      // Read cookies file
      const cookiesContent = await readFile(options.cookiesPath, 'utf8');
      const cookiesData = JSON.parse(cookiesContent);

      // Handle different cookie formats
      const accounts = this.parseCookieData(cookiesData);
      result.total = accounts.length;

      logger.info({ count: accounts.length }, 'Found accounts in cookies');

      // Process each account
      for (const account of accounts) {
        try {
          if (options.dryRun) {
            logger.info({ email: account.email }, 'Would migrate account (dry run)');
            result.successful++;
            continue;
          }

          await this.importAccount(account);
          result.successful++;
          logger.info({ email: account.email }, 'Account migrated successfully');

        } catch (error) {
          result.failed++;
          result.errors.push({
            account: account.email,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          logger.error({ account: account.email, error }, 'Failed to migrate account');
        }
      }

      logger.info({ result }, 'Cookie migration completed');
      return result;

    } catch (error) {
      logger.error({ error }, 'Cookie migration failed');
      throw error;
    }
  }

  /**
   * Parse cookie data from various formats
   */
  private parseCookieData(data: any): LegacyAccount[] {
    const accounts: LegacyAccount[] = [];

    // Handle array of accounts
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item.email && item.cookies) {
          accounts.push({
            email: item.email,
            password: item.password || '',
            cookies: item.cookies,
            metadata: item.metadata
          });
        }
      }
    } 
    // Handle object with email keys
    else if (typeof data === 'object') {
      for (const [email, cookies] of Object.entries(data)) {
        if (Array.isArray(cookies)) {
          accounts.push({
            email,
            password: '',
            cookies: cookies as any[],
            metadata: {}
          });
        }
      }
    }

    return accounts;
  }

  /**
   * Import accounts from JSON file
   */
  async importAccounts(options: MigrationOptions): Promise<MigrationResult> {
    logger.info({ options }, 'Starting account import');

    const result: MigrationResult = {
      total: 0,
      successful: 0,
      failed: 0,
      errors: []
    };

    if (!options.accountsJsonPath || !existsSync(options.accountsJsonPath)) {
      logger.error('Accounts file not found');
      return result;
    }

    try {
      // Read accounts file
      const accountsContent = await readFile(options.accountsJsonPath, 'utf8');
      const accountsData = JSON.parse(accountsContent);

      const accounts = Array.isArray(accountsData) ? accountsData : [accountsData];
      result.total = accounts.length;

      logger.info({ count: accounts.length }, 'Found accounts to import');

      // Validate accounts if required
      if (!options.skipValidation) {
        accounts.forEach(account => {
          if (!account.email || !account.password) {
            throw new Error('Invalid account format: email and password required');
          }
        });
      }

      // Process each account
      for (const account of accounts) {
        try {
          if (options.dryRun) {
            logger.info({ email: account.email }, 'Would import account (dry run)');
            result.successful++;
            continue;
          }

          await this.importAccount(account);
          result.successful++;
          logger.info({ email: account.email }, 'Account imported successfully');

        } catch (error) {
          result.failed++;
          result.errors.push({
            account: account.email || 'unknown',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          logger.error({ account: account.email, error }, 'Failed to import account');
        }
      }

      logger.info({ result }, 'Account import completed');
      return result;

    } catch (error) {
      logger.error({ error }, 'Account import failed');
      throw error;
    }
  }

  /**
   * Import a single account
   */
  private async importAccount(account: LegacyAccount): Promise<void> {
    // Check if account already exists
    const existing = await this.accountManager.listAccounts();
    if (existing.some(a => a.email === account.email)) {
      logger.warn({ email: account.email }, 'Account already exists, updating');
      
      // Update existing account metadata if needed
      const existingAccount = existing.find(a => a.email === account.email)!;
      if (account.metadata) {
        await this.accountManager.updateAccount(existingAccount.id, {
          metadata: { ...existingAccount.metadata, ...account.metadata }
        });
      }
      
      // Store cookies if present
      if (account.cookies) {
        await this.storeCookies(existingAccount.id, account.cookies);
      }
      
      return;
    }

    // Create new account
    const newAccount = await this.accountManager.addAccount(
      account.email,
      account.password,
      account.metadata
    );

    // Store cookies if present
    if (account.cookies) {
      await this.storeCookies(newAccount.id, account.cookies);
    }
  }

  /**
   * Store cookies for account
   */
  private async storeCookies(accountId: string, cookies: any[]): Promise<void> {
    try {
      const encryptedCookies = await this.encryptionService.encrypt(
        JSON.stringify(cookies)
      );

      await this.db.query(
        `INSERT INTO account_cookies (account_id, encrypted_cookies)
         VALUES ($1, $2)
         ON CONFLICT (account_id) DO UPDATE
         SET encrypted_cookies = $2,
             updated_at = CURRENT_TIMESTAMP`,
        [accountId, JSON.stringify(encryptedCookies)]
      );

      logger.debug({ accountId, cookieCount: cookies.length }, 'Cookies stored');

    } catch (error) {
      logger.error({ accountId, error }, 'Failed to store cookies');
      throw error;
    }
  }

  /**
   * Create backward compatibility layer
   */
  async createCompatibilityLayer(): Promise<void> {
    logger.info('Creating backward compatibility layer');

    try {
      // Create wrapper function that maps old upload signature to new
      const wrapperCode = `
// Backward compatibility wrapper for youtube-uploader
const { MatrixManager } = require('./dist/matrix/manager');
const matrixManager = new MatrixManager();

// Initialize on first use
let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    await matrixManager.initialize();
    initialized = true;
  }
}

// Original upload function signature
async function upload(credentials, videos, options) {
  await ensureInitialized();
  
  // Convert to matrix upload
  const results = await matrixManager.upload(credentials, videos, options);
  
  // Return in original format
  return results.map(r => ({
    link: r.videoId,
    title: videos.find(v => v.path === r.taskId)?.title || '',
    success: r.status === 'completed'
  }));
}

// Export compatibility layer
module.exports = { upload };
`;

      // Write compatibility layer
      await writeFile(
        join(process.cwd(), 'compatibility.js'),
        wrapperCode
      );

      logger.info('Compatibility layer created at compatibility.js');

    } catch (error) {
      logger.error({ error }, 'Failed to create compatibility layer');
      throw error;
    }
  }

  /**
   * Generate migration report
   */
  async generateReport(results: MigrationResult[]): Promise<string> {
    const report = {
      timestamp: new Date(),
      summary: {
        totalAccounts: results.reduce((sum, r) => sum + r.total, 0),
        successfulMigrations: results.reduce((sum, r) => sum + r.successful, 0),
        failedMigrations: results.reduce((sum, r) => sum + r.failed, 0)
      },
      details: results,
      recommendations: [] as string[]
    };

    // Add recommendations
    if (report.summary.failedMigrations > 0) {
      report.recommendations.push(
        'Review failed migrations and fix data issues',
        'Run validation on imported accounts',
        'Consider manual review for failed accounts'
      );
    }

    const reportPath = join(process.cwd(), `migration-report-${Date.now()}.json`);
    await writeFile(reportPath, JSON.stringify(report, null, 2));

    logger.info({ path: reportPath }, 'Migration report generated');
    return reportPath;
  }

  /**
   * Create rollback procedure
   */
  async createRollbackProcedure(): Promise<void> {
    logger.info('Creating rollback procedure');

    const rollbackScript = `
#!/bin/bash
# Rollback procedure for YouTube Matrix Upload migration

echo "Starting rollback procedure..."

# Backup current state
pg_dump -h localhost -U postgres youtube_uploader > rollback_backup_$(date +%s).sql

# Restore from pre-migration backup
if [ -f "$1" ]; then
  psql -h localhost -U postgres youtube_uploader < "$1"
  echo "Database restored from backup: $1"
else
  echo "Error: Backup file not found: $1"
  exit 1
fi

# Clear Redis cache
redis-cli FLUSHDB

# Remove new configuration files
rm -f config/matrix.json
rm -f compatibility.js

echo "Rollback completed"
echo "Please restart the application"
`;

    await writeFile(
      join(process.cwd(), 'rollback.sh'),
      rollbackScript,
      { mode: 0o755 }
    );

    logger.info('Rollback procedure created at rollback.sh');
  }

  /**
   * Validate migration
   */
  async validateMigration(): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    logger.info('Validating migration');

    const issues: string[] = [];

    try {
      // Check database connectivity
      await this.db.query('SELECT 1');

      // Check accounts
      const accounts = await this.accountManager.listAccounts();
      if (accounts.length === 0) {
        issues.push('No accounts found after migration');
      }

      // Check for accounts with missing credentials
      for (const account of accounts) {
        if (!account.credentials || !account.credentials.encryptedPassword) {
          issues.push(`Account ${account.email} missing encrypted credentials`);
        }
      }

      // Check Redis connectivity
      const redis = await import('../redis/connection');
      await redis.getRedis().getClient().ping();

      // Check for orphaned data
      const orphanedResult = await this.db.query(`
        SELECT COUNT(*) as count 
        FROM account_cookies ac
        LEFT JOIN accounts a ON ac.account_id = a.id
        WHERE a.id IS NULL
      `);

      if (orphanedResult.rows[0].count > 0) {
        issues.push(`Found ${orphanedResult.rows[0].count} orphaned cookie entries`);
      }

      logger.info({ issues }, 'Migration validation completed');

      return {
        valid: issues.length === 0,
        issues
      };

    } catch (error) {
      logger.error({ error }, 'Migration validation failed');
      issues.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown'}`);
      return { valid: false, issues };
    }
  }
}

/**
 * CLI migration script
 */
export async function runMigration(options: MigrationOptions): Promise<void> {
  const migration = new MigrationUtility();
  const results: MigrationResult[] = [];

  try {
    // Run migrations
    if (options.cookiesPath) {
      const cookieResult = await migration.migrateCookies(options);
      results.push(cookieResult);
    }

    if (options.accountsJsonPath) {
      const accountResult = await migration.importAccounts(options);
      results.push(accountResult);
    }

    // Create compatibility layer
    if (!options.dryRun) {
      await migration.createCompatibilityLayer();
      await migration.createRollbackProcedure();
    }

    // Generate report
    const reportPath = await migration.generateReport(results);
    logger.info({ reportPath }, 'Migration completed');

    // Validate
    if (!options.dryRun) {
      const validation = await migration.validateMigration();
      if (!validation.valid) {
        logger.warn({ issues: validation.issues }, 'Migration validation found issues');
      }
    }

  } catch (error) {
    logger.error({ error }, 'Migration failed');
    throw error;
  }
}