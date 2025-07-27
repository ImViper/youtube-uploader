import { getDatabase, DatabaseConnection } from '../database/connection';
import bcrypt from 'bcrypt';
import pino from 'pino';
import { Credentials } from '../types';
import { getErrorMessage } from '../utils/error-utils';
import { getBitBrowserClient } from '../bitbrowser/client';

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
  proxy?: {
    host: string;
    port: number;
  };
  // Browser window mapping fields
  bitbrowserWindowId?: string;
  bitbrowserWindowName?: string;
  isWindowLoggedIn?: boolean;
}

export interface AccountFilter {
  status?: AccountProfile['status'];
  minHealthScore?: number;
  hasAvailableUploads?: boolean;
}

export class AccountManager {
  private db: DatabaseConnection;
  private encryptionSaltRounds = 10;

  constructor() {
    this.db = getDatabase();
  }

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

      // Handle browser window mapping if provided
      let bitbrowserWindowId: string | null = null;
      let bitbrowserWindowName: string | null = null;
      let isWindowLoggedIn = false;

      logger.info({ metadata }, 'Received metadata in addAccount');
      
      if (metadata?.browserWindowName) {
        const windowName = metadata.browserWindowName;
        bitbrowserWindowName = windowName;
        
        // Try to find the window ID automatically
        // This would normally call the BitBrowser API
        // For now, we'll generate a placeholder ID
        const foundWindowId = await this.findBitBrowserWindowId(windowName);
        
        if (foundWindowId && foundWindowId !== '') {
          bitbrowserWindowId = foundWindowId;
          
          // Check if the window is logged in
          // This would normally check with BitBrowser
          isWindowLoggedIn = await this.checkWindowLoginStatus(foundWindowId);
        }
        
        logger.info({ 
          email, 
          windowName: bitbrowserWindowName, 
          windowId: bitbrowserWindowId,
          isLoggedIn: isWindowLoggedIn 
        }, 'Browser window mapping configured');
      } else {
        logger.warn({ metadata }, 'No browserWindowName in metadata');
      }

      // Insert into database
      const result = await this.db.query<AccountProfile>(
        `INSERT INTO accounts (
          email, 
          encrypted_credentials, 
          browser_profile_id, 
          metadata,
          bitbrowser_window_id,
          bitbrowser_window_name,
          is_window_logged_in
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          email,
          JSON.stringify({ email, encryptedPassword }),
          browserProfileId,
          JSON.stringify(metadata || {}),
          bitbrowserWindowId,
          bitbrowserWindowName,
          isWindowLoggedIn
        ]
      );

      const account = this.mapDatabaseRow(result.rows[0]);
      logger.info({ accountId: account.id, email }, 'Account added successfully');
      
      return account;

    } catch (error: any) {
      if (error?.code === '23505') { // Unique constraint violation
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
         AND bitbrowser_window_id IS NOT NULL
         AND is_window_logged_in = true
         ORDER BY health_score DESC, daily_upload_count ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`
      );

