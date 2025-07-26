import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import pino from 'pino';

const logger = pino({
  name: 'websocket',
  level: process.env.LOG_LEVEL || 'info'
});

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

export interface WebSocketEvents {
  // Client -> Server
  'subscribe:uploads': () => void;
  'subscribe:system': () => void;
  'subscribe:alerts': () => void;
  'unsubscribe:uploads': () => void;
  'unsubscribe:system': () => void;
  'unsubscribe:alerts': () => void;
  
  // Server -> Client
  'upload:progress': (data: UploadProgress) => void;
  'upload:complete': (data: UploadResult) => void;
  'upload:error': (data: UploadError) => void;
  'system:metrics': (data: SystemMetrics) => void;
  'alert:new': (data: Alert) => void;
  'connection:error': (error: string) => void;
}

interface UploadProgress {
  taskId: string;
  accountId: string;
  videoTitle: string;
  progress: number;
  stage: string;
  timestamp: string;
}

interface UploadResult {
  taskId: string;
  accountId: string;
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  timestamp: string;
}

interface UploadError {
  taskId: string;
  accountId: string;
  videoTitle: string;
  error: string;
  timestamp: string;
}

interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  activeUploads: number;
  queuedUploads: number;
  timestamp: string;
}

interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
}

export class WebSocketManager {
  private io: SocketIOServer;
  private connections: Map<string, any> = new Map();

  constructor(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.setupHeartbeat();
    
    logger.info('WebSocket server initialized');
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Authentication required'));
        }
        
        // Allow dev token in development
        if (process.env.NODE_ENV === 'development' && token === 'dev-token') {
          socket.data.user = {
            id: '1',
            username: 'admin',
            role: 'admin'
          };
          return next();
        }
        
        // Verify JWT token
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          socket.data.user = decoded;
          next();
        } catch (err) {
          next(new Error('Invalid token'));
        }
      } catch (error) {
        logger.error({ error }, 'WebSocket authentication error');
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const userId = socket.data.user.id;
      logger.info({ userId, socketId: socket.id }, 'Client connected');
      
      // Store connection
      this.connections.set(socket.id, {
        userId,
        socket,
        subscriptions: new Set<string>()
      });
      
      // Handle subscriptions
      socket.on('subscribe:uploads', () => {
        const conn = this.connections.get(socket.id);
        if (conn) {
          conn.subscriptions.add('uploads');
          socket.join('uploads');
          logger.debug({ userId, socketId: socket.id }, 'Subscribed to uploads');
        }
      });
      
      socket.on('subscribe:system', () => {
        const conn = this.connections.get(socket.id);
        if (conn) {
          conn.subscriptions.add('system');
          socket.join('system');
          logger.debug({ userId, socketId: socket.id }, 'Subscribed to system');
        }
      });
      
      socket.on('subscribe:alerts', () => {
        const conn = this.connections.get(socket.id);
        if (conn) {
          conn.subscriptions.add('alerts');
          socket.join('alerts');
          logger.debug({ userId, socketId: socket.id }, 'Subscribed to alerts');
        }
      });
      
      // Handle unsubscriptions
      socket.on('unsubscribe:uploads', () => {
        const conn = this.connections.get(socket.id);
        if (conn) {
          conn.subscriptions.delete('uploads');
          socket.leave('uploads');
        }
      });
      
      socket.on('unsubscribe:system', () => {
        const conn = this.connections.get(socket.id);
        if (conn) {
          conn.subscriptions.delete('system');
          socket.leave('system');
        }
      });
      
      socket.on('unsubscribe:alerts', () => {
        const conn = this.connections.get(socket.id);
        if (conn) {
          conn.subscriptions.delete('alerts');
          socket.leave('alerts');
        }
      });
      
      // Handle disconnect
      socket.on('disconnect', (reason) => {
        logger.info({ userId, socketId: socket.id, reason }, 'Client disconnected');
        this.connections.delete(socket.id);
      });
      
      // Handle errors
      socket.on('error', (error) => {
        logger.error({ userId, socketId: socket.id, error }, 'Socket error');
      });
    });
  }

  // Emit upload progress
  public emitUploadProgress(progress: UploadProgress) {
    this.io.to('uploads').emit('upload:progress', progress);
  }

  // Emit upload complete
  public emitUploadComplete(result: UploadResult) {
    this.io.to('uploads').emit('upload:complete', result);
  }

  // Emit upload error
  public emitUploadError(error: UploadError) {
    this.io.to('uploads').emit('upload:error', error);
  }

  // Emit system metrics
  public emitSystemMetrics(metrics: SystemMetrics) {
    this.io.to('system').emit('system:metrics', metrics);
  }

  // Emit new alert
  public emitAlert(alert: Alert) {
    this.io.to('alerts').emit('alert:new', alert);
  }

  // Get connected users count
  public getConnectedCount(): number {
    return this.connections.size;
  }

  // Get subscriptions summary
  public getSubscriptionsSummary(): Record<string, number> {
    const summary: Record<string, number> = {
      uploads: 0,
      system: 0,
      alerts: 0
    };
    
    for (const conn of this.connections.values()) {
      for (const sub of conn.subscriptions) {
        summary[sub] = (summary[sub] || 0) + 1;
      }
    }
    
    return summary;
  }

  // Emit task status change
  public emitTaskStatusChange(data: {
    taskId: string;
    accountId: string;
    videoTitle: string;
    oldStatus: string;
    newStatus: string;
    timestamp: string;
  }) {
    this.io.to('uploads').emit('task:statusChange', data);
  }

  // Emit system notification
  public emitSystemNotification(data: {
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
    timestamp: string;
  }) {
    this.io.emit('system:notification', data);
  }

  // Emit log entry
  public emitLogEntry(data: {
    level: string;
    message: string;
    timestamp: string;
    context?: Record<string, any>;
  }) {
    this.io.to('system').emit('system:log', data);
  }

  // Emit queue status update
  public emitQueueStatus(data: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    timestamp: string;
  }) {
    this.io.to('system').emit('queue:status', data);
  }

  // Emit account status change
  public emitAccountStatusChange(data: {
    accountId: string;
    email: string;
    oldStatus: string;
    newStatus: string;
    healthScore: number;
    timestamp: string;
  }) {
    this.io.to('system').emit('account:statusChange', data);
  }

  // Setup heartbeat mechanism
  private setupHeartbeat() {
    setInterval(() => {
      const now = Date.now();
      for (const [socketId, conn] of this.connections.entries()) {
        if (conn.lastPing && now - conn.lastPing > 60000) {
          // No ping for 60 seconds, disconnect
          logger.warn({ socketId, userId: conn.userId }, 'Client heartbeat timeout');
          conn.socket.disconnect(true);
          this.connections.delete(socketId);
        } else {
          // Send ping
          conn.socket.emit('ping', { timestamp: now });
        }
      }
    }, 30000); // Check every 30 seconds
  }
}

// Singleton instance
let wsManager: WebSocketManager | null = null;

export function initializeWebSocket(server: HttpServer): WebSocketManager {
  if (!wsManager) {
    wsManager = new WebSocketManager(server);
  }
  return wsManager;
}

export function getWebSocketManager(): WebSocketManager | null {
  return wsManager;
}