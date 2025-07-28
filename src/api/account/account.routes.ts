import { Router } from 'express';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AccountManager } from '../../accounts/manager';
import { validate } from '../../middleware/validation';
import { 
  createAccountSchema,
  updateAccountSchema,
  accountFilterSchema,
  paginationSchema,
  importAccountsSchema,
  exportAccountsSchema
} from '../../validation/schemas';
import { z } from 'zod';

export function createAccountRoutes(accountManager: AccountManager): Router {
  const router = Router();
  const accountService = new AccountService(accountManager);
  const accountController = new AccountController(accountService);

  // Create a new account
  router.post(
    '/',
    validate({ body: createAccountSchema }),
    (req, res) => accountController.createAccount(req, res)
  );

  // Get all accounts
  router.get(
    '/',
    validate({ 
      query: paginationSchema.merge(accountFilterSchema) 
    }),
    async (req, res) => {
      try {
        console.log('Accounts route hit, query:', req.query);
        await accountController.getAccounts(req, res);
      } catch (error: any) {
        console.error('Route error:', error);
        console.error('Stack:', error.stack);
        res.status(500).json({ 
          success: false, 
          error: 'Route handler error',
          message: error.message,
          stack: error.stack 
        });
      }
    }
  );

  // Get account statistics
  router.get(
    '/stats',
    (req, res) => accountController.getAccountStats(req, res)
  );

  // Export accounts
  router.get(
    '/export',
    validate({ query: exportAccountsSchema }),
    (req, res) => accountController.exportAccounts(req, res)
  );

  // Get a single account
  router.get(
    '/:id',
    validate({ params: z.object({ id: z.string().uuid() }) }),
    (req, res) => accountController.getAccount(req, res)
  );

  // Update an account
  router.put(
    '/:id',
    validate({ 
      params: z.object({ id: z.string().uuid() }),
      body: updateAccountSchema 
    }),
    (req, res) => accountController.updateAccount(req, res)
  );

  // Update an account (PATCH method)
  router.patch(
    '/:id',
    validate({ 
      params: z.object({ id: z.string().uuid() }),
      body: updateAccountSchema 
    }),
    (req, res) => accountController.updateAccount(req, res)
  );

  // Update account status
  router.patch(
    '/:id/status',
    validate({ 
      params: z.object({ id: z.string().uuid() }),
      body: z.object({ 
        status: z.enum(['active', 'suspended', 'disabled']) 
      })
    }),
    (req, res) => accountController.updateAccountStatus(req, res)
  );

  // Batch delete accounts - must come before /:id route
  router.delete(
    '/batch',
    validate({ 
      body: z.object({ 
        ids: z.array(z.string().uuid()).min(1) 
      })
    }),
    (req, res) => accountController.batchDeleteAccounts(req, res)
  );

  // Delete an account
  router.delete(
    '/:id',
    validate({ params: z.object({ id: z.string().uuid() }) }),
    (req, res) => accountController.deleteAccount(req, res)
  );

  // Import accounts
  router.post(
    '/import',
    validate({ body: importAccountsSchema }),
    (req, res) => accountController.importAccounts(req, res)
  );

  // Import accounts from CSV
  router.post(
    '/import/csv',
    // CSV data comes as raw text, so we handle validation differently
    (req, res) => accountController.importFromCSV(req, res)
  );

  // Health check an account
  router.get(
    '/:id/health',
    validate({ params: z.object({ id: z.string().uuid() }) }),
    (req, res) => accountController.healthCheck(req, res)
  );

  // Test account login
  router.post(
    '/:id/test',
    validate({ params: z.object({ id: z.string().uuid() }) }),
    (req, res) => accountController.testAccount(req, res)
  );

  // Reset daily limits
  router.post(
    '/reset-limits',
    (req, res) => accountController.resetDailyLimits(req, res)
  );

  return router;
}