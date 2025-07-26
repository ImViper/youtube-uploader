import { Server as HttpServer, createServer } from 'http';
import { io as ioclient, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { WebSocketManager, initializeWebSocket } from './websocket';

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }));
});

// Helper to wait for socket events
const waitForEvent = (socket: ClientSocket, event: string, timeout = 1000): Promise<any> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);

    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
};

describe('WebSocket Integration Tests', () => {
  let httpServer: HttpServer;
  let wsManager: WebSocketManager;
  let clientSocket: ClientSocket;
  let port: number;
  let heartbeatInterval: NodeJS.Timeout;

  const JWT_SECRET = 'test-secret-key';
  const validToken = jwt.sign(
    { id: '123', username: 'testuser', role: 'user' },
    JWT_SECRET
  );

  beforeAll((done) => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'silent';
    process.env.FRONTEND_URL = 'http://localhost:3000';

    // Create HTTP server
    httpServer = createServer();
    
    // Get a random port
    httpServer.listen(0, () => {
      const address = httpServer.address();
      port = typeof address === 'object' ? address!.port : 3000;
      
      // Initialize WebSocket manager
      wsManager = initializeWebSocket(httpServer);
      
      // Store heartbeat interval reference
      const wsManagerAny = wsManager as any;
      if (wsManagerAny.heartbeatInterval) {
        heartbeatInterval = wsManagerAny.heartbeatInterval;
      }
      
      done();
    });
  });

  beforeEach((done) => {
    // Ensure we start with a clean state
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    clientSocket = null as any;
    // Give the server time to clean up
    setTimeout(done, 50);
  });

  afterEach((done) => {
    // Disconnect client if connected
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
      // Wait a bit for the server to process the disconnect
      setTimeout(done, 100);
    } else {
      done();
    }
  });

  afterAll((done) => {
    // Clear heartbeat interval if it exists
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    
    // Clear any intervals created by the WebSocketManager
    const wsManagerAny = wsManager as any;
    if (wsManagerAny.heartbeatInterval) {
      clearInterval(wsManagerAny.heartbeatInterval);
    }
    
    // Close server
    httpServer.close(() => {
      // Clear singleton
      (global as any).wsManager = null;
      done();
    });
  });

  describe('Authentication Flow', () => {
    it('should successfully authenticate with valid token', async () => {
      clientSocket = ioclient(`http://localhost:${port}`, {
        auth: { token: validToken },
        transports: ['websocket'],
      });

      await waitForEvent(clientSocket, 'connect');
      expect(clientSocket.connected).toBe(true);
    });

    it('should reject invalid authentication', async () => {
      clientSocket = ioclient(`http://localhost:${port}`, {
        auth: { token: 'invalid-token' },
        transports: ['websocket'],
      });

      const error = await waitForEvent(clientSocket, 'connect_error');
      expect(error.message).toContain('Invalid token');
    });

    it('should allow dev token in development mode', async () => {
      process.env.NODE_ENV = 'development';
      
      clientSocket = ioclient(`http://localhost:${port}`, {
        auth: { token: 'dev-token' },
        transports: ['websocket'],
      });

      await waitForEvent(clientSocket, 'connect');
      expect(clientSocket.connected).toBe(true);
      
      process.env.NODE_ENV = 'test';
    });
  });

  describe('Subscription and Event Flow', () => {
    beforeEach(async () => {
      clientSocket = ioclient(`http://localhost:${port}`, {
        auth: { token: validToken },
        transports: ['websocket'],
      });

      await waitForEvent(clientSocket, 'connect');
    });

    it('should handle upload subscription and receive events', async () => {
      // Subscribe to uploads
      clientSocket.emit('subscribe:uploads');
      
      // Wait a bit for subscription to be processed
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify subscription
      const summary = wsManager.getSubscriptionsSummary();
      expect(summary.uploads).toBe(1);
      
      // Set up event listener
      const progressPromise = waitForEvent(clientSocket, 'upload:progress');
      
      // Emit progress event
      const progressData = {
        taskId: 'task-123',
        accountId: 'account-456',
        videoTitle: 'Test Video',
        progress: 50,
        stage: 'uploading',
        timestamp: new Date().toISOString(),
      };
      
      wsManager.emitUploadProgress(progressData);
      
      // Verify event received
      const receivedData = await progressPromise;
      expect(receivedData).toEqual(progressData);
    });

    it('should handle system subscription and receive metrics', async () => {
      // Subscribe to system
      clientSocket.emit('subscribe:system');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Set up event listener
      const metricsPromise = waitForEvent(clientSocket, 'system:metrics');
      
      // Emit metrics
      const metricsData = {
        cpuUsage: 45.5,
        memoryUsage: 60.2,
        activeUploads: 3,
        queuedUploads: 10,
        timestamp: new Date().toISOString(),
      };
      
      wsManager.emitSystemMetrics(metricsData);
      
      // Verify event received
      const receivedData = await metricsPromise;
      expect(receivedData).toEqual(metricsData);
    });

    it('should handle alerts subscription and receive alerts', async () => {
      // Subscribe to alerts
      clientSocket.emit('subscribe:alerts');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Set up event listener
      const alertPromise = waitForEvent(clientSocket, 'alert:new');
      
      // Emit alert
      const alertData = {
        id: 'alert-123',
        type: 'error' as const,
        title: 'System Error',
        message: 'Database connection failed',
        timestamp: new Date().toISOString(),
      };
      
      wsManager.emitAlert(alertData);
      
      // Verify event received
      const receivedData = await alertPromise;
      expect(receivedData).toEqual(alertData);
    });

    it('should handle unsubscription correctly', async () => {
      // Subscribe first
      clientSocket.emit('subscribe:uploads');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      let summary = wsManager.getSubscriptionsSummary();
      expect(summary.uploads).toBe(1);
      
      // Unsubscribe
      clientSocket.emit('unsubscribe:uploads');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      summary = wsManager.getSubscriptionsSummary();
      expect(summary.uploads).toBe(0);
    });

    it('should receive system notifications without subscription', async () => {
      // System notifications are broadcast to all clients
      const notificationPromise = waitForEvent(clientSocket, 'system:notification');
      
      const notificationData = {
        type: 'info' as const,
        title: 'System Update',
        message: 'Maintenance scheduled',
        timestamp: new Date().toISOString(),
      };
      
      wsManager.emitSystemNotification(notificationData);
      
      const receivedData = await notificationPromise;
      expect(receivedData).toEqual(notificationData);
    });
  });

  describe('Connection Management', () => {
    it('should track multiple client connections', async () => {
      expect(wsManager.getConnectedCount()).toBe(0);
      
      // Connect first client
      const client1 = ioclient(`http://localhost:${port}`, {
        auth: { token: validToken },
        transports: ['websocket'],
      });
      
      await waitForEvent(client1, 'connect');
      expect(wsManager.getConnectedCount()).toBe(1);
      
      // Connect second client
      const client2 = ioclient(`http://localhost:${port}`, {
        auth: { token: validToken },
        transports: ['websocket'],
      });
      
      await waitForEvent(client2, 'connect');
      expect(wsManager.getConnectedCount()).toBe(2);
      
      // Disconnect first client
      client1.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(wsManager.getConnectedCount()).toBe(1);
      
      // Disconnect second client
      client2.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(wsManager.getConnectedCount()).toBe(0);
    });

    it('should handle multiple subscriptions per client', async () => {
      clientSocket = ioclient(`http://localhost:${port}`, {
        auth: { token: validToken },
        transports: ['websocket'],
      });

      await waitForEvent(clientSocket, 'connect');
      
      // Subscribe to multiple channels
      clientSocket.emit('subscribe:uploads');
      clientSocket.emit('subscribe:system');
      clientSocket.emit('subscribe:alerts');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const summary = wsManager.getSubscriptionsSummary();
      expect(summary.uploads).toBe(1);
      expect(summary.system).toBe(1);
      expect(summary.alerts).toBe(1);
    });
  });

  describe('Additional Event Types', () => {
    beforeEach(async () => {
      clientSocket = ioclient(`http://localhost:${port}`, {
        auth: { token: validToken },
        transports: ['websocket'],
      });

      await waitForEvent(clientSocket, 'connect');
    });

    it('should emit and receive task status changes', async () => {
      clientSocket.emit('subscribe:uploads');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const statusChangePromise = waitForEvent(clientSocket, 'task:statusChange');
      
      const statusData = {
        taskId: 'task-123',
        accountId: 'account-456',
        videoTitle: 'Test Video',
        oldStatus: 'pending',
        newStatus: 'processing',
        timestamp: new Date().toISOString(),
      };
      
      wsManager.emitTaskStatusChange(statusData);
      
      const receivedData = await statusChangePromise;
      expect(receivedData).toEqual(statusData);
    });

    it('should emit and receive queue status updates', async () => {
      clientSocket.emit('subscribe:system');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const queuePromise = waitForEvent(clientSocket, 'queue:status');
      
      const queueData = {
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        timestamp: new Date().toISOString(),
      };
      
      wsManager.emitQueueStatus(queueData);
      
      const receivedData = await queuePromise;
      expect(receivedData).toEqual(queueData);
    });

    it('should emit and receive log entries', async () => {
      clientSocket.emit('subscribe:system');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const logPromise = waitForEvent(clientSocket, 'system:log');
      
      const logData = {
        level: 'info',
        message: 'Test log message',
        timestamp: new Date().toISOString(),
        context: { module: 'test' },
      };
      
      wsManager.emitLogEntry(logData);
      
      const receivedData = await logPromise;
      expect(receivedData).toEqual(logData);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle reconnection after disconnect', async () => {
      clientSocket = ioclient(`http://localhost:${port}`, {
        auth: { token: validToken },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 100,
      });

      await waitForEvent(clientSocket, 'connect');
      expect(clientSocket.connected).toBe(true);
      
      // Force disconnect
      clientSocket.io.engine.close();
      
      // Wait for reconnection
      await waitForEvent(clientSocket, 'connect');
      expect(clientSocket.connected).toBe(true);
    });

    it('should not receive events after unsubscribing', async () => {
      clientSocket = ioclient(`http://localhost:${port}`, {
        auth: { token: validToken },
        transports: ['websocket'],
      });

      await waitForEvent(clientSocket, 'connect');
      
      // Subscribe and then unsubscribe
      clientSocket.emit('subscribe:uploads');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      clientSocket.emit('unsubscribe:uploads');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Set up listener that should not be called
      let eventReceived = false;
      clientSocket.on('upload:progress', () => {
        eventReceived = true;
      });
      
      // Emit event
      wsManager.emitUploadProgress({
        taskId: 'task-123',
        accountId: 'account-456',
        videoTitle: 'Test Video',
        progress: 50,
        stage: 'uploading',
        timestamp: new Date().toISOString(),
      });
      
      // Wait a bit and verify no event was received
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(eventReceived).toBe(false);
    });
  });
});