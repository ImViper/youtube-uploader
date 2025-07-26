import { Request, Response } from 'express';
import { MatrixService } from './matrix.service';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

const logger = pino({
  name: 'matrix-controller',
  level: process.env.LOG_LEVEL || 'info'
});

export class MatrixController {
  constructor(private matrixService: MatrixService) {}

  /**
   * Create a new matrix
   */
  async createMatrix(req: Request, res: Response) {
    try {
      const matrixData = {
        id: uuidv4(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'active'
      };

      const matrix = await this.matrixService.create(matrixData);
      
      logger.info({ matrixId: matrix.id }, 'Matrix created successfully');
      
      res.status(201).json({
        success: true,
        data: matrix
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create matrix');
      res.status(500).json({
        success: false,
        error: 'Failed to create matrix'
      });
    }
  }

  /**
   * Get all matrices with pagination and filtering
   */
  async getMatrices(req: Request, res: Response) {
    try {
      const { page, pageSize, sortBy, sortOrder, search } = req.query as any;
      
      const result = await this.matrixService.findAll({
        page: parseInt(page as string) || 1,
        pageSize: parseInt(pageSize as string) || 10,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        search: search as string
      });

      res.json({
        success: true,
        data: result.items,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get matrices');
      res.status(500).json({
        success: false,
        error: 'Failed to get matrices'
      });
    }
  }

  /**
   * Get a single matrix by ID
   */
  async getMatrix(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const matrix = await this.matrixService.findById(id);

      if (!matrix) {
        return res.status(404).json({
          success: false,
          error: 'Matrix not found'
        });
      }

      res.json({
        success: true,
        data: matrix
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get matrix');
      res.status(500).json({
        success: false,
        error: 'Failed to get matrix'
      });
    }
  }

  /**
   * Update a matrix
   */
  async updateMatrix(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = {
        ...req.body,
        updatedAt: new Date()
      };

      const matrix = await this.matrixService.update(id, updates);

      if (!matrix) {
        return res.status(404).json({
          success: false,
          error: 'Matrix not found'
        });
      }

      logger.info({ matrixId: id }, 'Matrix updated successfully');

      res.json({
        success: true,
        data: matrix
      });
    } catch (error) {
      logger.error({ error }, 'Failed to update matrix');
      res.status(500).json({
        success: false,
        error: 'Failed to update matrix'
      });
    }
  }

  /**
   * Delete a matrix
   */
  async deleteMatrix(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const deleted = await this.matrixService.delete(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Matrix not found'
        });
      }

      logger.info({ matrixId: id }, 'Matrix deleted successfully');

      res.json({
        success: true,
        message: 'Matrix deleted successfully'
      });
    } catch (error) {
      logger.error({ error }, 'Failed to delete matrix');
      res.status(500).json({
        success: false,
        error: 'Failed to delete matrix'
      });
    }
  }

  /**
   * Get matrix statistics
   */
  async getMatrixStats(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const stats = await this.matrixService.getStats(id);

      if (!stats) {
        return res.status(404).json({
          success: false,
          error: 'Matrix not found'
        });
      }

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get matrix stats');
      res.status(500).json({
        success: false,
        error: 'Failed to get matrix stats'
      });
    }
  }

  /**
   * Start a matrix
   */
  async startMatrix(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await this.matrixService.start(id);

      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Matrix not found'
        });
      }

      logger.info({ matrixId: id }, 'Matrix started successfully');

      res.json({
        success: true,
        message: 'Matrix started successfully'
      });
    } catch (error) {
      logger.error({ error }, 'Failed to start matrix');
      res.status(500).json({
        success: false,
        error: 'Failed to start matrix'
      });
    }
  }

  /**
   * Stop a matrix
   */
  async stopMatrix(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await this.matrixService.stop(id);

      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Matrix not found'
        });
      }

      logger.info({ matrixId: id }, 'Matrix stopped successfully');

      res.json({
        success: true,
        message: 'Matrix stopped successfully'
      });
    } catch (error) {
      logger.error({ error }, 'Failed to stop matrix');
      res.status(500).json({
        success: false,
        error: 'Failed to stop matrix'
      });
    }
  }
}