import { MatrixManager } from '../../matrix/manager';
import pino from 'pino';

const logger = pino({
  name: 'matrix-service',
  level: process.env.LOG_LEVEL || 'info'
});

export interface Matrix {
  id: string;
  name: string;
  description?: string;
  config?: {
    maxConcurrentUploads?: number;
    retryAttempts?: number;
    retryDelay?: number;
    dailyUploadLimit?: number;
    priority?: 'low' | 'normal' | 'high';
  };
  metadata?: Record<string, any>;
  status: 'active' | 'paused' | 'disabled';
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export class MatrixService {
  private matrices: Map<string, Matrix> = new Map();

  constructor(private matrixManager: MatrixManager) {
    // Initialize with default matrix if exists
    this.initializeDefaultMatrix();
  }

  private async initializeDefaultMatrix() {
    try {
      // Create a default matrix if none exists
      const defaultMatrix: Matrix = {
        id: 'default',
        name: 'Default Matrix',
        description: 'Default upload matrix',
        config: {
          maxConcurrentUploads: 3,
          retryAttempts: 3,
          retryDelay: 5000,
          priority: 'normal'
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.matrices.set(defaultMatrix.id, defaultMatrix);
    } catch (error) {
      logger.error({ error }, 'Failed to initialize default matrix');
    }
  }

  /**
   * Create a new matrix
   */
  async create(matrixData: Matrix): Promise<Matrix> {
    try {
      this.matrices.set(matrixData.id, matrixData);
      
      // Update matrix manager configuration if needed
      if (matrixData.config) {
        // Apply configuration to the matrix manager
        // This would integrate with the existing MatrixManager
      }

      return matrixData;
    } catch (error) {
      logger.error({ error }, 'Failed to create matrix');
      throw error;
    }
  }

  /**
   * Find all matrices with pagination and filtering
   */
  async findAll(options: PaginationOptions): Promise<PaginatedResult<Matrix>> {
    try {
      let matrices = Array.from(this.matrices.values());

      // Apply search filter
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        matrices = matrices.filter(matrix => 
          matrix.name.toLowerCase().includes(searchLower) ||
          matrix.description?.toLowerCase().includes(searchLower)
        );
      }

      // Apply sorting
      const sortBy = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder || 'desc';
      
      matrices.sort((a, b) => {
        let aVal: any = a[sortBy as keyof Matrix];
        let bVal: any = b[sortBy as keyof Matrix];

        if (aVal instanceof Date) {
          aVal = aVal.getTime();
        }
        if (bVal instanceof Date) {
          bVal = bVal.getTime();
        }

        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });

      // Apply pagination
      const total = matrices.length;
      const totalPages = Math.ceil(total / options.pageSize);
      const startIndex = (options.page - 1) * options.pageSize;
      const endIndex = startIndex + options.pageSize;
      const paginatedItems = matrices.slice(startIndex, endIndex);

      return {
        items: paginatedItems,
        page: options.page,
        pageSize: options.pageSize,
        total,
        totalPages
      };
    } catch (error) {
      logger.error({ error }, 'Failed to find matrices');
      throw error;
    }
  }

  /**
   * Find a matrix by ID
   */
  async findById(id: string): Promise<Matrix | undefined> {
    return this.matrices.get(id);
  }

  /**
   * Update a matrix
   */
  async update(id: string, updates: Partial<Matrix>): Promise<Matrix | undefined> {
    try {
      const matrix = this.matrices.get(id);
      if (!matrix) {
        return undefined;
      }

      const updatedMatrix = {
        ...matrix,
        ...updates,
        id: matrix.id, // Prevent ID from being changed
        createdAt: matrix.createdAt, // Preserve creation date
        updatedAt: new Date()
      };

      this.matrices.set(id, updatedMatrix);

      // Update matrix manager configuration if needed
      if (updates.config) {
        // Apply configuration changes to the matrix manager
      }

      return updatedMatrix;
    } catch (error) {
      logger.error({ error }, 'Failed to update matrix');
      throw error;
    }
  }

  /**
   * Delete a matrix
   */
  async delete(id: string): Promise<boolean> {
    try {
      // Don't allow deletion of default matrix
      if (id === 'default') {
        throw new Error('Cannot delete default matrix');
      }

      return this.matrices.delete(id);
    } catch (error) {
      logger.error({ error }, 'Failed to delete matrix');
      throw error;
    }
  }

  /**
   * Get matrix statistics
   */
  async getStats(id: string): Promise<any> {
    try {
      const matrix = this.matrices.get(id);
      if (!matrix) {
        return undefined;
      }

      // Get stats from the matrix manager
      const systemStatus = await this.matrixManager.getSystemStatus();
      
      return {
        matrix: {
          id: matrix.id,
          name: matrix.name,
          status: matrix.status
        },
        stats: {
          totalAccounts: systemStatus.accounts.total,
          activeAccounts: systemStatus.accounts.active,
          queueSize: systemStatus.queue.waiting + systemStatus.queue.active,
          processedToday: systemStatus.queue.completed,
          failedToday: systemStatus.queue.failed,
          avgProcessingTime: systemStatus.metrics?.avgProcessingTime || 0,
          successRate: systemStatus.metrics?.successRate || 0
        }
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get matrix stats');
      throw error;
    }
  }

  /**
   * Start a matrix
   */
  async start(id: string): Promise<boolean> {
    try {
      const matrix = this.matrices.get(id);
      if (!matrix) {
        return false;
      }

      matrix.status = 'active';
      await this.matrixManager.resume();
      
      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to start matrix');
      throw error;
    }
  }

  /**
   * Stop a matrix
   */
  async stop(id: string): Promise<boolean> {
    try {
      const matrix = this.matrices.get(id);
      if (!matrix) {
        return false;
      }

      matrix.status = 'paused';
      await this.matrixManager.pause();
      
      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to stop matrix');
      throw error;
    }
  }
}