      if (result.rows.length === 0) {
        logger.warn('No healthy accounts available with logged-in browser windows');
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
    try {
      // Handle credentials parsing
      let credentials;
      try {
        credentials = typeof row.encrypted_credentials === 'string' 
          ? JSON.parse(row.encrypted_credentials) 
          : row.encrypted_credentials;
      } catch (e) {
        logger.warn({ 
          id: row.id, 
          email: row.email,
          error: e 
        }, 'Failed to parse encrypted_credentials, using default');
        credentials = { email: row.email, password: '' };
      }

      const account: AccountProfile = {
        id: row.id,
        email: row.email,
        credentials: credentials,
        browserProfileId: row.browser_profile_id,
        status: row.status,
        dailyUploadCount: row.daily_upload_count || 0,
        dailyUploadLimit: row.daily_upload_limit || 10,
        lastUploadTime: row.last_upload_time,
        healthScore: row.health_score || 100,
        metadata: row.metadata || {},
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        // Map browser window fields
        bitbrowserWindowId: row.bitbrowser_window_id,
        bitbrowserWindowName: row.bitbrowser_window_name,
        isWindowLoggedIn: row.is_window_logged_in,
      };
      
      // Add proxy if it exists in metadata
      if (row.metadata?.proxy) {
        account.proxy = row.metadata.proxy;
      }
      
      return account;
    } catch (error: any) {
      logger.error({ 
        row: {
          id: row?.id,
          email: row?.email,
          hasCredentials: !!row?.encrypted_credentials
        }, 
        error: error.message,
        stack: error.stack
      }, 'Failed to map database row to AccountProfile');
      throw error;
    }
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

  /**
   * Test account functionality (e.g., YouTube login)
   * This is a placeholder for actual implementation
   */
  async testAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const account = await this.getAccount(accountId);
      
      if (!account) {
        return { success: false, error: 'Account not found' };
      }

      // In production, this would actually test YouTube login
      // For now, we'll simulate based on account health
      if (account.status === 'error' || account.status === 'suspended') {
        return { success: false, error: `Account is ${account.status}` };
      }

      if (account.healthScore < 30) {
        return { success: false, error: 'Account health too low' };
      }

      // Simulate successful test
      logger.info({ accountId }, 'Account test successful');
      return { success: true };

    } catch (error) {
      logger.error({ accountId, error }, 'Failed to test account');
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Update account's browser window mapping
   */
  async updateAccountBrowserMapping(
    email: string,
    windowId: string,
    windowName: string,
    isLoggedIn: boolean = false
  ): Promise<void> {
    logger.info({ email, windowId, windowName }, 'Updating account browser mapping');

    try {
      await this.db.query(
        `UPDATE accounts 
         SET bitbrowser_window_id = $1, 
             bitbrowser_window_name = $2,
             is_window_logged_in = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE email = $4`,
        [windowId, windowName, isLoggedIn, email]
      );

      logger.info({ email, windowId }, 'Account browser mapping updated');
    } catch (error) {
      logger.error({ email, windowId, error }, 'Failed to update browser mapping');
      throw error;
    }
  }

  /**
   * Get account by email
   */
  async getAccountByEmail(email: string): Promise<AccountProfile | null> {
    try {
      const result = await this.db.query<AccountProfile>(
        'SELECT * FROM accounts WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDatabaseRow(result.rows[0]);
    } catch (error) {
      logger.error({ email, error }, 'Failed to get account by email');
      throw error;
    }
  }

  /**
   * Get account by browser window ID
   */
  async getAccountByWindowId(windowId: string): Promise<AccountProfile | null> {
    try {
      const result = await this.db.query<AccountProfile>(
        'SELECT * FROM accounts WHERE bitbrowser_window_id = $1',
        [windowId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDatabaseRow(result.rows[0]);
    } catch (error) {
      logger.error({ windowId, error }, 'Failed to get account by window ID');
      throw error;
    }
  }

  /**
   * Update window login status
   */
  async updateWindowLoginStatus(accountId: string, isLoggedIn: boolean): Promise<void> {
    try {
      await this.db.query(
        'UPDATE accounts SET is_window_logged_in = $1 WHERE id = $2',
        [isLoggedIn, accountId]
      );
      
      logger.info({ accountId, isLoggedIn }, 'Window login status updated');
    } catch (error) {
      logger.error({ accountId, error }, 'Failed to update window login status');
      throw error;
    }
  }

  /**
   * Find BitBrowser window ID by name
   */
  private async findBitBrowserWindowId(windowName: string): Promise<string> {
    try {
      const bitBrowserClient = getBitBrowserClient();
      
      // Check if BitBrowser API is available
      const isAvailable = await bitBrowserClient.isAvailable();
      if (!isAvailable) {
        logger.warn('BitBrowser API is not available, using fallback');
        // Fallback: use the window name as ID
        return windowName;
      }
      
      // Get window ID by name
      const windowId = await bitBrowserClient.getWindowIdByName(windowName);
      if (windowId) {
        logger.info({ windowName, windowId }, 'Found window ID by name');
        return windowId;
      }
      
      // Find window by name
      const window = await bitBrowserClient.findWindowByName(windowName);
      
      if (!window) {
        logger.warn({ windowName }, 'Window not found in BitBrowser');
        return '';
      }
      
      logger.info({ windowName, windowId: window.id }, 'Found BitBrowser window');
      return window.id;
      
    } catch (error) {
      logger.error({ windowName, error }, 'Failed to find BitBrowser window ID');
      // Return empty string on error
      return '';
    }
  }

  /**
   * Check if a BitBrowser window is logged in to YouTube
   * Note: Actual login verification would require browser automation
   */
  private async checkWindowLoginStatus(windowId: string): Promise<boolean> {
    try {
      const bitBrowserClient = getBitBrowserClient();
      
      // Check if BitBrowser API is available
      const isAvailable = await bitBrowserClient.isAvailable();
      if (!isAvailable) {
        logger.warn('BitBrowser API is not available for login check');
        return false;
      }
      
      // Get window details to check if it exists and is accessible
      const windowDetail = await bitBrowserClient.getWindow(windowId);
      
      if (!windowDetail) {
        logger.warn({ windowId }, 'Window not found for login check');
        return false;
      }
      
      // Note: Actual login verification would require:
      // 1. Opening the window with Playwright/Puppeteer
      // 2. Navigating to YouTube
      // 3. Checking for login indicators (avatar, account menu, etc.)
      // For now, we assume windows need manual login verification
      
      logger.info({ windowId, windowName: windowDetail.name }, 'Window exists, login status needs manual verification');
      return false;
      
    } catch (error) {
      logger.error({ windowId, error }, 'Failed to check window login status');
      return false;
    }
  }

  /**
   * List accounts with window mapping
   */
  async listAccountsWithWindowMapping(): Promise<any[]> {
    try {
      const result = await this.db.query(
        `SELECT 
          a.id,
          a.email,
          a.status,
          a.health_score,
          a.bitbrowser_window_id,
          a.bitbrowser_window_name,
          a.is_window_logged_in,
          a.daily_upload_count,
          a.daily_upload_limit
        FROM accounts a
        WHERE a.bitbrowser_window_id IS NOT NULL
        ORDER BY a.email`
      );

      return result.rows.map(row => this.mapDatabaseRow(row));
    } catch (error) {
      logger.error({ error }, 'Failed to list accounts with window mapping');
      throw error;
    }
  }

  /**
   * Verify and sync BitBrowser windows
   * This can be called periodically to sync window status
   */
  async syncBitBrowserWindows(): Promise<void> {
    try {
      const bitBrowserClient = getBitBrowserClient();
      
      // Check if BitBrowser API is available
      const isAvailable = await bitBrowserClient.isAvailable();
      if (!isAvailable) {
        logger.warn('BitBrowser API is not available for sync');
        return;
      }
      
      // Get all accounts with window mapping
      const accounts = await this.listAccountsWithWindowMapping();
      const allWindows = await bitBrowserClient.listWindows();
      const windowMap = new Map(allWindows.map(w => [w.id, w]));
      
      for (const account of accounts) {
        if (!account.bitbrowserWindowId) continue;
        
        const windowExists = windowMap.has(account.bitbrowserWindowId);
        
        if (!windowExists) {
          // Window no longer exists in BitBrowser
          logger.warn({ 
            accountId: account.id, 
            windowId: account.bitbrowserWindowId,
            windowName: account.bitbrowserWindowName 
          }, 'Window no longer exists in BitBrowser');
          
          // Clear window mapping
          await this.db.query(
            `UPDATE accounts 
             SET bitbrowser_window_id = NULL,
                 is_window_logged_in = false
             WHERE id = $1`,
            [account.id]
          );
        }
      }
      
      logger.info('BitBrowser windows sync completed');
      
    } catch (error) {
      logger.error({ error }, 'Failed to sync BitBrowser windows');
      throw error;
    }
  }

}