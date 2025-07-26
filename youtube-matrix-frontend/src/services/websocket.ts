import { io, Socket } from 'socket.io-client';
import { WS_EVENTS, STORAGE_KEYS } from '@/utils/constants';
import { showError, showWarning } from '@/utils/helpers';

class WebSocketService {
  private socket: Socket | null = null;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private eventHandlers: Map<string, Set<(...args: any[]) => void>> = new Map();

  constructor() {
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.emit = this.emit.bind(this);
    this.on = this.on.bind(this);
    this.off = this.off.bind(this);
  }

  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) {
      console.warn('No auth token found, skipping WebSocket connection');
      return;
    }

    this.socket = io(import.meta.env.VITE_WS_URL || 'ws://localhost:3000', {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on(WS_EVENTS.CONNECT, () => {
      console.log('WebSocket connected');
      this.triggerHandlers(WS_EVENTS.CONNECT);
    });

    this.socket.on(WS_EVENTS.DISCONNECT, (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.triggerHandlers(WS_EVENTS.DISCONNECT, reason);

      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't auto-reconnect
        showWarning('Disconnected', 'You have been disconnected from the server');
      }
    });

    this.socket.on(WS_EVENTS.ERROR, (error) => {
      console.error('WebSocket error:', error);
      showError('Connection Error', 'Failed to connect to the server');
      this.triggerHandlers(WS_EVENTS.ERROR, error);
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Reconnection attempt ${attemptNumber}/${this.maxReconnectAttempts}`);
    });

    this.socket.on('reconnect_failed', () => {
      showError('Connection Failed', 'Unable to reconnect to the server');
    });

    // Setup custom event handlers
    this.eventHandlers.forEach((handlers, event) => {
      handlers.forEach((handler) => {
        this.socket?.on(event, handler as any);
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, data?: any): void {
    if (!this.socket?.connected) {
      console.warn('Cannot emit event, socket not connected');
      return;
    }
    this.socket.emit(event, data);
  }

  on(event: string, handler: (...args: any[]) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    this.eventHandlers.get(event)!.add(handler);

    // If socket is already connected, attach the handler immediately
    if (this.socket?.connected) {
      this.socket.on(event, handler as any);
    }
  }

  off(event: string, handler: (...args: any[]) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }

    if (this.socket) {
      this.socket.off(event, handler as any);
    }
  }

  private triggerHandlers(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(...args));
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export default new WebSocketService();
