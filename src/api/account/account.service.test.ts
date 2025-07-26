import { AccountService } from './account.service';
import { AccountManager } from '../../accounts/manager';
import { v4 as uuidv4 } from 'uuid';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));

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

describe('AccountService', () => {
  let accountService: AccountService;
  let mockAccountManager: jest.Mocked<AccountManager>;

  beforeEach(() => {
    // Create mock AccountManager
    mockAccountManager = {
      addAccount: jest.fn(),
      listAccounts: jest.fn(),
      getAccount: jest.fn(),
      updateAccount: jest.fn(),
      removeAccount: jest.fn(),
      getAccountStats: jest.fn(),
      resetDailyLimits: jest.fn(),
    } as any;

    accountService = new AccountService(mockAccountManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const mockAccountData = {
      email: 'test@example.com',
      password: 'password123',
      proxy: { host: 'proxy.example.com', port: 8080 },
      dailyUploadLimit: 20,
      metadata: { notes: 'Test account' },
    };

    it('should create a new account successfully', async () => {
      const mockCreatedAccount: any = {
        id: 'test-uuid-1234',
        email: mockAccountData.email,
        password: mockAccountData.password,
        credentials: {
          email: mockAccountData.email,
          encryptedPassword: 'encrypted',
          recoveryEmail: undefined,
        },
        browserProfileId: 'browser-profile-123',
        status: 'active',
        healthScore: 100,
        dailyUploadCount: 0,
        dailyUploadLimit: mockAccountData.dailyUploadLimit,
        proxy: mockAccountData.proxy,
        metadata: mockAccountData.metadata,
        createdAt: new Date().toISOString(),
      };

      mockAccountManager.listAccounts.mockResolvedValue([]);
      mockAccountManager.addAccount.mockResolvedValue(mockCreatedAccount);

      const result = await accountService.create(mockAccountData);

      expect(mockAccountManager.listAccounts).toHaveBeenCalledWith({});
      expect(mockAccountManager.addAccount).toHaveBeenCalledWith(
        mockAccountData.email,
        mockAccountData.password,
        {
          proxy: mockAccountData.proxy,
          dailyUploadLimit: mockAccountData.dailyUploadLimit,
          notes: mockAccountData.metadata.notes,
        }
      );
      expect(result).toEqual({
        id: mockCreatedAccount.id,
        username: 'test',
        email: mockCreatedAccount.email,
        status: mockCreatedAccount.status,
        healthScore: mockCreatedAccount.healthScore,
        dailyUploadCount: mockCreatedAccount.dailyUploadCount,
        dailyUploadLimit: mockCreatedAccount.dailyUploadLimit,
        lastActive: undefined,
        createdAt: mockCreatedAccount.createdAt,
        proxy: mockCreatedAccount.proxy,
        metadata: {
          notes: mockAccountData.metadata.notes,
          tags: undefined,
        },
      });
    });

    it('should throw error if account already exists', async () => {
      mockAccountManager.listAccounts.mockResolvedValue([
        { email: mockAccountData.email } as any,
      ]);

      await expect(accountService.create(mockAccountData)).rejects.toThrow(
        'Account already exists'
      );

      expect(mockAccountManager.addAccount).not.toHaveBeenCalled();
    });

    it('should handle errors during account creation', async () => {
      const error = new Error('Database error');
      mockAccountManager.listAccounts.mockResolvedValue([]);
      mockAccountManager.addAccount.mockRejectedValue(error);

      await expect(accountService.create(mockAccountData)).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('findAll', () => {
    const mockAccounts: any[] = [
      {
        id: '1',
        email: 'test1@example.com',
        password: 'pass1',
        credentials: {
          email: 'test1@example.com',
          encryptedPassword: 'encrypted1',
        },
        browserProfileId: 'browser-1',
        status: 'active',
        healthScore: 100,
        dailyUploadCount: 5,
        dailyUploadLimit: 10,
        lastUploadTime: new Date('2024-01-01'),
        metadata: { tags: ['premium'], notes: 'Note 1' },
        createdAt: new Date('2023-01-01'),
      },
      {
        id: '2',
        email: 'test2@example.com',
        password: 'pass2',
        credentials: {
          email: 'test2@example.com',
          encryptedPassword: 'encrypted2',
        },
        browserProfileId: 'browser-2',
        status: 'suspended',
        healthScore: 50,
        dailyUploadCount: 0,
        dailyUploadLimit: 10,
        lastUploadTime: new Date('2024-01-02'),
        metadata: { tags: ['basic'], notes: 'Note 2' },
        createdAt: new Date('2023-01-02'),
      },
    ];

    it('should return paginated accounts with default options', async () => {
      mockAccountManager.listAccounts.mockResolvedValue(mockAccounts);

      const options = {
        page: 1,
        pageSize: 10,
      };

      const result = await accountService.findAll(options);

      expect(mockAccountManager.listAccounts).toHaveBeenCalledWith({
        status: undefined,
        minHealthScore: undefined,
        hasAvailableUploads: undefined,
      });
      expect(result.items).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
    });

    it('should filter accounts by status', async () => {
      mockAccountManager.listAccounts.mockResolvedValue([mockAccounts[0]]);

      const options = {
        page: 1,
        pageSize: 10,
        status: 'active' as const,
      };

      const result = await accountService.findAll(options);

      expect(mockAccountManager.listAccounts).toHaveBeenCalledWith({
        status: 'active',
        minHealthScore: undefined,
        hasAvailableUploads: undefined,
      });
      expect(result.items).toHaveLength(1);
    });

    it('should filter accounts by search term', async () => {
      mockAccountManager.listAccounts.mockResolvedValue(mockAccounts);

      const options = {
        page: 1,
        pageSize: 10,
        search: 'test1',
      };

      const result = await accountService.findAll(options);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].email).toBe('test1@example.com');
    });

    it('should filter accounts by tags', async () => {
      mockAccountManager.listAccounts.mockResolvedValue(mockAccounts);

      const options = {
        page: 1,
        pageSize: 10,
        tags: ['premium'],
      };

      const result = await accountService.findAll(options);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].metadata.tags).toContain('premium');
    });

    it('should sort accounts by createdAt in descending order', async () => {
      mockAccountManager.listAccounts.mockResolvedValue(mockAccounts);

      const options = {
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc' as const,
      };

      const result = await accountService.findAll(options);

      expect(result.items[0].email).toBe('test2@example.com');
      expect(result.items[1].email).toBe('test1@example.com');
    });

    it('should handle pagination correctly', async () => {
      const manyAccounts = Array.from({ length: 25 }, (_, i) => ({
        ...mockAccounts[0],
        id: `${i}`,
        email: `test${i}@example.com`,
      }));

      mockAccountManager.listAccounts.mockResolvedValue(manyAccounts);

      const options = {
        page: 2,
        pageSize: 10,
      };

      const result = await accountService.findAll(options);

      expect(result.items).toHaveLength(10);
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3);
      expect(result.total).toBe(25);
    });

    it('should handle sorting by lastActive', async () => {
      mockAccountManager.listAccounts.mockResolvedValue(mockAccounts);

      const options = {
        page: 1,
        pageSize: 10,
        sortBy: 'lastActive',
        sortOrder: 'asc' as const,
      };

      const result = await accountService.findAll(options);

      expect(result.items[0].email).toBe('test1@example.com');
      expect(result.items[1].email).toBe('test2@example.com');
    });
  });

  describe('findById', () => {
    it('should return account by id', async () => {
      const mockAccount: any = {
        id: '1',
        email: 'test@example.com',
        password: 'password',
        status: 'active',
        healthScore: 100,
        dailyUploadCount: 0,
        dailyUploadLimit: 10,
      };

      mockAccountManager.getAccount.mockResolvedValue(mockAccount);

      const result = await accountService.findById('1');

      expect(mockAccountManager.getAccount).toHaveBeenCalledWith('1');
      expect(result).toBeDefined();
      expect(result?.id).toBe('1');
    });

    it('should return undefined if account not found', async () => {
      mockAccountManager.getAccount.mockResolvedValue(null);

      const result = await accountService.findById('non-existent');

      expect(result).toBeUndefined();
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      mockAccountManager.getAccount.mockRejectedValue(error);

      await expect(accountService.findById('1')).rejects.toThrow('Database error');
    });
  });

  describe('update', () => {
    it('should update account successfully', async () => {
      const updates = {
        dailyUploadLimit: 20,
        metadata: { notes: 'Updated notes' },
      };

      const updatedAccount: any = {
        id: '1',
        email: 'test@example.com',
        password: 'password',
        status: 'active',
        healthScore: 100,
        dailyUploadCount: 0,
        dailyUploadLimit: 20,
        metadata: { notes: 'Updated notes' },
      };

      mockAccountManager.updateAccount.mockResolvedValue(undefined);
      mockAccountManager.getAccount.mockResolvedValue(updatedAccount);

      const result = await accountService.update('1', updates);

      expect(mockAccountManager.updateAccount).toHaveBeenCalledWith('1', updates);
      expect(mockAccountManager.getAccount).toHaveBeenCalledWith('1');
      expect(result?.dailyUploadLimit).toBe(20);
    });

    it('should return undefined if account not found after update', async () => {
      mockAccountManager.updateAccount.mockResolvedValue(undefined);
      mockAccountManager.getAccount.mockResolvedValue(null);

      const result = await accountService.update('1', {});

      expect(result).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('should delete account successfully', async () => {
      mockAccountManager.removeAccount.mockResolvedValue(undefined);

      const result = await accountService.delete('1');

      expect(mockAccountManager.removeAccount).toHaveBeenCalledWith('1');
      expect(result).toBe(true);
    });

    it('should return false if account not found', async () => {
      mockAccountManager.removeAccount.mockRejectedValue(
        new Error('Account not found')
      );

      const result = await accountService.delete('non-existent');

      expect(result).toBe(false);
    });

    it('should throw other errors', async () => {
      mockAccountManager.removeAccount.mockRejectedValue(
        new Error('Database error')
      );

      await expect(accountService.delete('1')).rejects.toThrow('Database error');
    });
  });

  describe('batchDelete', () => {
    it('should delete multiple accounts successfully', async () => {
      const ids = ['1', '2', '3'];
      mockAccountManager.removeAccount.mockResolvedValue(undefined);

      const result = await accountService.batchDelete(ids);

      expect(mockAccountManager.removeAccount).toHaveBeenCalledTimes(3);
      expect(result.deletedCount).toBe(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle partial failures', async () => {
      const ids = ['1', '2', '3'];
      mockAccountManager.removeAccount
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Account not found'))
        .mockResolvedValueOnce(undefined);

      const result = await accountService.batchDelete(ids);

      expect(result.deletedCount).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        id: '2',
        error: 'Account not found',
      });
    });
  });

  describe('import', () => {
    it('should import accounts from JSON data', async () => {
      const importData = {
        format: 'json' as const,
        data: JSON.stringify([
          {
            email: 'import1@example.com',
            password: 'pass1',
            dailyUploadLimit: 15,
          },
          {
            email: 'import2@example.com',
            password: 'pass2',
            dailyUploadLimit: 20,
          },
        ]),
      };

      // Mock the internal create method calls
      jest.spyOn(accountService, 'create')
        .mockResolvedValueOnce({ id: '1', email: 'import1@example.com' } as any)
        .mockResolvedValueOnce({ id: '2', email: 'import2@example.com' } as any);

      const result = await accountService.import(importData);

      expect(result.imported).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should import accounts from accounts array', async () => {
      const importData = {
        format: 'json' as const,
        accounts: [
          {
            email: 'import1@example.com',
            password: 'pass1',
          },
        ],
      };

      // Mock the internal create method calls
      jest.spyOn(accountService, 'create')
        .mockResolvedValueOnce({ id: '1', email: 'import1@example.com' } as any);

      const result = await accountService.import(importData);

      expect(result.imported).toBe(1);
    });

    it('should handle CSV import', async () => {
      const importData = {
        format: 'csv' as const,
        data: 'email,password,dailyUploadLimit,proxy,tags\n' +
              'csv1@example.com,pass1,15,proxy.com:8080,tag1;tag2\n' +
              'csv2@example.com,pass2,20,,tag3',
      };

      // Mock the internal create method calls
      jest.spyOn(accountService, 'create')
        .mockResolvedValueOnce({ id: '1', email: 'csv1@example.com' } as any)
        .mockResolvedValueOnce({ id: '2', email: 'csv2@example.com' } as any);

      const result = await accountService.import(importData);

      expect(result.imported).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should handle import failures', async () => {
      const importData = {
        format: 'json' as const,
        data: JSON.stringify([
          { email: 'import1@example.com', password: 'pass1' },
          { email: 'import2@example.com', password: 'pass2' },
        ]),
      };

      // Mock the internal create method calls
      jest.spyOn(accountService, 'create')
        .mockResolvedValueOnce({ id: '1', email: 'import1@example.com' } as any)
        .mockRejectedValueOnce(new Error('Account already exists'));

      const result = await accountService.import(importData);

      expect(result.imported).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Account already exists');
    });

    it('should throw error for invalid JSON', async () => {
      const importData = {
        format: 'json' as const,
        data: 'invalid json',
      };

      await expect(accountService.import(importData)).rejects.toThrow(
        'Invalid JSON format'
      );
    });
  });

  describe('export', () => {
    it('should export accounts as JSON', async () => {
      const mockAccounts: any[] = [
        {
          id: '1',
          email: 'test1@example.com',
          password: 'pass1',
          status: 'active',
          healthScore: 100,
          dailyUploadLimit: 10,
          dailyUploadCount: 5,
          proxy: { host: 'proxy.com', port: 8080 },
          metadata: { notes: 'Note 1', tags: ['tag1', 'tag2'] },
        },
      ];

      mockAccountManager.listAccounts.mockResolvedValue(mockAccounts);

      const options = {
        format: 'json' as const,
        includePasswords: true,
      };

      const result = await accountService.export(options);

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toEqual({
        id: '1',
        email: 'test1@example.com',
        password: 'pass1',
        status: 'active',
        healthScore: 100,
        dailyUploadLimit: 10,
        proxy: 'proxy.com:8080',
        notes: 'Note 1',
        tags: 'tag1,tag2',
      });
    });

    it('should export accounts as CSV', async () => {
      const mockAccounts: any[] = [
        {
          id: '1',
          email: 'test1@example.com',
          password: 'pass1',
          status: 'active',
          healthScore: 100,
          dailyUploadLimit: 10,
          dailyUploadCount: 5,
          metadata: {},
        },
      ];

      mockAccountManager.listAccounts.mockResolvedValue(mockAccounts);

      const options = {
        format: 'csv' as const,
        includePasswords: false,
      };

      const result = await accountService.export(options);

      expect(typeof result).toBe('string');
      expect(result).toContain('id,email,password,status,healthScore');
      expect(result).toContain('***'); // Password masked
    });

    it('should filter by ids when exporting', async () => {
      const mockAccounts = [
        { id: '1', email: 'test1@example.com' },
        { id: '2', email: 'test2@example.com' },
        { id: '3', email: 'test3@example.com' },
      ] as any[];

      mockAccountManager.listAccounts.mockResolvedValue(mockAccounts);

      const options = {
        format: 'json' as const,
        ids: ['1', '3'],
        includePasswords: false,
      };

      const result = await accountService.export(options);

      expect(Array.isArray(result)).toBe(true);
      const resultArray = result as any[];
      expect(resultArray).toHaveLength(2);
      expect(resultArray.map((a: any) => a.id)).toEqual(['1', '3']);
    });
  });

  describe('healthCheck', () => {
    it('should perform health check successfully', async () => {
      const mockAccount: any = {
        id: '1',
        email: 'test@example.com',
        status: 'active',
        healthScore: 95,
        dailyUploadCount: 3,
        dailyUploadLimit: 10,
        lastUploadTime: new Date('2024-01-01'),
        metadata: { lastError: null },
      };

      mockAccountManager.getAccount.mockResolvedValue(mockAccount);

      const result = await accountService.healthCheck('1');

      expect(result).toEqual({
        accountId: '1',
        status: 'active',
        healthScore: 95,
        lastActive: mockAccount.lastUploadTime,
        dailyUploads: {
          used: 3,
          limit: 10,
          remaining: 7,
        },
        checks: {
          loginStatus: true,
          quotaAvailable: true,
          proxyWorking: true,
          lastError: null,
        },
      });
    });

    it('should return undefined if account not found', async () => {
      mockAccountManager.getAccount.mockResolvedValue(null);

      const result = await accountService.healthCheck('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('testAccount', () => {
    it('should test active account successfully', async () => {
      const mockAccount: any = {
        id: '1',
        email: 'test@example.com',
        status: 'active',
        healthScore: 100,
        dailyUploadCount: 2,
        dailyUploadLimit: 10,
      };

      mockAccountManager.getAccount.mockResolvedValue(mockAccount);

      const result = await accountService.testAccount('1');

      expect(mockAccountManager.getAccount).toHaveBeenCalledWith('1');
      expect(result).toEqual({
        success: true,
        message: 'Account tested successfully',
        details: {
          loginSuccessful: true,
          canUpload: true,
          proxyWorking: true,
          healthScore: 100,
          dailyUploadsRemaining: 8,
        },
      });
    });

    it('should test suspended account', async () => {
      const mockAccount: any = {
        id: '1',
        email: 'test@example.com',
        status: 'suspended',
        healthScore: 50,
        dailyUploadCount: 0,
        dailyUploadLimit: 10,
      };

      mockAccountManager.getAccount.mockResolvedValue(mockAccount);

      const result = await accountService.testAccount('1');

      expect(result).toEqual({
        success: false,
        message: 'Account test failed: status is suspended',
        details: {
          loginSuccessful: false,
          canUpload: false,
          proxyWorking: true,
          healthScore: 50,
          dailyUploadsRemaining: 10,
        },
      });
    });

    it('should throw error if account not found', async () => {
      mockAccountManager.getAccount.mockResolvedValue(null);

      await expect(accountService.testAccount('non-existent')).rejects.toThrow(
        'Account not found'
      );
    });
  });

  describe('getStats', () => {
    it('should get account statistics', async () => {
      const mockStats = {
        total: 100,
        active: 80,
        suspended: 15,
        disabled: 5,
      };

      mockAccountManager.getAccountStats.mockResolvedValue(mockStats);

      const result = await accountService.getStats();

      expect(mockAccountManager.getAccountStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe('resetDailyLimits', () => {
    it('should reset daily limits successfully', async () => {
      mockAccountManager.resetDailyLimits.mockResolvedValue(undefined);

      await accountService.resetDailyLimits();

      expect(mockAccountManager.resetDailyLimits).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('should update account status successfully', async () => {
      const updatedAccount: any = {
        id: '1',
        email: 'test@example.com',
        status: 'suspended',
      };

      mockAccountManager.updateAccount.mockResolvedValue(undefined);
      mockAccountManager.getAccount.mockResolvedValue(updatedAccount);

      const result = await accountService.updateStatus('1', 'suspended');

      expect(mockAccountManager.updateAccount).toHaveBeenCalledWith('1', {
        status: 'suspended',
      });
      expect(result?.status).toBe('suspended');
    });
  });

  describe('importFromCSV', () => {
    it('should import accounts from CSV successfully', async () => {
      const csvData = 
        'email,password,status,dailyUploadLimit,proxy,tags,notes\n' +
        'csv1@example.com,pass1,active,15,proxy.com:8080,tag1;tag2,Note 1\n' +
        'csv2@example.com,pass2,active,20,,,Note 2';

      mockAccountManager.listAccounts.mockResolvedValue([]);
      mockAccountManager.addAccount.mockResolvedValue({} as any);

      const result = await accountService.importFromCSV(csvData, true);

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip duplicates when skipDuplicates is true', async () => {
      const csvData = 
        'email,password\n' +
        'existing@example.com,pass1\n' +
        'new@example.com,pass2';

      mockAccountManager.listAccounts.mockResolvedValue([
        { email: 'existing@example.com' } as any,
      ]);
      mockAccountManager.addAccount.mockResolvedValue({} as any);

      const result = await accountService.importFromCSV(csvData, true);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(mockAccountManager.addAccount).toHaveBeenCalledTimes(1);
    });

    it('should import duplicates when skipDuplicates is false', async () => {
      const csvData = 
        'email,password\n' +
        'existing@example.com,pass1';

      mockAccountManager.listAccounts.mockResolvedValue([
        { email: 'existing@example.com' } as any,
      ]);
      mockAccountManager.addAccount.mockResolvedValue({} as any);

      const result = await accountService.importFromCSV(csvData, false);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
    });

    it('should handle CSV with quoted values', async () => {
      const csvData = 
        'email,password,notes\n' +
        '"email@example.com","pass123","Note with, comma"';

      mockAccountManager.listAccounts.mockResolvedValue([]);
      mockAccountManager.addAccount.mockResolvedValue({} as any);

      const result = await accountService.importFromCSV(csvData, true);

      expect(result.imported).toBe(1);
      expect(mockAccountManager.addAccount).toHaveBeenCalledWith(
        'email@example.com',
        'pass123',
        expect.objectContaining({
          metadata: { notes: 'Note with, comma' },
        })
      );
    });

    it('should throw error if required columns are missing', async () => {
      const csvData = 'email\ntest@example.com'; // Missing password column

      await expect(accountService.importFromCSV(csvData, true)).rejects.toThrow(
        'Missing required column: password'
      );
    });

    it('should throw error if CSV is empty', async () => {
      const csvData = '';

      await expect(accountService.importFromCSV(csvData, true)).rejects.toThrow(
        'CSV must contain header row and at least one data row'
      );
    });

    it('should handle import errors gracefully', async () => {
      const csvData = 
        'email,password\n' +
        'test1@example.com,pass1\n' +
        'test2@example.com,pass2';

      mockAccountManager.listAccounts.mockResolvedValue([]);
      mockAccountManager.addAccount
        .mockResolvedValueOnce({} as any)
        .mockRejectedValueOnce(new Error('Database error'));

      const result = await accountService.importFromCSV(csvData, true);

      expect(result.imported).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        row: 3,
        email: 'test2@example.com',
        error: 'Database error',
      });
    });

    it('should parse proxy correctly', async () => {
      const csvData = 
        'email,password,proxy\n' +
        'test@example.com,pass,192.168.1.1:3128';

      mockAccountManager.listAccounts.mockResolvedValue([]);
      mockAccountManager.addAccount.mockResolvedValue({} as any);

      await accountService.importFromCSV(csvData, true);

      expect(mockAccountManager.addAccount).toHaveBeenCalledWith(
        'test@example.com',
        'pass',
        expect.objectContaining({
          proxy: { host: '192.168.1.1', port: 3128 },
        })
      );
    });

    it('should skip empty lines', async () => {
      const csvData = 
        'email,password\n' +
        'test@example.com,pass\n' +
        '\n' +
        '   \n';

      mockAccountManager.listAccounts.mockResolvedValue([]);
      mockAccountManager.addAccount.mockResolvedValue({} as any);

      const result = await accountService.importFromCSV(csvData, true);

      expect(result.imported).toBe(1);
      expect(mockAccountManager.addAccount).toHaveBeenCalledTimes(1);
    });
  });

  describe('parseCSVLine', () => {
    it('should parse simple CSV line', () => {
      const service = accountService as any;
      const result = service.parseCSVLine('a,b,c');
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should handle quoted values', () => {
      const service = accountService as any;
      const result = service.parseCSVLine('"a,b",c,"d"');
      expect(result).toEqual(['a,b', 'c', 'd']);
    });

    it('should handle empty values', () => {
      const service = accountService as any;
      const result = service.parseCSVLine('a,,c');
      expect(result).toEqual(['a', '', 'c']);
    });

    it('should trim whitespace', () => {
      const service = accountService as any;
      const result = service.parseCSVLine(' a , b , c ');
      expect(result).toEqual(['a', 'b', 'c']);
    });
  });
});