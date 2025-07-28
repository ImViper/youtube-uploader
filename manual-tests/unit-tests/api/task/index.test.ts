// Test for index.ts to ensure exports are correct
import * as taskModule from '../../../src/api/task/index';

describe('Task Module Exports', () => {
  it('should export TaskController', () => {
    expect(taskModule.TaskController).toBeDefined();
    expect(typeof taskModule.TaskController).toBe('function');
  });

  it('should export TaskService', () => {
    expect(taskModule.TaskService).toBeDefined();
    expect(typeof taskModule.TaskService).toBe('function');
  });

  it('should export createTaskRoutes', () => {
    expect(taskModule.createTaskRoutes).toBeDefined();
    expect(typeof taskModule.createTaskRoutes).toBe('function');
  });

  it('should export all expected members', () => {
    const exports = Object.keys(taskModule);
    expect(exports).toContain('TaskController');
    expect(exports).toContain('TaskService');
    expect(exports).toContain('createTaskRoutes');
    expect(exports.length).toBe(3);
  });
});