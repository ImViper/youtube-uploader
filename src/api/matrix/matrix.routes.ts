import { Router } from 'express';
import { MatrixController } from './matrix.controller';
import { MatrixService } from './matrix.service';
import { MatrixManager } from '../../matrix/manager';
import { validate } from '../../middleware/validation';
import { 
  createMatrixSchema, 
  updateMatrixSchema,
  paginationSchema 
} from '../../validation/schemas';
import { z } from 'zod';

export function createMatrixRoutes(matrixManager: MatrixManager): Router {
  const router = Router();
  const matrixService = new MatrixService(matrixManager);
  const matrixController = new MatrixController(matrixService);

  // Create a new matrix
  router.post(
    '/',
    validate({ body: createMatrixSchema }),
    (req, res) => matrixController.createMatrix(req, res)
  );

  // Get all matrices
  router.get(
    '/',
    validate({ query: paginationSchema }),
    (req, res) => matrixController.getMatrices(req, res)
  );

  // Get a single matrix
  router.get(
    '/:id',
    validate({ params: z.object({ id: z.string().min(1) }) }),
    (req, res) => matrixController.getMatrix(req, res)
  );

  // Update a matrix
  router.put(
    '/:id',
    validate({ 
      params: z.object({ id: z.string().min(1) }),
      body: updateMatrixSchema 
    }),
    (req, res) => matrixController.updateMatrix(req, res)
  );

  // Delete a matrix
  router.delete(
    '/:id',
    validate({ params: z.object({ id: z.string().min(1) }) }),
    (req, res) => matrixController.deleteMatrix(req, res)
  );

  // Get matrix statistics
  router.get(
    '/:id/stats',
    validate({ params: z.object({ id: z.string().min(1) }) }),
    (req, res) => matrixController.getMatrixStats(req, res)
  );

  // Start a matrix
  router.post(
    '/:id/start',
    validate({ params: z.object({ id: z.string().min(1) }) }),
    (req, res) => matrixController.startMatrix(req, res)
  );

  // Stop a matrix
  router.post(
    '/:id/stop',
    validate({ params: z.object({ id: z.string().min(1) }) }),
    (req, res) => matrixController.stopMatrix(req, res)
  );

  return router;
}