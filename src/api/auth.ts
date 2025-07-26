import { Request, Response, Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pino from 'pino';

const logger = pino({
  name: 'auth-api',
  level: process.env.LOG_LEVEL || 'info'
});

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const JWT_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

// Mock user database (in production, this would be in PostgreSQL)
const users = [
  {
    id: '1',
    username: 'admin',
    password: '$2b$10$YourHashedPasswordHere', // admin123
    email: 'admin@example.com',
    role: 'admin'
  },
  {
    id: '2',
    username: 'testuser',
    password: '$2b$10$YourHashedPasswordHere', // password123
    email: 'testuser@example.com',
    role: 'user'
  }
];

// Token blacklist (in production, use Redis)
const tokenBlacklist = new Set<string>();

export function createAuthRoutes(): Router {
  const router = Router();

  // Login endpoint
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({
          error: 'Username and password are required'
        });
      }
      
      // For development, use simple password check
      // In production, use bcrypt.compare
      const user = users.find(u => u.username === username);
      
      if (!user) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }
      
      // For development, accept hardcoded passwords
      const validPassword = 
        (username === 'admin' && password === 'admin123') ||
        (username === 'testuser' && password === 'password123');
      
      if (!validPassword) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }
      
      // Generate tokens
      const accessToken = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
      
      const refreshToken = jwt.sign(
        { id: user.id, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
      );
      
      logger.info({ username }, 'User logged in successfully');
      
      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        accessToken,
        refreshToken
      });
    } catch (error) {
      logger.error({ error }, 'Login error');
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // Logout endpoint
  router.post('/logout', async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (token) {
        // Add token to blacklist
        tokenBlacklist.add(token);
      }
      
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Logout error');
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // Get current user
  router.get('/me', async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({
          error: 'No token provided'
        });
      }
      
      // Check if token is blacklisted
      if (tokenBlacklist.has(token)) {
        return res.status(401).json({
          error: 'Token is invalid'
        });
      }
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const user = users.find(u => u.id === decoded.id);
        
        if (!user) {
          return res.status(401).json({
            error: 'User not found'
          });
        }
        
        res.json({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        });
      } catch (err) {
        return res.status(401).json({
          error: 'Invalid token'
        });
      }
    } catch (error) {
      logger.error({ error }, 'Get current user error');
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // Refresh token endpoint
  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({
          error: 'Refresh token is required'
        });
      }
      
      // Check if token is blacklisted
      if (tokenBlacklist.has(refreshToken)) {
        return res.status(401).json({
          error: 'Refresh token is invalid'
        });
      }
      
      try {
        const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
        
        if (decoded.type !== 'refresh') {
          return res.status(401).json({
            error: 'Invalid refresh token'
          });
        }
        
        const user = users.find(u => u.id === decoded.id);
        
        if (!user) {
          return res.status(401).json({
            error: 'User not found'
          });
        }
        
        // Generate new tokens
        const newAccessToken = jwt.sign(
          { id: user.id, username: user.username, role: user.role },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );
        
        const newRefreshToken = jwt.sign(
          { id: user.id, type: 'refresh' },
          JWT_SECRET,
          { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
        );
        
        // Blacklist old refresh token
        tokenBlacklist.add(refreshToken);
        
        res.json({
          accessToken: newAccessToken,
          refreshToken: newRefreshToken
        });
      } catch (err) {
        return res.status(401).json({
          error: 'Invalid refresh token'
        });
      }
    } catch (error) {
      logger.error({ error }, 'Refresh token error');
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  return router;
}

// Middleware to verify JWT token
export function authenticateToken(req: Request, res: Response, next: Function) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      error: 'Access token required'
    });
  }
  
  // Check if token is blacklisted
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({
      error: 'Token is invalid'
    });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Invalid token'
    });
  }
}

// Middleware to check user role
export function requireRole(role: string) {
  return (req: Request, res: Response, next: Function) => {
    const user = (req as any).user;
    
    if (!user || user.role !== role) {
      return res.status(403).json({
        error: 'Insufficient permissions'
      });
    }
    
    next();
  };
}