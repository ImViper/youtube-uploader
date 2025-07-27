import express from 'express';
import request from 'supertest';
import { createAccountRoutes } from '../../../api/account/account.routes';
import { AccountManager } from '../../../accounts/manager';
import { AccountService } from '../../../api/account/account.service';
import { AccountController } from '../../../api/account/account.controller';

// Mock the validation middleware
jest.mock('../../../middleware/validation', () => ({
  validate: () => (req: any, res: any, next: any) => next(),
}));

// Mock the validation schemas
jest.mock('../../../validation/schemas', () => ({
  createAccountSchema: {},
  updateAccountSchema: {},
  accountFilterSchema: {},
  paginationSchema: { merge: jest.fn(() => ({})) },
  importAccountsSchema: {},
  exportAccountsSchema: {},
}));

// Mock dependencies
jest.mock('../../../api/account/account.service');
jest.mock('../../../api/account/account.controller');

describe('Account Routes', () => {
  let app: express.Application;
  let mockAccountManager: jest.Mocked<AccountManager>;
  let mockAccountService: jest.Mocked<AccountService>;
  let mockAccountController: jest.Mocked<AccountController>;

  beforeEach(() => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Create mocks
    mockAccountManager = {} as any;
    mockAccountService = {} as any;
    
    // Mock AccountService constructor
    (AccountService as jest.MockedClass<typeof AccountService>).mockImplementation(
      () => mockAccountService
    );

    // Create mock controller methods
    mockAccountController = {
      createAccount: jest.fn((req, res) => res.status(201).json({ success: true })),
      getAccounts: jest.fn((req, res) => res.json({ success: true })),
      getAccount: jest.fn((req, res) => res.json({ success: true })),
      updateAccount: jest.fn((req, res) => res.json({ success: true })),
      deleteAccount: jest.fn((req, res) => res.json({ success: true })),
      batchDeleteAccounts: jest.fn((req, res) => res.json({ success: true })),
      importAccounts: jest.fn((req, res) => res.json({ success: true })),
      exportAccounts: jest.fn((req, res) => res.json({ success: true })),
      healthCheck: jest.fn((req, res) => res.json({ success: true })),
      testAccount: jest.fn((req, res) => res.json({ success: true })),
      getAccountStats: jest.fn((req, res) => res.json({ success: true })),
      resetDailyLimits: jest.fn((req, res) => res.json({ success: true })),
      updateAccountStatus: jest.fn((req, res) => res.json({ success: true })),
      importFromCSV: jest.fn((req, res) => res.json({ success: true })),
    } as any;

    // Mock AccountController constructor
    (AccountController as jest.MockedClass<typeof AccountController>).mockImplementation(
      () => mockAccountController
    );

    // Create routes
    const router = createAccountRoutes(mockAccountManager);
    app.use('/api/v1/accounts', router);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /', () => {
    it('should create a new account', async () => {
      const accountData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const response = await request(app)
        .post('/api/v1/accounts')
        .send(accountData)
        .expect(201);

      expect(response.body).toEqual({ success: true });
      expect(mockAccountController.createAccount).toHaveBeenCalled();
    });
  });

  describe('GET /', () => {
    it('should get all accounts', async () => {
      const response = await request(app)
        .get('/api/v1/accounts')
        .query({ page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(mockAccountController.getAccounts).toHaveBeenCalled();
    });
  });

  describe('GET /stats', () => {
    it('should get account statistics', async () => {
      const response = await request(app)
        .get('/api/v1/accounts/stats')
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(mockAccountController.getAccountStats).toHaveBeenCalled();
    });
  });

  describe('GET /export', () => {
    it('should export accounts', async () => {
      const response = await request(app)
        .get('/api/v1/accounts/export')
        .query({ format: 'json' })
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(mockAccountController.exportAccounts).toHaveBeenCalled();
    });
  });

  describe('GET /:id', () => {
    it('should get a single account', async () => {
      const accountId = '123e4567-e89b-12d3-a456-426614174000';

      const response = await request(app)
        .get(`/api/v1/accounts/${accountId}`)
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(mockAccountController.getAccount).toHaveBeenCalled();
    });
  });

  describe('PUT /:id', () => {
    it('should update an account', async () => {
      const accountId = '123e4567-e89b-12d3-a456-426614174000';
      const updates = { dailyUploadLimit: 20 };

      const response = await request(app)
        .put(`/api/v1/accounts/${accountId}`)
        .send(updates)
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(mockAccountController.updateAccount).toHaveBeenCalled();
    });
  });

  describe('PATCH /:id/status', () => {
    it('should update account status', async () => {
      const accountId = '123e4567-e89b-12d3-a456-426614174000';
      const statusUpdate = { status: 'suspended' };

      const response = await request(app)
        .patch(`/api/v1/accounts/${accountId}/status`)
        .send(statusUpdate)
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(mockAccountController.updateAccountStatus).toHaveBeenCalled();
    });
  });

  describe('DELETE /:id', () => {
    it('should delete an account', async () => {
      const accountId = '123e4567-e89b-12d3-a456-426614174000';

      const response = await request(app)
        .delete(`/api/v1/accounts/${accountId}`)
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(mockAccountController.deleteAccount).toHaveBeenCalled();
    });
  });

  describe('DELETE /batch', () => {
    it('should batch delete accounts', async () => {
      const ids = [
        '123e4567-e89b-12d3-a456-426614174000',
        '223e4567-e89b-12d3-a456-426614174001',
      ];

      const response = await request(app)
        .delete('/api/v1/accounts/batch')
        .send({ ids })
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(mockAccountController.batchDeleteAccounts).toHaveBeenCalled();
    });
  });

  describe('POST /import', () => {
    it('should import accounts', async () => {
      const importData = {
        format: 'json',
        data: JSON.stringify([
          { email: 'test1@example.com', password: 'pass1' },
          { email: 'test2@example.com', password: 'pass2' },
        ]),
      };

      const response = await request(app)
        .post('/api/v1/accounts/import')
        .send(importData)
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(mockAccountController.importAccounts).toHaveBeenCalled();
    });
  });

  describe('POST /import/csv', () => {
    it('should import accounts from CSV', async () => {
      const csvData = 'email,password\ntest@example.com,pass123';

      const response = await request(app)
        .post('/api/v1/accounts/import/csv')
        .send({ csvData })
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(mockAccountController.importFromCSV).toHaveBeenCalled();
    });
  });

  describe('GET /:id/health', () => {
    it('should perform health check on account', async () => {
      const accountId = '123e4567-e89b-12d3-a456-426614174000';

      const response = await request(app)
        .get(`/api/v1/accounts/${accountId}/health`)
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(mockAccountController.healthCheck).toHaveBeenCalled();
    });
  });

  describe('POST /:id/test', () => {
    it('should test account login', async () => {
      const accountId = '123e4567-e89b-12d3-a456-426614174000';

      const response = await request(app)
        .post(`/api/v1/accounts/${accountId}/test`)
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(mockAccountController.testAccount).toHaveBeenCalled();
    });
  });

  describe('POST /reset-limits', () => {
    it('should reset daily limits', async () => {
      const response = await request(app)
        .post('/api/v1/accounts/reset-limits')
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(mockAccountController.resetDailyLimits).toHaveBeenCalled();
    });
  });

  describe('Route Order', () => {
    it('should handle /stats before /:id', async () => {
      // This test ensures that /stats route is registered before /:id
      // to prevent /stats being matched as an id parameter
      const response = await request(app)
        .get('/api/v1/accounts/stats')
        .expect(200);

      expect(mockAccountController.getAccountStats).toHaveBeenCalled();
      expect(mockAccountController.getAccount).not.toHaveBeenCalled();
    });

    it('should handle /export before /:id', async () => {
      const response = await request(app)
        .get('/api/v1/accounts/export')
        .expect(200);

      expect(mockAccountController.exportAccounts).toHaveBeenCalled();
      expect(mockAccountController.getAccount).not.toHaveBeenCalled();
    });
  });
});