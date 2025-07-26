import { getDatabase } from '../database/connection';
import bcrypt from 'bcrypt';
import pino from 'pino';
import { Credentials } from '../types';

const logger = pino({
  name: 'account-manager',
  level: process.env.LOG_LEVEL || 'info'
});

export interface EncryptedCredentials {
  email: string;
  encryptedPassword: string;
  recoveryEmail?: string;
}

export interface AccountProfile {
  id: string;
  email: string;
  credentials: EncryptedCredentials;
  browserProfileId: string;
  status: 'active' | 'limited' | 'suspended' | 'error';
  dailyUploadCount: number;
  dailyUploadLimit: number;
  lastUploadTime?: Date;
  healthScore: number;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AccountFilter {
  status?: AccountProfile['status'];
  minHealthScore?: number;
  hasAvailableUploads?: boolean;
}

export class AccountManager {
  private db = getDatabase();
  private encryptionSaltRounds = 10;

  /**
   * Add a new account
   */
  async addAccount(email: string, password: string, metadata?: Record<string, any>): Promise<AccountProfile> {
    logger.info({ email }, 'Adding new account');

    try {
      // Encrypt password
      const encryptedPassword = await bcrypt.hash(password, this.encryptionSaltRounds);
      
      // Generate browser profile ID
      const browserProfileId = `profile-${email.replace('@', '-at-')}-${Date.now()}`;

      // Insert into database
      const result = await this.db.query<AccountProfile>(
        `INSERT INTO accounts (email, encrypted_credentials, browser_profile_id, metadata)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          email,
          JSON.stringify({ email, encryptedPassword }),
          browserProfileId,
          JSON.stringify(metadata || {})
        ]
      );

      const account = this.mapDatabaseRow(result.rows[0]);
      logger.info({ accountId: account.id, email }, 'Account added successfully');
      
      return account;

    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error(`Account with email ${email} already exists`);
      }
      logger.error({ email, error }, 'Failed to add account');
      throw error;
    }
  }

  /**
   * Update account information
   */
  async updateAccount(accountId: string, updates: Partial<AccountProfile>): Promise<void> {
    logger.info({ accountId, updates }, 'Updating account');

    const allowedFields = ['status', 'daily_upload_limit', 'health_score', 'metadata'];
    const updateClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build update query dynamically
    if (updates.status) {
      updateClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.dailyUploadLimit !== undefined) {
      updateClauses.push(`daily_upload_limit = $${paramIndex++}`);
      values.push(updates.dailyUploadLimit);
    }
    if (updates.healthScore !== undefined) {
      updateClauses.push(`health_score = $${paramIndex++}`);
      values.push(updates.healthScore);
    }
    if (updates.metadata) {
      updateClauses.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    if (updateClauses.length === 0) {
      logger.warn({ accountId }, 'No valid fields to update');
      return;
    }

    values.push(accountId);
    const query = `UPDATE accounts SET ${updateClauses.join(', ')} WHERE id = $${paramIndex}`;

    try {
      await this.db.query(query, values);
      logger.info({ accountId }, 'Account updated successfully');
    } catch (error) {
      logger.error({ accountId, error }, 'Failed to update account');
      throw error;
    }
  }

  /**
   * Remove an account
   */
  async removeAccount(accountId: string): Promise<void> {
    logger.info({ accountId }, 'Removing account');

    try {
      await this.db.query('DELETE FROM accounts WHERE id = $1', [accountId]);
      logger.info({ accountId }, 'Account removed successfully');
    } catch (error) {
      logger.error({ accountId, error }, 'Failed to remove account');
      throw error;
    }
  }

  /**
   * Get account by ID
   */
  async getAccount(accountId: string): Promise<AccountProfile | null> {
    try {
      const result = await this.db.query<AccountProfile>(
        'SELECT * FROM accounts WHERE id = $1',
        [accountId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDatabaseRow(result.rows[0]);

    } catch (error) {
      logger.error({ accountId, error }, 'Failed to get account');
      throw error;
    }
  }

  /**
   * List accounts with optional filtering
   */
  async listAccounts(filter?: AccountFilter): Promise<AccountProfile[]> {
    try {
      let query = 'SELECT * FROM accounts WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filter?.status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(filter.status);
      }

      if (filter?.minHealthScore !== undefined) {
        query += ` AND health_score >= $${paramIndex++}`;
        params.push(filter.minHealthScore);
      }

      if (filter?.hasAvailableUploads) {
        query += ` AND daily_upload_count < daily_upload_limit`;
      }

      query += ' ORDER BY health_score DESC, daily_upload_count ASC';

      const result = await this.db.query<AccountProfile>(query, params);
      return result.rows.map(row => this.mapDatabaseRow(row));

    } catch (error) {
      logger.error({ filter, error }, 'Failed to list accounts');
      throw error;
    }
  }

  /**
   * Get a healthy account for upload
   */
  async getHealthyAccount(): Promise<AccountProfile | null> {
    logger.debug('Getting healthy account for upload');

    try {
      const result = await this.db.query<AccountProfile>(
        `SELECT * FROM accounts 
         WHERE status = 'active' 
         AND daily_upload_count < daily_upload_limit
         AND health_score >= 70
         ORDER BY health_score DESC, daily_upload_count ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`
      );

      if (result.rows.length === 0) {
        logger.warn('No healthy accounts available');
        return null;
      }

      return this.mapDatabaseRow(result.rows[0]);

    } catch (error) {
      logger.error({ error }, 'Failed to get healthy account');
      throw error;
    }
  }

  /**
   * Assign account to browser
   */
  async assignAccountToBrowser(accountId: string, browserId: string): Promise<void> {
    logger.info({ accountId, browserId }, 'Assigning account to browser');

    try {
      await this.db.transaction(async (client) => {
        // Update browser instance
        await client.query(
          'UPDATE browser_instances SET account_id = $1 WHERE id = $2',
          [accountId, browserId]
        );

        // Update account last activity
        await client.query(
          'UPDATE accounts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
          [accountId]
        );
      });

      logger.info({ accountId, browserId }, 'Account assigned successfully');

    } catch (error) {
      logger.error({ accountId, browserId, error }, 'Failed to assign account');
      throw error;
    }
  }

  /**
   * Release account from browser
   */
  async releaseAccount(accountId: string): Promise<void> {
    logger.info({ accountId }, 'Releasing account');

    try {
      await this.db.query(
        'UPDATE browser_instances SET account_id = NULL WHERE account_id = $1',
        [accountId]
      );

      logger.info({ accountId }, 'Account released successfully');

    } catch (error) {
      logger.error({ accountId, error }, 'Failed to release account');
      throw error;
    }
  }

  /**
   * Update account health based on upload result
   */
  async updateAccountHealth(accountId: string, success: boolean): Promise<void> {
    logger.debug({ accountId, success }, 'Updating account health');

    try {
      await this.db.transaction(async (client) => {
        // Get current account data
        const result = await client.query(
          'SELECT health_score, daily_upload_count FROM accounts WHERE id = $1',
          [accountId]
        );

        if (result.rows.length === 0) {
          throw new Error('Account not found');
        }

        const currentHealth = result.rows[0].health_score;
        const currentUploads = result.rows[0].daily_upload_count;

        // Calculate new health score
        let newHealth = currentHealth;
        if (success) {
          // Increase health by 2 points for success (max 100)
          newHealth = Math.min(100, currentHealth + 2);
        } else {
          // Decrease health by 10 points for failure (min 0)
          newHealth = Math.max(0, currentHealth - 10);
        }

        // Update account
        await client.query(
          `UPDATE accounts 
           SET health_score = $1, 
               daily_upload_count = $2,
               last_upload_time = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [newHealth, currentUploads + 1, accountId]
        );

        // Check if account should be suspended
        if (newHealth < 30) {
          await client.query(
            'UPDATE accounts SET status = $1 WHERE id = $2',
            ['suspended', accountId]
          );
          logger.warn({ accountId, healthScore: newHealth }, 'Account suspended due to low health');
        }
      });

