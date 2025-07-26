import express, { Express } from 'express';
import request from 'supertest';
import { createMatrixRoutes } from '../matrix.routes';
import { MatrixManager } from '../../../matrix/manager';
import { ZodError } from 'zod';

// Mock the dependencies
jest.mock('../../../matrix/manager');
jest.mock('../../../middleware/validation', () => ({
  validate: (schema: any) => {
    return (req: any, res: any, next: any) => {
      try {
        // Simple validation mock that checks required fields
        if (schema.body && req.body) {
          const requiredFields = ['name']; // Simplified for testing
          for (const field of requiredFields) {
            if (schema.body && !req.body[field]) {
              throw new Error(`${field} is required`);
            }
          }
        }
        next();
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : 'Validation error' });
      }
    };
  },
}));

jest.mock('../../../validation/schemas', () => ({
  createMatrixSchema: { body: { name: 'required' } },
  updateMatrixSchema: { body: {} },
  paginationSchema: { query: {} },
}));

describe('Matrix Routes', () => {
  let app: Express;
  let mockMatrixManager: jest.Mocked<MatrixManager>;

  beforeEach(() => {
    // Create mock MatrixManager
    mockMatrixManager = {
      getSystemStatus: jest.fn().mockResolvedValue({
        accounts: { total: 10, active: 8, inactive: 2 },
        queue: { 
          waiting: 3,
          active: 2,
          completed: 100,
          failed: 2,
          delayed: 0,
          paused: false 
        },
        browserPool: {
          total: 5,
          available: 3,
          busy: 2,
          error: 0,
        },
        metrics: { 
          avgProcessingTime: 120, 
          successRate: 0.98 
        },
        initialized: true,
        timestamp: new Date(),
      }),
      pause: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Set up Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/matrix', createMatrixRoutes(mockMatrixManager));
  });

  describe('POST /api/matrix', () => {
    it('should create a new matrix', async () => {
      const newMatrix = {
        name: 'Test Matrix',
        description: 'Test description',
      };

      const response = await request(app)
        .post('/api/matrix')
        .send(newMatrix)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String),
          name: 'Test Matrix',
          description: 'Test description',
          status: 'active',
        }),
      });
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/matrix')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/matrix', () => {
    it('should get all matrices with default pagination', async () => {
      const response = await request(app)
        .get('/api/matrix')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.any(Array),
        pagination: expect.objectContaining({
          page: expect.any(Number),
          pageSize: expect.any(Number),
          total: expect.any(Number),
          totalPages: expect.any(Number),
        }),
      });
    });

    it('should accept query parameters', async () => {
      const response = await request(app)
        .get('/api/matrix')
        .query({
          page: 2,
          pageSize: 5,
          sortBy: 'name',
          sortOrder: 'asc',
          search: 'test',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/matrix/:id', () => {
    beforeEach(async () => {
      // Create a matrix first
      await request(app)
        .post('/api/matrix')
        .send({ name: 'Test Matrix' });
    });

    it('should get a single matrix', async () => {
      const response = await request(app)
        .get('/api/matrix/default')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          id: 'default',
          name: 'Default Matrix',
        }),
      });
    });

    it('should return 404 for non-existent matrix', async () => {
      const response = await request(app)
        .get('/api/matrix/non-existent')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Matrix not found',
      });
    });
  });

  describe('PUT /api/matrix/:id', () => {
    it('should update a matrix', async () => {
      const updates = {
        name: 'Updated Matrix',
        description: 'Updated description',
      };

      const response = await request(app)
        .put('/api/matrix/default')
        .send(updates)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          id: 'default',
          name: 'Updated Matrix',
          description: 'Updated description',
        }),
      });
    });

    it('should return 404 for non-existent matrix', async () => {
      const response = await request(app)
        .put('/api/matrix/non-existent')
        .send({ name: 'New Name' })
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Matrix not found',
      });
    });
  });

  describe('DELETE /api/matrix/:id', () => {
    beforeEach(async () => {
      // Create a test matrix
      await request(app)
        .post('/api/matrix')
        .send({ name: 'Delete Test' });
    });

    it('should delete a matrix', async () => {
      // First get the created matrix ID
      const listResponse = await request(app).get('/api/matrix');
      const testMatrix = listResponse.body.data.find((m: any) => m.name === 'Delete Test');

      const response = await request(app)
        .delete(`/api/matrix/${testMatrix.id}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Matrix deleted successfully',
      });
    });

    it('should not allow deletion of default matrix', async () => {
      const response = await request(app)
        .delete('/api/matrix/default')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to delete matrix',
      });
    });

    it('should return 404 for non-existent matrix', async () => {
      const response = await request(app)
        .delete('/api/matrix/non-existent')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Matrix not found',
      });
    });
  });

  describe('GET /api/matrix/:id/stats', () => {
    it('should get matrix statistics', async () => {
      const response = await request(app)
        .get('/api/matrix/default/stats')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          matrix: expect.objectContaining({
            id: 'default',
            name: 'Default Matrix',
            status: 'active',
          }),
          stats: expect.objectContaining({
            totalAccounts: 10,
            activeAccounts: 8,
            queueSize: 5, // waiting + active = 3 + 2
            processedToday: 100,
            failedToday: 2,
            avgProcessingTime: 120,
            successRate: 0.98,
          }),
        }),
      });
    });

    it('should return 404 for non-existent matrix', async () => {
      const response = await request(app)
        .get('/api/matrix/non-existent/stats')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Matrix not found',
      });
    });
  });

  describe('POST /api/matrix/:id/start', () => {
    it('should start a matrix', async () => {
      const response = await request(app)
        .post('/api/matrix/default/start')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Matrix started successfully',
      });
      expect(mockMatrixManager.resume).toHaveBeenCalled();
    });

    it('should return 404 for non-existent matrix', async () => {
      const response = await request(app)
        .post('/api/matrix/non-existent/start')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Matrix not found',
      });
    });
  });

  describe('POST /api/matrix/:id/stop', () => {
    it('should stop a matrix', async () => {
      const response = await request(app)
        .post('/api/matrix/default/stop')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Matrix stopped successfully',
      });
      expect(mockMatrixManager.pause).toHaveBeenCalled();
    });

    it('should return 404 for non-existent matrix', async () => {
      const response = await request(app)
        .post('/api/matrix/non-existent/stop')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Matrix not found',
      });
    });
  });

  describe('Route parameters validation', () => {
    it('should validate matrix ID parameter', async () => {
      const response = await request(app)
        .get('/api/matrix/')
        .expect(200); // This should list all matrices, not error

      expect(response.body.success).toBe(true);
    });

    it('should handle missing required parameters', async () => {
      // Try to access a route that requires an ID without providing one
      const response = await request(app)
        .get('/api/matrix//stats')
        .expect(404); // Express will return 404 for invalid route

      // The response will be from Express, not our handler
      expect(response.status).toBe(404);
    });
  });

  describe('Error handling', () => {
    it('should handle internal server errors gracefully', async () => {
      // Mock the MatrixManager to throw an error
      mockMatrixManager.getSystemStatus.mockRejectedValueOnce(new Error('Internal error'));

      const response = await request(app)
        .get('/api/matrix/default/stats')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to get matrix stats',
      });
    });

    it('should handle JSON parsing errors', async () => {
      const response = await request(app)
        .post('/api/matrix')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      // Express will handle JSON parsing errors
      expect(response.status).toBe(400);
    });
  });
});