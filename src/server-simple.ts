import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 5989;

// Middleware
app.use(cors());
app.use(express.json());

// Simple login endpoint
app.post('/api/auth/login', (req, res) => {
  console.log('Login request received:', req.body);
  const { username, password } = req.body;
  
  if ((username === 'admin' && password === 'admin123') || 
      (username === 'testuser' && password === 'password123')) {
    res.json({
      user: {
        id: '1',
        username,
        email: `${username}@example.com`,
        role: username === 'admin' ? 'admin' : 'user'
      },
      accessToken: 'dev-token',
      refreshToken: 'dev-refresh-token'
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Current user
app.get('/api/auth/me', (req, res) => {
  res.json({
    id: '1',
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin'
  });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

// Start server
app.listen(port, () => {
  console.log(`Simple server running on http://localhost:${port}`);
  console.log(`Login endpoint: POST http://localhost:${port}/api/auth/login`);
  console.log(`Health check: GET http://localhost:${port}/api/health`);
});