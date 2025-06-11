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

// Configure CORS configuration
const isProduction = process.env.NODE_ENV === 'production';
const frontendUrl = process.env.FRONTEND_URL || 'https://repo-analyzer-2ra5.vercel.app';

// If in production, ensure FRONTEND_URL is set
if (isProduction && !process.env.FRONTEND_URL) {
  console.warn('WARNING: FRONTEND_URL environment variable is not set in production');
}

// Allowed origins - must match exactly with frontend URL
const allowedOrigins = [
  'https://repo-analyzer-2ra5.vercel.app',
  'http://localhost:5173'  // For local development
];

// CORS options
const corsOptions = {
  origin: function (origin, callback) {
    // In production, only allow specific origins
    if (isProduction) {
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.warn(`Blocked request from unauthorized origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    }
    // In development, allow all origins for easier testing
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 600 // 10 minutes
};

// Log CORS configuration for debugging
console.log('CORS Configuration:', {
  isProduction,
  frontendUrl,
  allowedOrigins,
  nodeEnv: process.env.NODE_ENV
});

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

// Generate a random state parameter
function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

// Get cookie options based on environment
function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  const options = {
    httpOnly: true,
    secure: isProduction, // Must be true in production for SameSite=None
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: '/',
  };
  
  // In production, set the domain for cross-subdomain cookies
  if (isProduction) {
    options.domain = '.onrender.com';
  }
  
  return options;
}

// GitHub OAuth login endpoint
app.get('/auth/github', (req, res) => {
  try {
    const state = generateState();
    const cookieOptions = getCookieOptions();
    
    // Set the state in a secure, HTTP-only cookie
    res.cookie('oauth_state', state, cookieOptions);
    
    // Log the cookie being set
    console.log('Setting oauth_state cookie with options:', {
      ...cookieOptions,
      value: state.substring(0, 5) + '...' // Only log first 5 chars of state
    });
    
    // Log cookies being set
    console.log('Cookies being set:', {
      oauth_state: state,
      debug_state: state
    });
    
    // Build the GitHub OAuth URL
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.append('client_id', process.env.GITHUB_CLIENT_ID);
    authUrl.searchParams.append('scope', 'user:email');
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('redirect_uri', 
      `${process.env.BACKEND_URL || 'https://repo-analyzer-vpzo.onrender.com'}/auth/github/callback`
    );
    
    console.log('Redirecting to GitHub OAuth:', authUrl.toString());
    res.redirect(authUrl.toString());
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authentication URL', details: error.message });
  }
});

// GitHub OAuth callback endpoint
// Helper function to create frontend redirect URL
function createFrontendUrl(path = '/login', params = {}) {
  const url = new URL(process.env.FRONTEND_URL || 'https://repo-analyzer-2ra5.vercel.app');
  url.pathname = path;
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url;
}

// GitHub OAuth callback endpoint
app.get('/auth/github/callback', async (req, res) => {
  console.log('=== /auth/github/callback ===');
  console.log('Received callback with query params:', req.query);
  
  const { code, state: stateFromGitHub, error, error_description } = req.query;
  const stateFromCookie = req.cookies.oauth_state;
  const cookieOptions = getCookieOptions();
  
  // Clear the state cookie immediately after reading it
  res.clearCookie('oauth_state', { 
    ...cookieOptions,
    maxAge: 0 // Expire immediately
  });
  
  // Log state for debugging
  console.log('State validation:', { stateFromGitHub, stateFromCookie });
  
  // Check for OAuth errors
  if (error) {
    console.error('GitHub OAuth error:', { error, error_description });
    const redirectUrl = createFrontendUrl('/login', { error: error_description || error });
    return res.redirect(redirectUrl.toString());
  }
  
  // Verify state parameter to prevent CSRF
  if (!stateFromCookie || stateFromGitHub !== stateFromCookie) {
    console.error('State mismatch - possible CSRF attack or expired session', { 
      stateFromGitHub, 
      stateFromCookie 
    });
    const redirectUrl = createFrontendUrl('/login', { error: 'state_mismatch' });
    return res.redirect(redirectUrl.toString());
  }
  
  if (!code) {
    console.error('No authorization code received');
    const redirectUrl = createFrontendUrl('/login', { error: 'no_code' });
    return res.redirect(redirectUrl.toString());
  }

  try {
    console.log('Exchanging authorization code for access token...');
    
    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.BACKEND_URL || 'https://repo-analyzer-vpzo.onrender.com'}/auth/github/callback`,
        state: stateFromGitHub
      },
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (tokenResponse.data.error) {
      console.error('GitHub token exchange error:', tokenResponse.data);
      throw new Error(tokenResponse.data.error_description || 'Failed to exchange code for token');
    }

    const { access_token: accessToken } = tokenResponse.data;
    
    if (!accessToken) {
      throw new Error('No access token received from GitHub');
    }
    
    // Get user data from GitHub
    const [userResponse, emailsResponse] = await Promise.all([
      axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }),
      axios.get('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })
    ]);

    const primaryEmail = emailsResponse.data.find(email => email.primary)?.email || '';
    
    // Create user data object
    const userData = {
      id: userResponse.data.id,
      login: userResponse.data.login,
      name: userResponse.data.name,
      email: primaryEmail,
      avatar_url: userResponse.data.avatar_url
    };
    
    // Set the GitHub token in a secure, HTTP-only cookie
    res.cookie('github_token', accessToken, {
      ...cookieOptions,
      httpOnly: true,
      maxAge: 23 * 60 * 60 * 1000, // 23 hours
      path: '/'
    });
    
    // Set user data in a non-HTTP-only cookie for client-side access
    res.cookie('user_data', JSON.stringify(userData), {
      ...cookieOptions,
      httpOnly: false,
      maxAge: 23 * 60 * 60 * 1000, // 23 hours
      path: '/'
    });
    
    // Set a session cookie
    res.cookie('is_authenticated', 'true', {
      ...cookieOptions,
      httpOnly: false,
      maxAge: 23 * 60 * 60 * 1000, // 23 hours
      path: '/'
    });
    
    // Log successful authentication
    console.log('User authenticated successfully:', {
      userId: userResponse.data.id,
      login: userResponse.data.login,
      email: primaryEmail
    });
    
    // Redirect to dashboard after successful login
    const redirectUrl = createFrontendUrl('/dashboard');
    return res.redirect(redirectUrl.toString());
    
  } catch (error) {
    console.error('OAuth flow error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
    const redirectUrl = createFrontendUrl('/login', { 
      error: 'auth_error',
      message: error.message
    });
    return res.redirect(redirectUrl.toString());
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
