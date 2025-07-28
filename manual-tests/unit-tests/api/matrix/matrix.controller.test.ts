import { Request, Response } from 'express';
import { MatrixController } from '../../../src/api/matrix/matrix.controller';
import { MatrixService, Matrix, PaginatedResult } from '../../../src/api/matrix/matrix.service';
import { v4 as uuidv4 } from 'uuid';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

describe('MatrixController', () => {
  let matrixController: MatrixController;
  let mockMatrixService: jest.Mocked<MatrixService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;

  beforeEach(() => {
    // Create mock service
    mockMatrixService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getStats: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    } as any;

    // Create mock response
    responseJson = jest.fn();
    responseStatus = jest.fn(() => ({ json: responseJson }));
    mockResponse = {
      json: responseJson,
      status: responseStatus,
    };

    // Create mock request
    mockRequest = {
      body: {},
      params: {},
      query: {},
    };

    matrixController = new MatrixController(mockMatrixService);
  });

  describe('createMatrix', () => {
    it('should create a new matrix successfully', async () => {
      const requestBody = {
        name: 'Test Matrix',
        description: 'Test description',
      };

      const expectedMatrix: Matrix = {
        id: 'test-uuid',
        name: 'Test Matrix',
        description: 'Test description',
        status: 'active',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      };

      mockRequest.body = requestBody;
      mockMatrixService.create.mockResolvedValue(expectedMatrix);

      await matrixController.createMatrix(mockRequest as Request, mockResponse as Response);

      expect(mockMatrixService.create).toHaveBeenCalledWith({
        id: 'test-uuid',
        ...requestBody,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        status: 'active',
      });

      expect(responseStatus).toHaveBeenCalledWith(201);
      expect(responseJson).toHaveBeenCalledWith({
        success: true,
        data: expectedMatrix,
      });
    });

    it('should handle creation errors', async () => {
      mockRequest.body = { name: 'Test' };
      mockMatrixService.create.mockRejectedValue(new Error('Creation failed'));

      await matrixController.createMatrix(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to create matrix',
      });
    });
  });

  describe('getMatrices', () => {
    it('should get matrices with pagination', async () => {
      const mockQuery = {
        page: '1',
        pageSize: '10',
        sortBy: 'name',
        sortOrder: 'asc',
        search: 'test',
      };

      const mockResult: PaginatedResult<Matrix> = {
        items: [
          {
            id: '1',
            name: 'Matrix 1',
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      };

      mockRequest.query = mockQuery;
      mockMatrixService.findAll.mockResolvedValue(mockResult);

      await matrixController.getMatrices(mockRequest as Request, mockResponse as Response);

      expect(mockMatrixService.findAll).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        sortBy: 'name',
        sortOrder: 'asc',
        search: 'test',
      });
      expect(responseJson).toHaveBeenCalledWith({
        success: true,
        data: mockResult.items,
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
      });
    });

    it('should handle errors when getting matrices', async () => {
      mockMatrixService.findAll.mockRejectedValue(new Error('Query failed'));

      await matrixController.getMatrices(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get matrices',
      });
    });
  });

  describe('getMatrix', () => {
    it('should get a single matrix by ID', async () => {
      const mockMatrix: Matrix = {
        id: 'test-id',
        name: 'Test Matrix',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRequest.params = { id: 'test-id' };
      mockMatrixService.findById.mockResolvedValue(mockMatrix);

      await matrixController.getMatrix(mockRequest as Request, mockResponse as Response);

      expect(mockMatrixService.findById).toHaveBeenCalledWith('test-id');
      expect(responseJson).toHaveBeenCalledWith({
        success: true,
        data: mockMatrix,
      });
    });

    it('should return 404 when matrix not found', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockMatrixService.findById.mockResolvedValue(undefined);

      await matrixController.getMatrix(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        error: 'Matrix not found',
      });
    });

    it('should handle errors when getting matrix', async () => {
      mockRequest.params = { id: 'test-id' };
      mockMatrixService.findById.mockRejectedValue(new Error('Query failed'));

      await matrixController.getMatrix(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get matrix',
      });
    });
  });

  describe('updateMatrix', () => {
    it('should update a matrix successfully', async () => {
      const updates = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      const updatedMatrix: Matrix = {
        id: 'test-id',
        name: 'Updated Name',
        description: 'Updated description',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRequest.params = { id: 'test-id' };
      mockRequest.body = updates;
      mockMatrixService.update.mockResolvedValue(updatedMatrix);

      await matrixController.updateMatrix(mockRequest as Request, mockResponse as Response);

      expect(mockMatrixService.update).toHaveBeenCalledWith('test-id', {
        ...updates,
        updatedAt: expect.any(Date),
      });
      expect(responseJson).toHaveBeenCalledWith({
        success: true,
        data: updatedMatrix,
      });
    });

    it('should return 404 when matrix not found', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockRequest.body = { name: 'New Name' };
      mockMatrixService.update.mockResolvedValue(undefined);

      await matrixController.updateMatrix(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        error: 'Matrix not found',
      });
    });

    it('should handle update errors', async () => {
      mockRequest.params = { id: 'test-id' };
      mockRequest.body = { name: 'New Name' };
      mockMatrixService.update.mockRejectedValue(new Error('Update failed'));

      await matrixController.updateMatrix(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to update matrix',
      });
    });
  });

  describe('deleteMatrix', () => {
    it('should delete a matrix successfully', async () => {
      mockRequest.params = { id: 'test-id' };
      mockMatrixService.delete.mockResolvedValue(true);

      await matrixController.deleteMatrix(mockRequest as Request, mockResponse as Response);

      expect(mockMatrixService.delete).toHaveBeenCalledWith('test-id');
      expect(responseJson).toHaveBeenCalledWith({
        success: true,
        message: 'Matrix deleted successfully',
      });
    });

    it('should return 404 when matrix not found', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockMatrixService.delete.mockResolvedValue(false);

      await matrixController.deleteMatrix(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        error: 'Matrix not found',
      });
    });

    it('should handle deletion errors', async () => {
      mockRequest.params = { id: 'test-id' };
      mockMatrixService.delete.mockRejectedValue(new Error('Delete failed'));

      await matrixController.deleteMatrix(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to delete matrix',
      });
    });
  });

  describe('getMatrixStats', () => {
    it('should get matrix statistics successfully', async () => {
      const mockStats = {
        matrix: {
          id: 'test-id',
          name: 'Test Matrix',
          status: 'active',
        },
        stats: {
          totalAccounts: 10,
          activeAccounts: 8,
          queueSize: 5,
          processedToday: 100,
          failedToday: 2,
          avgProcessingTime: 120,
          successRate: 0.98,
        },
      };

      mockRequest.params = { id: 'test-id' };
      mockMatrixService.getStats.mockResolvedValue(mockStats);

      await matrixController.getMatrixStats(mockRequest as Request, mockResponse as Response);

      expect(mockMatrixService.getStats).toHaveBeenCalledWith('test-id');
      expect(responseJson).toHaveBeenCalledWith({
        success: true,
        data: mockStats,
      });
    });

    it('should return 404 when matrix not found', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockMatrixService.getStats.mockResolvedValue(undefined);

      await matrixController.getMatrixStats(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        error: 'Matrix not found',
      });
    });

    it('should handle stats errors', async () => {
      mockRequest.params = { id: 'test-id' };
      mockMatrixService.getStats.mockRejectedValue(new Error('Stats failed'));

      await matrixController.getMatrixStats(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get matrix stats',
      });
    });
  });

  describe('startMatrix', () => {
    it('should start a matrix successfully', async () => {
      mockRequest.params = { id: 'test-id' };
      mockMatrixService.start.mockResolvedValue(true);

      await matrixController.startMatrix(mockRequest as Request, mockResponse as Response);

      expect(mockMatrixService.start).toHaveBeenCalledWith('test-id');
      expect(responseJson).toHaveBeenCalledWith({
        success: true,
        message: 'Matrix started successfully',
      });
    });

    it('should return 404 when matrix not found', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockMatrixService.start.mockResolvedValue(false);

      await matrixController.startMatrix(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        error: 'Matrix not found',
      });
    });

    it('should handle start errors', async () => {
      mockRequest.params = { id: 'test-id' };
      mockMatrixService.start.mockRejectedValue(new Error('Start failed'));

      await matrixController.startMatrix(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to start matrix',
      });
    });
  });

  describe('stopMatrix', () => {
    it('should stop a matrix successfully', async () => {
      mockRequest.params = { id: 'test-id' };
      mockMatrixService.stop.mockResolvedValue(true);

      await matrixController.stopMatrix(mockRequest as Request, mockResponse as Response);

      expect(mockMatrixService.stop).toHaveBeenCalledWith('test-id');
      expect(responseJson).toHaveBeenCalledWith({
        success: true,
        message: 'Matrix stopped successfully',
      });
    });

    it('should return 404 when matrix not found', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockMatrixService.stop.mockResolvedValue(false);

      await matrixController.stopMatrix(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        error: 'Matrix not found',
      });
    });

    it('should handle stop errors', async () => {
      mockRequest.params = { id: 'test-id' };
      mockMatrixService.stop.mockRejectedValue(new Error('Stop failed'));

      await matrixController.stopMatrix(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to stop matrix',
      });
    });
  });
});