require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// In-memory store for OAuth state (use Redis in production)
const stateStore = new Map();

// Log environment variables (sanitized)
console.log('Environment Variables:', {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: PORT,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ? 'Set' : 'Not set',
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ? 'Set' : 'Not set',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173'
});

// Validate required environment variables
if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
  console.error('❌ Error: Missing required GitHub OAuth credentials');
  console.error('Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables');
  process.exit(1);
}

// Configure CORS with allowed origins
const allowedOrigins = [
  'http://localhost:5173',
  'https://repo-analyzer-2ra5.vercel.app'
];

// Configure CORS with credentials support
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    const msg = `The CORS policy for this site does not allow access from the specified origin: ${origin}`;
    console.warn(msg);
    return callback(new Error(msg), false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Apply middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors(corsOptions));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Generate and store state for CSRF protection
function generateState() {
  const state = crypto.randomBytes(16).toString('hex');
  stateStore.set(state, { timestamp: Date.now() });
  // Clean up old states (older than 10 minutes)
  const now = Date.now();
  for (const [st, data] of stateStore.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) { // 10 minutes
      stateStore.delete(st);
    }
  }
  return state;
}

function verifyState(state) {
  const stateData = stateStore.get(state);
  if (!stateData) return false;
  stateStore.delete(state); // State should be used once
  return true;
}

// GitHub OAuth login endpoint
app.get('/auth/github', (req, res) => {
  try {
    const state = generateState();
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=user:email&state=${state}`;
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authentication URL' });
  }
});

// GitHub OAuth callback endpoint
app.get('/auth/github/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;
    
    // Verify state parameter to prevent CSRF attacks
    if (!state || !verifyState(state)) {
      console.error('Invalid state parameter in OAuth callback');
      return res.status(400).json({
        success: false,
        error: 'Invalid state parameter',
        message: 'Authentication failed due to invalid state parameter.'
      });
    }
    
    // Handle GitHub OAuth errors
    if (error) {
      console.error('GitHub OAuth error in callback:', { error, error_description });
      return res.status(400).json({
        success: false,
        error: 'GitHub OAuth error',
        message: error_description || 'An error occurred during GitHub authentication'
      });
    }
    
    if (!code) {
      console.error('No authorization code received in callback');
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required'
      });
    }

    console.log('Exchanging authorization code for access token...');

    // Exchange the authorization code for an access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code
      },
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    const { access_token } = tokenResponse.data;
    
    if (!access_token) {
      console.error('No access token received from GitHub');
      return res.status(400).json({
        success: false,
        error: 'Failed to obtain access token from GitHub'
      });
    }

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = new URL('/auth/callback', frontendUrl);
    redirectUrl.searchParams.set('token', access_token);
    
    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('Error in GitHub OAuth callback:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      stack: error.stack
    });
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const errorUrl = new URL('/login?error=auth_failed', frontendUrl);
    res.redirect(errorUrl.toString());
  }
});

// API endpoint to get the current user
app.get('/api/user', async (req, res) => {
  try {
    const token = req.cookies.github_token || req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Repo-Analyzer-App'
      }
    });

    res.json({
      success: true,
      user: userResponse.data
    });
  } catch (error) {
    console.error('Error fetching user:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user data'
    });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  res.clearCookie('github_token');
  res.json({ success: true });
});

// 404 handler for undefined routes - must be after all other routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    path: req.path,
    method: req.method
  });
});

// Error handling middleware - must be after all other middleware and routes
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Log basic server info
console.log('Server configuration complete');
console.log('Available endpoints:');
console.log('  GET    /health');
console.log('  GET    /');
console.log('  GET    /auth/github');
console.log('  GET    /auth/github/callback');
console.log('  GET    /api/user');
console.log('  POST   /api/logout');

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

// Handle process termination
const shutdown = () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server has been stopped');
    process.exit(0);
  });

  // Force shutdown after 5 seconds
  setTimeout(() => {
    console.error('❌ Forcing shutdown...');
    process.exit(1);
  }, 5000);
};

// Handle process termination
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