      logger.info({ accountId, success }, 'Account health updated');

    } catch (error) {
      logger.error({ accountId, error }, 'Failed to update account health');
      throw error;
    }
  }

  /**
   * Reset daily upload counts for all accounts
   */
  async resetDailyLimits(): Promise<void> {
    logger.info('Resetting daily upload limits');

    try {
      const result = await this.db.query(
        'UPDATE accounts SET daily_upload_count = 0 RETURNING id'
      );

      logger.info({ count: result.rowCount }, 'Daily limits reset');

    } catch (error) {
      logger.error({ error }, 'Failed to reset daily limits');
      throw error;
    }
  }

  /**
   * Get account credentials (decrypted)
   */
  async getAccountCredentials(accountId: string): Promise<Credentials | null> {
    try {
      const account = await this.getAccount(accountId);
      if (!account) {
        return null;
      }

      // Note: In production, you'd decrypt the password here
      // For now, we'll return a placeholder
      return {
        email: account.email,
        pass: '', // This should be decrypted
        recoveryemail: account.credentials.recoveryEmail
      };

    } catch (error) {
      logger.error({ accountId, error }, 'Failed to get account credentials');
      throw error;
    }
  }

  /**
   * Map database row to AccountProfile
   */
  private mapDatabaseRow(row: any): AccountProfile {
    return {
      id: row.id,
      email: row.email,
      credentials: JSON.parse(row.encrypted_credentials),
      browserProfileId: row.browser_profile_id,
      status: row.status,
      dailyUploadCount: row.daily_upload_count,
      dailyUploadLimit: row.daily_upload_limit,
      lastUploadTime: row.last_upload_time,
      healthScore: row.health_score,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get account statistics
   */
  async getAccountStats() {
    try {
      const result = await this.db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'limited') as limited,
          COUNT(*) FILTER (WHERE status = 'suspended') as suspended,
          COUNT(*) FILTER (WHERE status = 'error') as error,
          AVG(health_score) as avg_health,
          SUM(daily_upload_count) as total_uploads_today
        FROM accounts
      `);

      return result.rows[0];

    } catch (error) {
      logger.error({ error }, 'Failed to get account stats');
      throw error;
    }
  }
}