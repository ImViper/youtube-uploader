// Test setup file
import 'reflect-metadata';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.LOG_LEVEL = 'silent';
process.env.FRONTEND_URL = 'http://localhost:3000';

// Increase test timeout for socket tests
jest.setTimeout(10000);

// Global test utilities
global.afterEach(() => {
  jest.clearAllMocks();
});