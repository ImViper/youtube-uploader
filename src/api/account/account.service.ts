import { AccountManager, AccountProfile } from '../../accounts/manager';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

const logger = pino({
  name: 'account-service',
  level: process.env.LOG_LEVEL || 'info'
});

interface AccountFilter {
  status?: 'active' | 'suspended' | 'limited' | 'error' | 'all';
  minHealthScore?: number;
  hasAvailableUploads?: boolean;
  tags?: string[];
}

interface PaginationOptions extends AccountFilter {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

interface ExportOptions {
  format: 'csv' | 'json';
  ids?: string[];
  includePasswords: boolean;
}

interface ImportData {
  format: 'csv' | 'json';
  data?: string;
  accounts?: any[];
}

export class AccountService {
  constructor(private accountManager: AccountManager) {}

  /**
   * Create a new account
   */
  async create(accountData: any) {
    try {
      logger.info({ accountData }, 'Creating account with data');
      
      // Check if account already exists
      const existingAccounts = await this.accountManager.listAccounts({});
      const exists = existingAccounts.some(acc => acc.email === accountData.email);
      
      if (exists) {
        throw new Error('Account already exists');
      }

      const account = await this.accountManager.addAccount(
        accountData.email,
        accountData.password,
        {
          proxy: accountData.proxy,
          dailyUploadLimit: accountData.dailyUploadLimit,
          bitbrowser_window_name: accountData.browserWindowName || accountData.bitbrowser_window_name,
          ...accountData.metadata
        }
      );

      // Sanitize sensitive data
      return this.sanitizeAccount(account);
    } catch (error) {
      logger.error({ error }, 'Failed to create account');
      throw error;
    }
  }

  /**
   * Find all accounts with pagination and filtering
   */
  async findAll(options: PaginationOptions) {
    try {
      logger.info({ options }, 'Finding accounts with options');
      
      let accounts = await this.accountManager.listAccounts({
        status: options.status === 'all' ? undefined : options.status,
        minHealthScore: options.minHealthScore,
        hasAvailableUploads: options.hasAvailableUploads
      });
      
      logger.info({ accountCount: accounts.length }, 'Retrieved accounts from manager');

      // Apply search filter
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        accounts = accounts.filter(account => 
          account.email.toLowerCase().includes(searchLower)
        );
      }

      // Apply tag filter
      if (options.tags && options.tags.length > 0) {
        accounts = accounts.filter(account => {
          const accountTags = account.metadata?.tags || [];
          return options.tags!.some(tag => accountTags.includes(tag));
        });
      }

      // Apply sorting
      const sortBy = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder || 'desc';
      
      accounts.sort((a, b) => {
        let aVal: any = a[sortBy as keyof typeof a];
        let bVal: any = b[sortBy as keyof typeof b];

        if (sortBy === 'lastActive') {
          aVal = a.lastUploadTime || 0;
          bVal = b.lastUploadTime || 0;
        }

        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });

      // Apply pagination with default values if needed
      const page = options.page || 1;
      const pageSize = options.pageSize || 20;
      const total = accounts.length;
      const totalPages = Math.ceil(total / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedItems = accounts.slice(startIndex, endIndex);

      return {
        items: paginatedItems.map(acc => this.sanitizeAccount(acc)),
        page: page,
        pageSize: pageSize,
        total,
        totalPages
      };
    } catch (error: any) {
      logger.error({ 
        error: error.message,
        stack: error.stack,
        options
      }, 'Failed to find accounts');
      throw error;
    }
  }

  /**
   * Find account by ID
   */
  async findById(id: string) {
    try {
      const account = await this.accountManager.getAccount(id);
      return account ? this.sanitizeAccount(account) : undefined;
    } catch (error) {
      logger.error({ error }, 'Failed to find account');
      throw error;
    }
  }

