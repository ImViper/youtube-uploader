import { Request, Response, Router, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createAuthRoutes, authenticateToken, requireRole } from '../../api/auth';

// Mock dependencies
jest.mock('pino', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };
  return jest.fn(() => mockLogger);
});

jest.mock('bcrypt');

describe('Auth Module', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;
  let router: Router;
  
  const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup mock request and response
    mockRequest = {
      body: {},
      headers: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // Create a new router instance for each test
    router = createAuthRoutes();
  });

  describe('createAuthRoutes', () => {
    it('should create router with all required routes', () => {
      expect(router).toBeDefined();
      expect(router.stack).toBeDefined();
      
      // Check if routes are registered
      const routes = router.stack
        .filter(layer => layer.route)
        .map(layer => {
          const route = layer.route as any;
          return {
            path: route?.path,
            methods: Object.keys(route?.methods || {})
          };
        });

      expect(routes).toContainEqual({ path: '/login', methods: ['post'] });
      expect(routes).toContainEqual({ path: '/logout', methods: ['post'] });
      expect(routes).toContainEqual({ path: '/me', methods: ['get'] });
      expect(routes).toContainEqual({ path: '/refresh', methods: ['post'] });
    });
  });

  describe('POST /login', () => {
    let loginHandler: any;

    beforeEach(() => {
      // Extract the login handler
      const loginRoute = router.stack.find(layer => 
        layer.route?.path === '/login'
      );
      loginHandler = loginRoute?.route?.stack[0].handle;
    });

    it('should return 400 if username is missing', async () => {
      mockRequest.body = { password: 'password123' };
      
      await loginHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Username and password are required'
      });
    });

    it('should return 400 if password is missing', async () => {
      mockRequest.body = { username: 'testuser' };
      
      await loginHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Username and password are required'
      });
    });

    it('should return 401 for non-existent user', async () => {
      mockRequest.body = { username: 'nonexistent', password: 'password123' };
      
      await loginHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid credentials'
      });
    });

    it('should return 401 for invalid password', async () => {
      mockRequest.body = { username: 'testuser', password: 'wrongpassword' };
      
      await loginHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid credentials'
      });
    });

    it('should login successfully with valid admin credentials', async () => {
      mockRequest.body = { username: 'admin', password: 'admin123' };
      
      await loginHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: {
            id: '1',
            username: 'admin',
            email: 'admin@example.com',
            role: 'admin'
          },
          accessToken: expect.any(String),
          refreshToken: expect.any(String)
        })
      );

      // Verify tokens are valid JWT
      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      const decodedAccess = jwt.verify(response.accessToken, JWT_SECRET) as any;
      const decodedRefresh = jwt.verify(response.refreshToken, JWT_SECRET) as any;
      
      expect(decodedAccess.id).toBe('1');
      expect(decodedAccess.username).toBe('admin');
      expect(decodedAccess.role).toBe('admin');
      expect(decodedRefresh.id).toBe('1');
      expect(decodedRefresh.type).toBe('refresh');
    });

    it('should login successfully with valid testuser credentials', async () => {
      mockRequest.body = { username: 'testuser', password: 'password123' };
      
      await loginHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: {
            id: '2',
            username: 'testuser',
            email: 'testuser@example.com',
            role: 'user'
          },
          accessToken: expect.any(String),
          refreshToken: expect.any(String)
        })
      );
    });

    it('should handle internal server error', async () => {
      // Force an error by mocking jwt.sign to throw
      jest.spyOn(jwt, 'sign').mockImplementationOnce(() => {
        throw new Error('JWT signing failed');
      });

      mockRequest.body = { username: 'admin', password: 'admin123' };
      
      await loginHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });

  describe('POST /logout', () => {
    let logoutHandler: any;

    beforeEach(() => {
      const logoutRoute = router.stack.find(layer => 
        layer.route?.path === '/logout'
      );
      logoutHandler = logoutRoute?.route?.stack[0].handle;
    });

    it('should logout successfully with token', async () => {
      const token = jwt.sign({ id: '1', username: 'admin' }, JWT_SECRET);
      mockRequest.headers = { authorization: `Bearer ${token}` };
      
      await logoutHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
    });

    it('should logout successfully without token', async () => {
      await logoutHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
    });

    it('should handle internal server error', async () => {
      // Mock to simulate an error
      mockRequest.headers = { 
        authorization: {
          replace: jest.fn(() => { throw new Error('Header processing failed'); })
        } as any
      };
      
      await logoutHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });

  describe('GET /me', () => {
    let meHandler: any;

    beforeEach(() => {
      const meRoute = router.stack.find(layer => 
        layer.route?.path === '/me'
      );
      meHandler = meRoute?.route?.stack[0].handle;
    });

    it('should return 401 if no token provided', async () => {
      await meHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'No token provided'
      });
    });

    it('should return 401 if token is blacklisted', async () => {
      const token = jwt.sign({ id: '1', username: 'admin' }, JWT_SECRET);
      mockRequest.headers = { authorization: `Bearer ${token}` };
      
      // First logout to blacklist the token
      const logoutRoute = router.stack.find(layer => 
        layer.route?.path === '/logout'
      );
      const logoutHandler = logoutRoute?.route?.stack[0].handle;
      await logoutHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Clear previous mock calls
      jest.clearAllMocks();
      
      // Now try to access /me with blacklisted token
      await meHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Token is invalid'
      });
    });

    it('should return 401 for invalid token', async () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      
      await meHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token'
      });
    });

    it('should return 401 if user not found', async () => {
      const token = jwt.sign({ id: '999', username: 'deleted' }, JWT_SECRET);
      mockRequest.headers = { authorization: `Bearer ${token}` };
      
      await meHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'User not found'
      });
    });

    it('should return current user data successfully', async () => {
      const token = jwt.sign(
        { id: '1', username: 'admin', role: 'admin' }, 
        JWT_SECRET
      );
      mockRequest.headers = { authorization: `Bearer ${token}` };
      
      await meHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.json).toHaveBeenCalledWith({
        id: '1',
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin'
      });
    });

    it('should handle internal server error', async () => {
      mockRequest.headers = { 
        authorization: {
          replace: jest.fn(() => { throw new Error('Header processing failed'); })
        } as any
      };
      
      await meHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });

  describe('POST /refresh', () => {
    let refreshHandler: any;

    beforeEach(() => {
      const refreshRoute = router.stack.find(layer => 
        layer.route?.path === '/refresh'
      );
      refreshHandler = refreshRoute?.route?.stack[0].handle;
    });

    it('should return 400 if refresh token is missing', async () => {
      mockRequest.body = {};
      
      await refreshHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Refresh token is required'
      });
    });

    it('should return 401 if refresh token is blacklisted', async () => {
      const refreshToken = jwt.sign({ id: '1', type: 'refresh' }, JWT_SECRET);
      
      // First use the refresh token once to blacklist it
      mockRequest.body = { refreshToken };
      await refreshHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Clear previous mock calls
      jest.clearAllMocks();
      
      // Try to use the same refresh token again
      await refreshHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Refresh token is invalid'
      });
    });

    it('should return 401 for invalid refresh token', async () => {
      mockRequest.body = { refreshToken: 'invalid-token' };
      
      await refreshHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid refresh token'
      });
    });

    it('should return 401 if token is not a refresh token', async () => {
      const accessToken = jwt.sign(
        { id: '1', username: 'admin', role: 'admin' }, 
        JWT_SECRET
      );
      mockRequest.body = { refreshToken: accessToken };
      
      await refreshHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid refresh token'
      });
    });

    it('should return 401 if user not found', async () => {
      const refreshToken = jwt.sign({ id: '999', type: 'refresh' }, JWT_SECRET);
      mockRequest.body = { refreshToken };
      
      await refreshHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'User not found'
      });
    });

    it('should refresh tokens successfully', async () => {
      const refreshToken = jwt.sign({ id: '1', type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
      mockRequest.body = { refreshToken };
      
      await refreshHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.json).toHaveBeenCalledWith({
        accessToken: expect.any(String),
        refreshToken: expect.any(String)
      });

      // Verify new tokens are valid
      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      const decodedAccess = jwt.verify(response.accessToken, JWT_SECRET) as any;
      const decodedRefresh = jwt.verify(response.refreshToken, JWT_SECRET) as any;
      
      expect(decodedAccess.id).toBe('1');
      expect(decodedAccess.username).toBe('admin');
      expect(decodedAccess.role).toBe('admin');
      expect(decodedRefresh.id).toBe('1');
      expect(decodedRefresh.type).toBe('refresh');
    });

    it('should handle internal server error', async () => {
      // Force an error by making the body parsing throw
      const originalBody = mockRequest.body;
      Object.defineProperty(mockRequest, 'body', {
        get() {
          throw new Error('Body parsing failed');
        },
        configurable: true
      });

      await refreshHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });

      // Restore body
      Object.defineProperty(mockRequest, 'body', {
        value: originalBody,
        writable: true,
        configurable: true
      });
    });
  });

  describe('authenticateToken middleware', () => {
    it('should return 401 if no token provided', () => {
      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Access token required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if token is blacklisted', async () => {
      const token = jwt.sign({ id: '1', username: 'admin' }, JWT_SECRET);
      mockRequest.headers = { authorization: `Bearer ${token}` };
      
      // First logout to blacklist the token
      const logoutRoute = router.stack.find(layer => 
        layer.route?.path === '/logout'
      );
      const logoutHandler = logoutRoute?.route?.stack[0].handle;
      await logoutHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Clear previous mock calls
      jest.clearAllMocks();
      
      // Now try to authenticate with blacklisted token
      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Token is invalid'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid token', () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      
      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() for valid token and attach user to request', () => {
      const userData = { id: '1', username: 'admin', role: 'admin' };
      const token = jwt.sign(userData, JWT_SECRET);
      mockRequest.headers = { authorization: `Bearer ${token}` };
      
      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as any).user).toMatchObject(userData);
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should handle authorization header without Bearer prefix', () => {
      const userData = { id: '1', username: 'admin', role: 'admin' };
      const token = jwt.sign(userData, JWT_SECRET);
      mockRequest.headers = { authorization: token };
      
      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Should still work as .replace('Bearer ', '') will just return the original string
      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as any).user).toMatchObject(userData);
    });
  });

  describe('requireRole middleware', () => {
    it('should return 403 if user not attached to request', () => {
      const middleware = requireRole('admin');
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if user role does not match', () => {
      const middleware = requireRole('admin');
      (mockRequest as any).user = { id: '2', username: 'testuser', role: 'user' };
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() if user has required role', () => {
      const middleware = requireRole('admin');
      (mockRequest as any).user = { id: '1', username: 'admin', role: 'admin' };
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should work for different roles', () => {
      const middleware = requireRole('user');
      (mockRequest as any).user = { id: '2', username: 'testuser', role: 'user' };
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });

  describe('Token expiration', () => {
    it('should handle expired access token', () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { id: '1', username: 'admin', role: 'admin' },
        JWT_SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );
      mockRequest.headers = { authorization: `Bearer ${expiredToken}` };
      
      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle expired refresh token', async () => {
      const refreshRoute = router.stack.find(layer => 
        layer.route?.path === '/refresh'
      );
      const refreshHandler = refreshRoute?.route?.stack[0].handle;

      // Create an expired refresh token
      const expiredRefreshToken = jwt.sign(
        { id: '1', type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '-1d' } // Expired 1 day ago
      );
      mockRequest.body = { refreshToken: expiredRefreshToken };
      
      await refreshHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid refresh token'
      });
    });
  });

  describe('Edge cases and security', () => {
    it('should handle malformed authorization header gracefully', () => {
      mockRequest.headers = { authorization: null as any };
      
      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Access token required'
      });
    });

    it('should handle JWT with invalid signature', () => {
      // Create a token with different secret
      const invalidToken = jwt.sign(
        { id: '1', username: 'admin' },
        'wrong-secret'
      );
      mockRequest.headers = { authorization: `Bearer ${invalidToken}` };
      
      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token'
      });
    });

    it('should not leak sensitive information in error messages', async () => {
      const loginRoute = router.stack.find(layer => 
        layer.route?.path === '/login'
      );
      const loginHandler = loginRoute?.route?.stack[0].handle;

      // Try SQL injection attempt
      mockRequest.body = { 
        username: "admin' OR '1'='1", 
        password: "anything' OR '1'='1" 
      };
      
      await loginHandler?.(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Should return generic error, not database error
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid credentials'
      });
    });
  });
});