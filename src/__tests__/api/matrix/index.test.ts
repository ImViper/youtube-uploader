import * as matrixExports from '../../../api/matrix/index';
import { MatrixController } from '../../../api/matrix/matrix.controller';
import { MatrixService } from '../../../api/matrix/matrix.service';
import { createMatrixRoutes } from '../../../api/matrix/matrix.routes';

describe('Matrix Module Index', () => {
  it('should export MatrixController', () => {
    expect(matrixExports.MatrixController).toBe(MatrixController);
    expect(matrixExports.MatrixController).toBeDefined();
  });

  it('should export MatrixService', () => {
    expect(matrixExports.MatrixService).toBe(MatrixService);
    expect(matrixExports.MatrixService).toBeDefined();
  });

  it('should export createMatrixRoutes', () => {
    expect(matrixExports.createMatrixRoutes).toBe(createMatrixRoutes);
    expect(matrixExports.createMatrixRoutes).toBeDefined();
    expect(typeof matrixExports.createMatrixRoutes).toBe('function');
  });

  it('should export all required components', () => {
    const exportedKeys = Object.keys(matrixExports);
    expect(exportedKeys).toContain('MatrixController');
    expect(exportedKeys).toContain('MatrixService');
    expect(exportedKeys).toContain('createMatrixRoutes');
    expect(exportedKeys).toHaveLength(3);
  });

  it('should not export any unexpected components', () => {
    const expectedExports = ['MatrixController', 'MatrixService', 'createMatrixRoutes'];
    const actualExports = Object.keys(matrixExports);
    
    actualExports.forEach(exportName => {
      expect(expectedExports).toContain(exportName);
    });
  });
});