  /**
   * Update account
   */
  async update(id: string, updates: any) {
    try {
      // Convert frontend field names to backend field names
      const mappedUpdates = { ...updates };
      
      // Map browserWindowName to bitbrowser_window_name
      if (updates.browserWindowName !== undefined) {
        mappedUpdates.bitbrowser_window_name = updates.browserWindowName;
        delete mappedUpdates.browserWindowName;
      }
      
      // Handle notes - if it's at root level, move it to metadata
      if (updates.notes !== undefined) {
        if (!mappedUpdates.metadata) {
          mappedUpdates.metadata = {};
        }
        mappedUpdates.metadata.notes = updates.notes;
        delete mappedUpdates.notes;
      }
      
      // Log for debugging
      logger.info({ 
        id, 
        originalUpdates: updates, 
        mappedUpdates 
      }, 'Account update request');
      
      await this.accountManager.updateAccount(id, mappedUpdates);
      const account = await this.accountManager.getAccount(id);
      return account ? this.sanitizeAccount(account) : undefined;
    } catch (error) {
      logger.error({ error }, 'Failed to update account');
      throw error;
    }
  }

  /**
   * Delete account
   */
  async delete(id: string) {
    try {
      await this.accountManager.removeAccount(id);
      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to delete account');
      if (error instanceof Error && error.message.includes('not found')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Batch delete accounts
   */
  async batchDelete(ids: string[]) {
    const results = {
      deletedCount: 0,
      errors: [] as any[]
    };

    for (const id of ids) {
      try {
        await this.accountManager.removeAccount(id);
        results.deletedCount++;
      } catch (error) {
        results.errors.push({ 
          id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return results;
  }

  /**
   * Import accounts
   */
  async import(importData: ImportData) {
    const results = {
      imported: 0,
      failed: 0,
      errors: [] as any[]
    };

    let accountsToImport: any[] = [];

    // Parse data based on format
    if (importData.format === 'json') {
      if (importData.accounts) {
        accountsToImport = importData.accounts;
      } else if (importData.data) {
        try {
          const parsed = JSON.parse(importData.data);
          accountsToImport = Array.isArray(parsed) ? parsed : [parsed];
        } catch (error) {
          throw new Error('Invalid JSON format');
        }
      }
    } else if (importData.format === 'csv' && importData.data) {
      accountsToImport = this.parseCSV(importData.data);
    }

    // Import accounts
    for (let i = 0; i < accountsToImport.length; i++) {
      const accountData = accountsToImport[i];
      
      try {
        await this.create(accountData);
        results.imported++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Export accounts
   */
  async export(options: ExportOptions) {
    let accounts = await this.accountManager.listAccounts({});

    // Filter by IDs if provided
    if (options.ids && options.ids.length > 0) {
      accounts = accounts.filter(account => options.ids!.includes(account.id));
    }

    // Prepare export data
    const exportData = accounts.map(account => {
      const accountData = account as any;
      return {
        id: account.id,
        email: account.email,
        password: options.includePasswords && accountData.password ? accountData.password : '***',
        status: account.status,
        healthScore: account.healthScore,
        dailyUploadLimit: account.dailyUploadLimit,
        proxy: accountData.proxy ? `${accountData.proxy.host}:${accountData.proxy.port}` : '',
        notes: account.metadata?.notes || '',
        tags: account.metadata?.tags?.join(',') || ''
      };
    });

    if (options.format === 'csv') {
      return this.generateCSV(exportData);
    } else {
      return exportData;
    }
  }

  /**
   * Health check account
   */
  async healthCheck(id: string) {
    try {
      const account = await this.accountManager.getAccount(id);
      if (!account) {
        return undefined;
      }

      // Perform health check (in production, this would actually check YouTube)
      const health = {
        accountId: id,
        status: account.status,
        healthScore: account.healthScore,
        lastActive: account.lastUploadTime,
        dailyUploads: {
          used: account.dailyUploadCount,
          limit: account.dailyUploadLimit,
          remaining: account.dailyUploadLimit - account.dailyUploadCount
        },
        checks: {
          loginStatus: account.status === 'active',
          quotaAvailable: account.dailyUploadCount < account.dailyUploadLimit,
          proxyWorking: true, // Would check proxy in production
          lastError: account.metadata?.lastError
        }
      };

      return health;
    } catch (error) {
      logger.error({ error }, 'Failed to perform health check');
      throw error;
    }
  }

  /**
   * Test account
   */
  async testAccount(id: string) {
    try {
      // Check if account exists
      const account = await this.accountManager.getAccount(id);
      if (!account) {
        throw new Error('Account not found');
      }

      // In a real implementation, this would test the account login
      // For now, we'll return a mock result based on account status
      const result = {
        success: account.status === 'active',
        message: account.status === 'active' 
          ? 'Account tested successfully' 
          : `Account test failed: status is ${account.status}`,
        details: {
          loginSuccessful: account.status === 'active',
          canUpload: account.status === 'active' && account.dailyUploadCount < account.dailyUploadLimit,
          proxyWorking: true, // Would test proxy in real implementation
          healthScore: account.healthScore,
          dailyUploadsRemaining: account.dailyUploadLimit - account.dailyUploadCount,
        },
      };

      return result;
    } catch (error) {
      logger.error({ error }, 'Failed to test account');
      throw error;
    }
  }

  /**
   * Get account statistics
   */
  async getStats() {
    try {
      return await this.accountManager.getAccountStats();
    } catch (error) {
      logger.error({ error }, 'Failed to get account stats');
      throw error;
    }
  }

  /**
   * Reset daily limits
   */
  async resetDailyLimits() {
    try {
      await this.accountManager.resetDailyLimits();
    } catch (error) {
      logger.error({ error }, 'Failed to reset daily limits');
      throw error;
    }
  }

  /**
   * Update account status
   */
  async updateStatus(id: string, status: string) {
    try {
      const validStatus = status as AccountProfile['status'];
      await this.accountManager.updateAccount(id, { status: validStatus });
      const account = await this.accountManager.getAccount(id);
      return account ? this.sanitizeAccount(account) : undefined;
    } catch (error) {
      logger.error({ error }, 'Failed to update account status');
      throw error;
    }
  }

  /**
   * Calculate success rate based on account upload history
   */
  private calculateSuccessRate(account: any): number {
    // If we have success/failure metrics in metadata, use them
    if (account.metadata?.uploadStats) {
      const stats = account.metadata.uploadStats;
      const total = (stats.success || 0) + (stats.failed || 0);
      if (total > 0) {
        return Math.round((stats.success / total) * 100);
      }
    }
    
    // Default to health score as a proxy for success rate
    return account.healthScore || 100;
  }

  /**
   * Sanitize account data to remove sensitive information
   */
  private sanitizeAccount(account: any) {
    try {
      // Calculate success rate based on historical data if available
      const successRate = this.calculateSuccessRate(account);
      
      const sanitized = {
        id: account.id,
        username: account.email ? account.email.split('@')[0] : 'unknown',
        email: account.email || '',
        status: account.status || 'active',
        healthScore: account.healthScore || 100,
        dailyUploadCount: account.dailyUploadCount || 0,
        dailyUploadLimit: account.dailyUploadLimit || 10,
        uploadsCount: account.dailyUploadCount || 0, // Map to frontend expected field
        successRate: successRate,
        lastActive: account.lastUploadTime || null,
        createdAt: account.createdAt || new Date().toISOString(),
        browserWindowName: account.bitbrowser_window_name || null,
        browserWindowId: account.browser_profile_id || null, // Add browser window ID
        isWindowLoggedIn: account.metadata?.isWindowLoggedIn || false, // Add login status
        proxy: undefined as any,
        metadata: {
          notes: account.metadata?.notes || '',
          tags: account.metadata?.tags || []
        },
        notes: account.metadata?.notes || '' // Also expose notes at root level for frontend
      };
      
      // Safely add proxy if it exists (could be in root or metadata)
      const proxyData = account.proxy || account.metadata?.proxy;
      if (proxyData && typeof proxyData === 'object') {
        sanitized.proxy = {
          host: proxyData.host || '',
          port: proxyData.port || 0
        };
      }
      
      return sanitized;
    } catch (error: any) {
      logger.error({ 
        accountId: account?.id,
        error: error.message,
        stack: error.stack 
      }, 'Failed to sanitize account');
      throw error;
    }
  }

  /**
   * Parse CSV data
   */
  private parseCSV(data: string): any[] {
    const lines = data.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const accounts = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const account: any = {};

      headers.forEach((header, index) => {
        const value = values[index];
        
        // Parse specific fields
        if (header === 'proxy' && value) {
          const [host, port] = value.split(':');
          account.proxy = { host, port: parseInt(port) };
        } else if (header === 'tags' && value) {
          account.metadata = { ...account.metadata, tags: value.split(';') };
        } else if (header === 'dailyUploadLimit') {
          account[header] = parseInt(value) || 10;
        } else {
          account[header] = value;
        }
      });

      accounts.push(account);
    }

    return accounts;
  }

  /**
   * Generate CSV from data
   */
  private generateCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(item => 
        headers.map(header => {
          const value = item[header];
          // Escape commas in values
          return typeof value === 'string' && value.includes(',') 
            ? `"${value}"` 
            : value;
        }).join(',')
      )
    ].join('\n');

    return csv;
  }

  /**
   * Import accounts from CSV
   */
  async importFromCSV(csvData: string, skipDuplicates: boolean = true) {
    const result = {
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [] as Array<{ row: number; email: string; error: string }>
    };

    // Parse CSV
    const lines = csvData.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV must contain header row and at least one data row');
    }

    const headers = this.parseCSVLine(lines[0]);
    const requiredHeaders = ['email', 'password'];
    
    // Validate headers
    for (const required of requiredHeaders) {
      if (!headers.includes(required)) {
        throw new Error(`Missing required column: ${required}`);
      }
    }

    // Get existing accounts for duplicate check
    const existingAccounts = await this.accountManager.listAccounts({});
    const existingEmails = new Set(existingAccounts.map(a => a.email.toLowerCase()));

    // Process each row
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue; // Skip empty lines

      const rowData: any = {};
      headers.forEach((header, index) => {
        rowData[header] = values[index] || '';
      });

      try {
        // Check for duplicates
        if (skipDuplicates && existingEmails.has(rowData.email.toLowerCase())) {
          result.skipped++;
          continue;
        }

        // Prepare account data
        const accountData: any = {
          email: rowData.email,
          password: rowData.password,
          status: rowData.status || 'active',
          dailyUploadLimit: parseInt(rowData.dailyUploadLimit) || 10,
          metadata: {}
        };

        // Parse proxy if provided
        if (rowData.proxy) {
          const [host, port] = rowData.proxy.split(':');
          if (host && port) {
            accountData.proxy = { host, port: parseInt(port) };
          }
        }

        // Parse tags if provided
        if (rowData.tags) {
          accountData.metadata.tags = rowData.tags.split(';').map((t: string) => t.trim());
        }

        // Add notes if provided
        if (rowData.notes) {
          accountData.metadata.notes = rowData.notes;
        }

        // Create account
        await this.accountManager.addAccount(
          accountData.email,
          accountData.password,
          {
            proxy: accountData.proxy,
            dailyUploadLimit: accountData.dailyUploadLimit,
            metadata: accountData.metadata
          }
        );

        result.imported++;
        existingEmails.add(accountData.email.toLowerCase());

      } catch (error) {
        result.failed++;
        result.errors.push({
          row: i + 1,
          email: rowData.email || 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return result;
  }

  /**
   * Parse CSV line handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current) {
      result.push(current.trim());
    }
    
    return result;
  }
}