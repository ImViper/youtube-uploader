import { WebSocketManager, initializeWebSocket, getWebSocketManager } from '../../api/websocket';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }));
});

describe('WebSocket Module - Unit Tests', () => {
  let wsManager: WebSocketManager;
  const JWT_SECRET = 'test-secret-key';

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'silent';
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return null when not initialized', () => {
      // Clear any existing instance
      (global as any).wsManager = null;
      
      const manager = getWebSocketManager();
      expect(manager).toBeNull();
    });

    it('should initialize and return singleton instance', () => {
      const httpServer = createServer();
      const manager1 = initializeWebSocket(httpServer);
      const manager2 = initializeWebSocket(httpServer);
      const manager3 = getWebSocketManager();

      expect(manager1).toBeDefined();
      expect(manager1).toBeInstanceOf(WebSocketManager);
      expect(manager2).toBe(manager1);
      expect(manager3).toBe(manager1);
    });
  });

  describe('WebSocketManager Methods', () => {
    beforeEach(() => {
      const httpServer = createServer();
      wsManager = new WebSocketManager(httpServer);
    });

    it('should emit upload progress', () => {
      const progressData = {
        taskId: 'task-123',
        accountId: 'account-456',
        videoTitle: 'Test Video',
        progress: 50,
        stage: 'uploading',
        timestamp: new Date().toISOString(),
      };

      // This should not throw
      expect(() => wsManager.emitUploadProgress(progressData)).not.toThrow();
    });

    it('should emit upload complete', () => {
      const completeData = {
        taskId: 'task-123',
        accountId: 'account-456',
        videoId: 'video-789',
        videoTitle: 'Test Video',
        videoUrl: 'https://youtube.com/watch?v=123',
        timestamp: new Date().toISOString(),
      };

      expect(() => wsManager.emitUploadComplete(completeData)).not.toThrow();
    });

    it('should emit upload error', () => {
      const errorData = {
        taskId: 'task-123',
        accountId: 'account-456',
        videoTitle: 'Test Video',
        error: 'Upload failed',
        timestamp: new Date().toISOString(),
      };

      expect(() => wsManager.emitUploadError(errorData)).not.toThrow();
    });

    it('should emit system metrics', () => {
      const metricsData = {
        cpuUsage: 45.5,
        memoryUsage: 60.2,
        activeUploads: 3,
        queuedUploads: 10,
        timestamp: new Date().toISOString(),
      };

      expect(() => wsManager.emitSystemMetrics(metricsData)).not.toThrow();
    });

    it('should emit alerts', () => {
      const alertData = {
        id: 'alert-123',
        type: 'error' as const,
        title: 'System Error',
        message: 'Database connection failed',
        timestamp: new Date().toISOString(),
      };

      expect(() => wsManager.emitAlert(alertData)).not.toThrow();
    });

    it('should emit task status change', () => {
      const statusChangeData = {
        taskId: 'task-123',
        accountId: 'account-456',
        videoTitle: 'Test Video',
        oldStatus: 'pending',
        newStatus: 'processing',
        timestamp: new Date().toISOString(),
      };

      expect(() => wsManager.emitTaskStatusChange(statusChangeData)).not.toThrow();
    });

    it('should emit system notification', () => {
      const notificationData = {
        type: 'info' as const,
        title: 'System Update',
        message: 'System will undergo maintenance',
        timestamp: new Date().toISOString(),
      };

      expect(() => wsManager.emitSystemNotification(notificationData)).not.toThrow();
    });

    it('should emit log entry', () => {
      const logData = {
        level: 'info',
        message: 'Test log message',
        timestamp: new Date().toISOString(),
        context: { key: 'value' },
      };

      expect(() => wsManager.emitLogEntry(logData)).not.toThrow();
    });

    it('should emit queue status', () => {
      const queueData = {
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        timestamp: new Date().toISOString(),
      };

      expect(() => wsManager.emitQueueStatus(queueData)).not.toThrow();
    });

    it('should emit account status change', () => {
      const accountStatusData = {
        accountId: 'account-123',
        email: 'test@example.com',
        oldStatus: 'active',
        newStatus: 'suspended',
        healthScore: 75,
        timestamp: new Date().toISOString(),
      };

      expect(() => wsManager.emitAccountStatusChange(accountStatusData)).not.toThrow();
    });

    it('should get connected count initially as 0', () => {
      expect(wsManager.getConnectedCount()).toBe(0);
    });

    it('should get empty subscriptions summary initially', () => {
      const summary = wsManager.getSubscriptionsSummary();
      expect(summary).toEqual({
        uploads: 0,
        system: 0,
        alerts: 0,
      });
    });
  });

  describe('JWT Token Validation', () => {
    it('should create valid JWT token', () => {
      const payload = { id: '123', username: 'testuser', role: 'user' };
      const token = jwt.sign(payload, JWT_SECRET);
      
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      expect(decoded.id).toBe('123');
      expect(decoded.username).toBe('testuser');
      expect(decoded.role).toBe('user');
    });

    it('should fail with invalid secret', () => {
      const payload = { id: '123', username: 'testuser', role: 'user' };
      const token = jwt.sign(payload, JWT_SECRET);
      
      expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
    });

    it('should fail with expired token', () => {
      const payload = { 
        id: '123', 
        username: 'testuser', 
        role: 'user',
        exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      };
      const token = jwt.sign(payload, JWT_SECRET);
      
      expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
    });
  });

  describe('Environment Configuration', () => {
    it('should use default JWT secret if not provided', () => {
      delete process.env.JWT_SECRET;
      const httpServer = createServer();
      const manager = new WebSocketManager(httpServer);
      
      expect(manager).toBeDefined();
      // The default secret 'dev-secret-key' is used internally
    });

    it('should use default frontend URL if not provided', () => {
      delete process.env.FRONTEND_URL;
      const httpServer = createServer();
      const manager = new WebSocketManager(httpServer);
      
      expect(manager).toBeDefined();
      // The default URL 'http://localhost:5173' is used internally
    });

    it('should use default log level if not provided', () => {
      delete process.env.LOG_LEVEL;
      const httpServer = createServer();
      const manager = new WebSocketManager(httpServer);
      
      expect(manager).toBeDefined();
      // The default log level 'info' is used internally
    });
  });
});