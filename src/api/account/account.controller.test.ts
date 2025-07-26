import { Request, Response } from 'express';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

// Mock pino logger
jest.mock('pino', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
  return jest.fn(() => mockLogger);
});

describe('AccountController', () => {
  let accountController: AccountController;
  let mockAccountService: jest.Mocked<AccountService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let setHeaderMock: jest.Mock;
  let sendMock: jest.Mock;

  beforeEach(() => {
    // Mock AccountService
    mockAccountService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      batchDelete: jest.fn(),
      import: jest.fn(),
      export: jest.fn(),
      healthCheck: jest.fn(),
      testAccount: jest.fn(),
      getStats: jest.fn(),
      resetDailyLimits: jest.fn(),
      updateStatus: jest.fn(),
      importFromCSV: jest.fn(),
    } as any;

    accountController = new AccountController(mockAccountService);

    // Mock Request and Response
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();
    setHeaderMock = jest.fn();
    sendMock = jest.fn();

    mockRequest = {
      body: {},
      params: {},
      query: {},
    };

    mockResponse = {
      json: jsonMock,
      status: statusMock,
      setHeader: setHeaderMock,
      send: sendMock,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAccount', () => {
    it('should create account successfully', async () => {
      const accountData = {
        email: 'test@example.com',
        password: 'password123',
      };
      const createdAccount = {
        id: '1',
        username: 'test',
        email: accountData.email,
        status: 'active',
        healthScore: 100,
        dailyUploadCount: 0,
        dailyUploadLimit: 10,
        lastActive: undefined,
        createdAt: new Date().toISOString(),
        proxy: undefined,
        metadata: { notes: undefined, tags: undefined },
      };

      mockRequest.body = accountData;
      mockAccountService.create.mockResolvedValue(createdAccount);

      await accountController.createAccount(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockAccountService.create).toHaveBeenCalledWith(accountData);
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: createdAccount,
      });
    });

    it('should return 409 if account already exists', async () => {
      mockRequest.body = { email: 'existing@example.com' };
      mockAccountService.create.mockRejectedValue(
        new Error('Account already exists')
      );

      await accountController.createAccount(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Account with this email already exists',
      });
    });

    it('should return 500 for other errors', async () => {
      mockRequest.body = { email: 'test@example.com' };
      mockAccountService.create.mockRejectedValue(new Error('Database error'));

      await accountController.createAccount(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to create account',
      });
    });
  });

  describe('getAccounts', () => {
    it('should get accounts with pagination', async () => {
      const mockResult = {
        items: [{
          id: '1',
          username: 'test',
          email: 'test@example.com',
          status: 'active',
          healthScore: 100,
          dailyUploadCount: 0,
          dailyUploadLimit: 10,
          lastActive: undefined,
          createdAt: new Date().toISOString(),
          proxy: undefined,
          metadata: { notes: undefined, tags: undefined },
        }],
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      };

      mockRequest.query = { page: '1', pageSize: '10' };
      mockAccountService.findAll.mockResolvedValue(mockResult);

      await accountController.getAccounts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockAccountService.findAll).toHaveBeenCalledWith(mockRequest.query);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockResult.items,
        pagination: {
          page: mockResult.page,
          pageSize: mockResult.pageSize,
          total: mockResult.total,
          totalPages: mockResult.totalPages,
        },
      });
    });

    it('should handle errors when getting accounts', async () => {
      mockAccountService.findAll.mockRejectedValue(new Error('Database error'));

      await accountController.getAccounts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get accounts',
      });
    });
  });

  describe('getAccount', () => {
    it('should get single account by id', async () => {
      const account = {
        id: '1',
        username: 'test',
        email: 'test@example.com',
        status: 'active',
        healthScore: 100,
        dailyUploadCount: 0,
        dailyUploadLimit: 10,
        lastActive: undefined,
        createdAt: new Date().toISOString(),
        proxy: undefined,
        metadata: { notes: undefined, tags: undefined },
      };
      mockRequest.params = { id: '1' };
      mockAccountService.findById.mockResolvedValue(account);

      await accountController.getAccount(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockAccountService.findById).toHaveBeenCalledWith('1');
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: account,
      });
    });

    it('should return 404 if account not found', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockAccountService.findById.mockResolvedValue(undefined);

      await accountController.getAccount(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Account not found',
      });
    });

    it('should handle errors when getting account', async () => {
      mockRequest.params = { id: '1' };
      mockAccountService.findById.mockRejectedValue(new Error('Database error'));

      await accountController.getAccount(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get account',
      });
    });
  });

  describe('updateAccount', () => {
    it('should update account successfully', async () => {
      const updates = { dailyUploadLimit: 20 };
      const updatedAccount = {
        id: '1',
        username: 'test',
        email: 'test@example.com',
        status: 'active',
        healthScore: 100,
        dailyUploadCount: 0,
        dailyUploadLimit: 20,
        lastActive: undefined,
        createdAt: new Date().toISOString(),
        proxy: undefined,
        metadata: { notes: undefined, tags: undefined },
      };

      mockRequest.params = { id: '1' };
      mockRequest.body = updates;
      mockAccountService.update.mockResolvedValue(updatedAccount);

      await accountController.updateAccount(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockAccountService.update).toHaveBeenCalledWith('1', updates);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: updatedAccount,
      });
    });

    it('should return 404 if account not found', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockRequest.body = { dailyUploadLimit: 20 };
      mockAccountService.update.mockResolvedValue(undefined);

      await accountController.updateAccount(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Account not found',
      });
    });

    it('should handle errors when updating account', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = { dailyUploadLimit: 20 };
      mockAccountService.update.mockRejectedValue(new Error('Database error'));

      await accountController.updateAccount(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to update account',
      });
    });
  });

  describe('deleteAccount', () => {
    it('should delete account successfully', async () => {
      mockRequest.params = { id: '1' };
      mockAccountService.delete.mockResolvedValue(true);

      await accountController.deleteAccount(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockAccountService.delete).toHaveBeenCalledWith('1');
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: 'Account deleted successfully',
      });
    });

    it('should return 404 if account not found', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockAccountService.delete.mockResolvedValue(false);

      await accountController.deleteAccount(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Account not found',
      });
    });

    it('should handle errors when deleting account', async () => {
      mockRequest.params = { id: '1' };
      mockAccountService.delete.mockRejectedValue(new Error('Database error'));

      await accountController.deleteAccount(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to delete account',
      });
    });
  });

  describe('batchDeleteAccounts', () => {
    it('should batch delete accounts successfully', async () => {
      const ids = ['1', '2', '3'];
      const result = { deletedCount: 3, errors: [] };

      mockRequest.body = { ids };
      mockAccountService.batchDelete.mockResolvedValue(result);

      await accountController.batchDeleteAccounts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockAccountService.batchDelete).toHaveBeenCalledWith(ids);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: result,
      });
    });

    it('should handle errors when batch deleting', async () => {
      mockRequest.body = { ids: ['1', '2'] };
      mockAccountService.batchDelete.mockRejectedValue(
        new Error('Database error')
      );

      await accountController.batchDeleteAccounts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to batch delete accounts',
      });
    });
  });

  describe('importAccounts', () => {
    it('should import accounts successfully', async () => {
      const importData = { format: 'json', data: '[]' };
      const result = { imported: 5, failed: 1, errors: [] };

      mockRequest.body = importData;
      mockAccountService.import.mockResolvedValue(result);

      await accountController.importAccounts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockAccountService.import).toHaveBeenCalledWith(importData);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: result,
      });
    });

    it('should handle errors when importing', async () => {
      mockRequest.body = { format: 'json', data: '[]' };
      mockAccountService.import.mockRejectedValue(new Error('Import error'));

      await accountController.importAccounts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to import accounts',
      });
    });
  });

  describe('exportAccounts', () => {
    it('should export accounts as JSON', async () => {
      const exportData = [{ 
        id: '1', 
        email: 'test@example.com',
        password: '***',
        status: 'active' as const,
        healthScore: 100,
        dailyUploadLimit: 10,
        proxy: '',
        notes: '',
        tags: ''
      }];
      mockRequest.query = { format: 'json' };
      mockAccountService.export.mockResolvedValue(exportData);

      await accountController.exportAccounts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockAccountService.export).toHaveBeenCalledWith(mockRequest.query);
      expect(setHeaderMock).toHaveBeenCalledWith(
        'Content-Type',
        'application/json'
      );
      expect(setHeaderMock).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename=accounts.json'
      );
      expect(jsonMock).toHaveBeenCalledWith(exportData);
    });

    it('should export accounts as CSV', async () => {
      const csvData = 'id,email\n1,test@example.com';
      mockRequest.query = { format: 'csv' };
      mockAccountService.export.mockResolvedValue(csvData);

      await accountController.exportAccounts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(setHeaderMock).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(setHeaderMock).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename=accounts.csv'
      );
      expect(sendMock).toHaveBeenCalledWith(csvData);
    });

    it('should handle errors when exporting', async () => {
      mockRequest.query = { format: 'json' };
      mockAccountService.export.mockRejectedValue(new Error('Export error'));

      await accountController.exportAccounts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to export accounts',
      });
    });
  });

  describe('healthCheck', () => {
    it('should perform health check successfully', async () => {
      const healthData = {
        accountId: '1',
        status: 'active' as const,
        healthScore: 95,
        lastActive: new Date(),
        dailyUploads: {
          used: 5,
          limit: 10,
          remaining: 5,
        },
        checks: {
          loginStatus: true,
          quotaAvailable: true,
          proxyWorking: true,
          lastError: null,
        },
      };

      mockRequest.params = { id: '1' };
      mockAccountService.healthCheck.mockResolvedValue(healthData);

      await accountController.healthCheck(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockAccountService.healthCheck).toHaveBeenCalledWith('1');
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: healthData,
      });
    });

    it('should return 404 if account not found for health check', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockAccountService.healthCheck.mockResolvedValue(undefined);

      await accountController.healthCheck(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Account not found',
      });
    });

    it('should handle errors in health check', async () => {
      mockRequest.params = { id: '1' };
      mockAccountService.healthCheck.mockRejectedValue(
        new Error('Health check error')
      );

      await accountController.healthCheck(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to perform health check',
      });
    });
  });

  describe('testAccount', () => {
    it('should test account successfully', async () => {
      const testResult = { 
        success: true, 
        message: 'Account tested successfully',
        details: {
          loginSuccessful: true,
          canUpload: true,
          proxyWorking: true,
          healthScore: 100,
          dailyUploadsRemaining: 8,
        },
      };

      mockRequest.params = { id: '1' };
      mockAccountService.testAccount.mockResolvedValue(testResult);

      await accountController.testAccount(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockAccountService.testAccount).toHaveBeenCalledWith('1');
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: testResult,
      });
    });

    it('should handle errors when testing account', async () => {
      mockRequest.params = { id: '1' };
      mockAccountService.testAccount.mockRejectedValue(new Error('Test error'));

      await accountController.testAccount(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to test account',
      });
    });
  });

  describe('getAccountStats', () => {
    it('should get account stats successfully', async () => {
      const stats = {
        total: 100,
        active: 80,
        suspended: 15,
        disabled: 5,
        averageHealthScore: 85.5,
        totalUploadsToday: 250,
        accountsWithAvailableUploads: 65,
      };

      mockAccountService.getStats.mockResolvedValue(stats);

      await accountController.getAccountStats(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockAccountService.getStats).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: stats,
      });
    });

    it('should handle errors when getting stats', async () => {
      mockAccountService.getStats.mockRejectedValue(new Error('Stats error'));

      await accountController.getAccountStats(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get account stats',
      });
    });
  });

  describe('resetDailyLimits', () => {
    it('should reset daily limits successfully', async () => {
      mockAccountService.resetDailyLimits.mockResolvedValue(undefined);

      await accountController.resetDailyLimits(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockAccountService.resetDailyLimits).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: 'Daily limits reset successfully',
      });
    });

    it('should handle errors when resetting limits', async () => {
      mockAccountService.resetDailyLimits.mockRejectedValue(
        new Error('Reset error')
      );

      await accountController.resetDailyLimits(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to reset daily limits',
      });
    });
  });

  describe('updateAccountStatus', () => {
    it('should update account status successfully', async () => {
      const updatedAccount = {
        id: '1',
        username: 'test',
        email: 'test@example.com',
        status: 'suspended',
        healthScore: 100,
        dailyUploadCount: 0,
        dailyUploadLimit: 10,
        lastActive: undefined,
        createdAt: new Date().toISOString(),
        proxy: undefined,
        metadata: { notes: undefined, tags: undefined },
      };

      mockRequest.params = { id: '1' };
      mockRequest.body = { status: 'suspended' };
      mockAccountService.updateStatus.mockResolvedValue(updatedAccount);

      await accountController.updateAccountStatus(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockAccountService.updateStatus).toHaveBeenCalledWith(
        '1',
        'suspended'
      );
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: updatedAccount,
      });
    });

    it('should return 404 if account not found when updating status', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockRequest.body = { status: 'suspended' };
      mockAccountService.updateStatus.mockResolvedValue(undefined);

      await accountController.updateAccountStatus(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Account not found',
      });
    });

    it('should handle errors when updating status', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = { status: 'suspended' };
      mockAccountService.updateStatus.mockRejectedValue(
        new Error('Update error')
      );

      await accountController.updateAccountStatus(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to update account status',
      });
    });
  });

  describe('importFromCSV', () => {
    it('should import from CSV successfully', async () => {
      const result = {
        imported: 10,
        skipped: 2,
        failed: 1,
        errors: [],
      };

      mockRequest.body = {
        csvData: 'email,password\ntest@example.com,pass123',
        skipDuplicates: true,
      };
      mockAccountService.importFromCSV.mockResolvedValue(result);

      await accountController.importFromCSV(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockAccountService.importFromCSV).toHaveBeenCalledWith(
        mockRequest.body.csvData,
        true
      );
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: result,
      });
    });

    it('should handle missing CSV data', async () => {
      mockRequest.body = { skipDuplicates: true };

      await accountController.importFromCSV(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'CSV data is required',
      });
    });

    it('should handle invalid CSV data type', async () => {
      mockRequest.body = { csvData: 123, skipDuplicates: true };

      await accountController.importFromCSV(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'CSV data is required',
      });
    });

    it('should use default skipDuplicates value', async () => {
      const result = { imported: 5, skipped: 0, failed: 0, errors: [] };

      mockRequest.body = {
        csvData: 'email,password\ntest@example.com,pass123',
      };
      mockAccountService.importFromCSV.mockResolvedValue(result);

      await accountController.importFromCSV(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockAccountService.importFromCSV).toHaveBeenCalledWith(
        mockRequest.body.csvData,
        true // default value
      );
    });

    it('should handle errors when importing from CSV', async () => {
      mockRequest.body = {
        csvData: 'email,password\ntest@example.com,pass123',
      };
      mockAccountService.importFromCSV.mockRejectedValue(
        new Error('CSV import error')
      );

      await accountController.importFromCSV(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to import accounts from CSV',
      });
    });
  });
});