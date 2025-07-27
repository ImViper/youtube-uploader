import { Request, Response } from 'express';
import { AccountService } from './account.service';
import { getValidatedQuery } from '../../middleware/validation';
import pino from 'pino';

const logger = pino({
  name: 'account-controller',
  level: process.env.LOG_LEVEL || 'info'
});

export class AccountController {
  constructor(private accountService: AccountService) {}

  /**
   * Create a new account
   */
  async createAccount(req: Request, res: Response) {
    try {
      const account = await this.accountService.create(req.body);
      
      logger.info({ accountId: account.id }, 'Account created successfully');
      
      res.status(201).json({
        success: true,
        data: account
      });
    } catch (error: any) {
      if (error.message === 'Account already exists') {
        return res.status(409).json({
          success: false,
          error: 'Account with this email already exists'
        });
      }
      
      logger.error({ error }, 'Failed to create account');
      res.status(500).json({
        success: false,
        error: 'Failed to create account'
      });
    }
  }

  /**
   * Get all accounts with pagination and filtering
   */
  async getAccounts(req: Request, res: Response) {
    try {
      logger.info({ query: req.query }, 'getAccounts called');
      // Use the helper function to get validated query
      const queryParams = getValidatedQuery(req);
      const result = await this.accountService.findAll(queryParams as any);
      logger.info({ resultCount: result.items?.length }, 'getAccounts result');

      res.json({
        items: result.items,
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages
      });
    } catch (error: any) {
      logger.error({ 
        error: error.message, 
        stack: error.stack,
        query: req.query 
      }, 'Failed to get accounts');
      res.status(500).json({
        success: false,
        error: 'Failed to get accounts',
        message: error.message // Add more detail to response
      });
    }
  }

  /**
   * Get a single account by ID
   */
  async getAccount(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const account = await this.accountService.findById(id);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      res.json({
        success: true,
        data: account
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get account');
      res.status(500).json({
        success: false,
        error: 'Failed to get account'
      });
    }
  }

  /**
   * Update an account
   */
  async updateAccount(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const account = await this.accountService.update(id, req.body);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      logger.info({ accountId: id }, 'Account updated successfully');

      res.json({
        success: true,
        data: account
      });
    } catch (error) {
      logger.error({ error }, 'Failed to update account');
      res.status(500).json({
        success: false,
        error: 'Failed to update account'
      });
    }
  }

  /**
   * Delete an account
   */
  async deleteAccount(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const deleted = await this.accountService.delete(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      logger.info({ accountId: id }, 'Account deleted successfully');

      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      logger.error({ error }, 'Failed to delete account');
      res.status(500).json({
        success: false,
        error: 'Failed to delete account'
      });
    }
  }

  /**
   * Batch delete accounts
   */
  async batchDeleteAccounts(req: Request, res: Response) {
    try {
      const { ids } = req.body;
      const result = await this.accountService.batchDelete(ids);

      logger.info({ deletedCount: result.deletedCount }, 'Batch delete completed');

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ error }, 'Failed to batch delete accounts');
      res.status(500).json({
        success: false,
        error: 'Failed to batch delete accounts'
      });
    }
  }

  /**
   * Import accounts
   */
  async importAccounts(req: Request, res: Response) {
    try {
      const result = await this.accountService.import(req.body);

      logger.info({ imported: result.imported }, 'Import completed');

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ error }, 'Failed to import accounts');
      res.status(500).json({
        success: false,
        error: 'Failed to import accounts'
      });
    }
  }

  /**
   * Export accounts
   */
  async exportAccounts(req: Request, res: Response) {
    try {
      const queryParams = getValidatedQuery(req);
      const result = await this.accountService.export(queryParams as any);

      if (req.query.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=accounts.csv');
        res.send(result);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=accounts.json');
        res.json(result);
      }
    } catch (error) {
      logger.error({ error }, 'Failed to export accounts');
      res.status(500).json({
        success: false,
        error: 'Failed to export accounts'
      });
    }
  }

  /**
   * Health check an account
   */
  async healthCheck(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await this.accountService.healthCheck(id);

      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ error }, 'Failed to perform health check');
      res.status(500).json({
        success: false,
        error: 'Failed to perform health check'
      });
    }
  }

  /**
   * Test account login
   */
  async testAccount(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await this.accountService.testAccount(id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ error }, 'Failed to test account');
      res.status(500).json({
        success: false,
        error: 'Failed to test account'
      });
    }
  }

  /**
   * Get account statistics
   */
  async getAccountStats(req: Request, res: Response) {
    try {
      const stats = await this.accountService.getStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get account stats');
      res.status(500).json({
        success: false,
        error: 'Failed to get account stats'
      });
    }
  }

  /**
   * Reset daily limits for all accounts
   */
  async resetDailyLimits(req: Request, res: Response) {
    try {
      await this.accountService.resetDailyLimits();

      logger.info('Daily limits reset successfully');

      res.json({
        success: true,
        message: 'Daily limits reset successfully'
      });
    } catch (error) {
      logger.error({ error }, 'Failed to reset daily limits');
      res.status(500).json({
        success: false,
        error: 'Failed to reset daily limits'
      });
    }
  }

  /**
   * Update account status
   */
  async updateAccountStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const account = await this.accountService.updateStatus(id, status);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      logger.info({ accountId: id, status }, 'Account status updated');

      res.json({
        success: true,
        data: account
      });
    } catch (error) {
      logger.error({ error }, 'Failed to update account status');
      res.status(500).json({
        success: false,
        error: 'Failed to update account status'
      });
    }
  }

  /**
   * Import accounts from CSV
   */
  async importFromCSV(req: Request, res: Response) {
    try {
      const { csvData, skipDuplicates = true } = req.body;
      
      if (!csvData || typeof csvData !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'CSV data is required'
        });
      }

      const result = await this.accountService.importFromCSV(csvData, skipDuplicates);

      logger.info({ 
        imported: result.imported, 
        skipped: result.skipped,
        failed: result.failed 
      }, 'CSV import completed');

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ error }, 'Failed to import accounts from CSV');
      res.status(500).json({
        success: false,
        error: 'Failed to import accounts from CSV'
      });
    }
  }
}