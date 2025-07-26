import { MatrixService, Matrix, PaginationOptions } from '../matrix.service';
import { MatrixManager } from '../../../matrix/manager';

describe('MatrixService', () => {
  let matrixService: MatrixService;
  let mockMatrixManager: jest.Mocked<MatrixManager>;

  beforeEach(() => {
    // Create a mock MatrixManager
    mockMatrixManager = {
      getSystemStatus: jest.fn().mockResolvedValue({
        accounts: {
          total: 10,
          active: 8,
          inactive: 2,
        },
        queue: {
          waiting: 3,
          active: 2,
          completed: 100,
          failed: 2,
          delayed: 0,
          paused: false,
        },
        browserPool: {
          total: 5,
          available: 3,
          busy: 2,
          error: 0,
        },
        metrics: {
          avgProcessingTime: 120,
          successRate: 0.98,
        },
        initialized: true,
        timestamp: new Date(),
      }),
      pause: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
    } as any;

    matrixService = new MatrixService(mockMatrixManager);
  });

  describe('initializeDefaultMatrix', () => {
    it('should create a default matrix on initialization', async () => {
      const defaultMatrix = await matrixService.findById('default');
      
      expect(defaultMatrix).toBeDefined();
      expect(defaultMatrix?.id).toBe('default');
      expect(defaultMatrix?.name).toBe('Default Matrix');
      expect(defaultMatrix?.status).toBe('active');
      expect(defaultMatrix?.config).toEqual({
        maxConcurrentUploads: 3,
        retryAttempts: 3,
        retryDelay: 5000,
        priority: 'normal',
      });
    });
  });

  describe('create', () => {
    it('should create a new matrix', async () => {
      const newMatrix: Matrix = {
        id: 'test-matrix',
        name: 'Test Matrix',
        description: 'Test description',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const created = await matrixService.create(newMatrix);
      
      expect(created).toEqual(newMatrix);
      expect(await matrixService.findById('test-matrix')).toEqual(newMatrix);
    });

    it('should create matrix with custom config', async () => {
      const newMatrix: Matrix = {
        id: 'custom-matrix',
        name: 'Custom Matrix',
        config: {
          maxConcurrentUploads: 5,
          retryAttempts: 5,
          retryDelay: 10000,
          dailyUploadLimit: 100,
          priority: 'high',
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const created = await matrixService.create(newMatrix);
      
      expect(created.config).toEqual(newMatrix.config);
    });

    it('should handle creation errors', async () => {
      const invalidMatrix = null as any;

      await expect(matrixService.create(invalidMatrix)).rejects.toThrow();
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      // Add test matrices
      const matrices: Matrix[] = [
        {
          id: 'matrix-1',
          name: 'Alpha Matrix',
          description: 'First test matrix',
          status: 'active',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'matrix-2',
          name: 'Beta Matrix',
          description: 'Second test matrix',
          status: 'paused',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
        {
          id: 'matrix-3',
          name: 'Gamma Matrix',
          description: 'Third test matrix',
          status: 'disabled',
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-03'),
        },
      ];

      for (const matrix of matrices) {
        await matrixService.create(matrix);
      }
    });

    it('should return paginated results', async () => {
      const options: PaginationOptions = {
        page: 1,
        pageSize: 2,
      };

      const result = await matrixService.findAll(options);
      
      expect(result.items).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.total).toBe(4); // 3 + default
      expect(result.totalPages).toBe(2);
    });

    it('should handle pagination correctly', async () => {
      const page1 = await matrixService.findAll({ page: 1, pageSize: 2 });
      const page2 = await matrixService.findAll({ page: 2, pageSize: 2 });
      
      expect(page1.items).toHaveLength(2);
      expect(page2.items).toHaveLength(2);
      expect(page1.items[0].id).not.toBe(page2.items[0].id);
    });

    it('should filter by search term', async () => {
      const options: PaginationOptions = {
        page: 1,
        pageSize: 10,
        search: 'Beta',
      };

      const result = await matrixService.findAll(options);
      
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Beta Matrix');
    });

    it('should search in description as well', async () => {
      const options: PaginationOptions = {
        page: 1,
        pageSize: 10,
        search: 'Second',
      };

      const result = await matrixService.findAll(options);
      
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Beta Matrix');
    });

    it('should sort by name ascending', async () => {
      const options: PaginationOptions = {
        page: 1,
        pageSize: 10,
        sortBy: 'name',
        sortOrder: 'asc',
      };

      const result = await matrixService.findAll(options);
      
      expect(result.items[0].name).toBe('Alpha Matrix');
      expect(result.items[1].name).toBe('Beta Matrix');
      expect(result.items[2].name).toBe('Default Matrix');
      expect(result.items[3].name).toBe('Gamma Matrix');
    });

    it('should sort by createdAt descending by default', async () => {
      const options: PaginationOptions = {
        page: 1,
        pageSize: 10,
      };

      const result = await matrixService.findAll(options);
      
      const dates = result.items.map(item => item.createdAt.getTime());
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
    });

    it('should handle empty results', async () => {
      const options: PaginationOptions = {
        page: 1,
        pageSize: 10,
        search: 'NonExistent',
      };

      const result = await matrixService.findAll(options);
      
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('findById', () => {
    it('should find matrix by id', async () => {
      const matrix: Matrix = {
        id: 'find-test',
        name: 'Find Test',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await matrixService.create(matrix);
      const found = await matrixService.findById('find-test');
      
      expect(found).toEqual(matrix);
    });

    it('should return undefined for non-existent matrix', async () => {
      const found = await matrixService.findById('non-existent');
      
      expect(found).toBeUndefined();
    });
  });

  describe('update', () => {
    let testMatrix: Matrix;

    beforeEach(async () => {
      testMatrix = {
        id: 'update-test',
        name: 'Update Test',
        description: 'Original description',
        status: 'active',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };
      await matrixService.create(testMatrix);
    });

    it('should update matrix properties', async () => {
      const updates = {
        name: 'Updated Name',
        description: 'Updated description',
        status: 'paused' as const,
      };

      const updated = await matrixService.update('update-test', updates);
      
      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.description).toBe('Updated description');
      expect(updated?.status).toBe('paused');
    });

    it('should preserve id and createdAt', async () => {
      const updates = {
        id: 'different-id',
        createdAt: new Date('2025-01-01'),
        name: 'Updated',
      };

      const updated = await matrixService.update('update-test', updates);
      
      expect(updated?.id).toBe('update-test');
      expect(updated?.createdAt).toEqual(testMatrix.createdAt);
    });

    it('should update updatedAt timestamp', async () => {
      const beforeUpdate = testMatrix.updatedAt;
      
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      
      const updated = await matrixService.update('update-test', { name: 'New Name' });
      
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(beforeUpdate.getTime());
    });

    it('should update config', async () => {
      const updates = {
        config: {
          maxConcurrentUploads: 10,
          retryAttempts: 5,
          retryDelay: 15000,
          priority: 'high' as const,
        },
      };

      const updated = await matrixService.update('update-test', updates);
      
      expect(updated?.config).toEqual(updates.config);
    });

    it('should return undefined for non-existent matrix', async () => {
      const updated = await matrixService.update('non-existent', { name: 'New' });
      
      expect(updated).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('should delete matrix', async () => {
      const matrix: Matrix = {
        id: 'delete-test',
        name: 'Delete Test',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await matrixService.create(matrix);
      const deleted = await matrixService.delete('delete-test');
      
      expect(deleted).toBe(true);
      expect(await matrixService.findById('delete-test')).toBeUndefined();
    });

    it('should return false for non-existent matrix', async () => {
      const deleted = await matrixService.delete('non-existent');
      
      expect(deleted).toBe(false);
    });

    it('should not allow deletion of default matrix', async () => {
      await expect(matrixService.delete('default')).rejects.toThrow('Cannot delete default matrix');
    });
  });

  describe('getStats', () => {
    it('should return matrix statistics', async () => {
      const matrix: Matrix = {
        id: 'stats-test',
        name: 'Stats Test',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await matrixService.create(matrix);
      const stats = await matrixService.getStats('stats-test');
      
      expect(stats).toBeDefined();
      expect(stats.matrix).toEqual({
        id: 'stats-test',
        name: 'Stats Test',
        status: 'active',
      });
      expect(stats.stats).toEqual({
        totalAccounts: 10,
        activeAccounts: 8,
        queueSize: 5,
        processedToday: 100,
        failedToday: 2,
        avgProcessingTime: 120,
        successRate: 0.98,
      });
      expect(mockMatrixManager.getSystemStatus).toHaveBeenCalled();
    });

    it('should return undefined for non-existent matrix', async () => {
      const stats = await matrixService.getStats('non-existent');
      
      expect(stats).toBeUndefined();
    });
  });

  describe('start', () => {
    it('should start matrix and resume manager', async () => {
      const matrix: Matrix = {
        id: 'start-test',
        name: 'Start Test',
        status: 'paused',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await matrixService.create(matrix);
      const result = await matrixService.start('start-test');
      
      expect(result).toBe(true);
      expect(mockMatrixManager.resume).toHaveBeenCalled();
      
      const updated = await matrixService.findById('start-test');
      expect(updated?.status).toBe('active');
    });

    it('should return false for non-existent matrix', async () => {
      const result = await matrixService.start('non-existent');
      
      expect(result).toBe(false);
      expect(mockMatrixManager.resume).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should stop matrix and pause manager', async () => {
      const matrix: Matrix = {
        id: 'stop-test',
        name: 'Stop Test',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await matrixService.create(matrix);
      const result = await matrixService.stop('stop-test');
      
      expect(result).toBe(true);
      expect(mockMatrixManager.pause).toHaveBeenCalled();
      
      const updated = await matrixService.findById('stop-test');
      expect(updated?.status).toBe('paused');
    });

    it('should return false for non-existent matrix', async () => {
      const result = await matrixService.stop('non-existent');
      
      expect(result).toBe(false);
      expect(mockMatrixManager.pause).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle errors in getStats', async () => {
      mockMatrixManager.getSystemStatus.mockRejectedValueOnce(new Error('System error'));
      
      const matrix: Matrix = {
        id: 'error-test',
        name: 'Error Test',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await matrixService.create(matrix);
      
      await expect(matrixService.getStats('error-test')).rejects.toThrow('System error');
    });

    it('should handle errors in start', async () => {
      mockMatrixManager.resume.mockRejectedValueOnce(new Error('Resume error'));
      
      const matrix: Matrix = {
        id: 'error-test',
        name: 'Error Test',
        status: 'paused',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await matrixService.create(matrix);
      
      await expect(matrixService.start('error-test')).rejects.toThrow('Resume error');
    });

    it('should handle errors in stop', async () => {
      mockMatrixManager.pause.mockRejectedValueOnce(new Error('Pause error'));
      
      const matrix: Matrix = {
        id: 'error-test',
        name: 'Error Test',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await matrixService.create(matrix);
      
      await expect(matrixService.stop('error-test')).rejects.toThrow('Pause error');
    });
  });
});