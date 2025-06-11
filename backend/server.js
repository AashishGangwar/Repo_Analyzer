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
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

// If in production, ensure FRONTEND_URL is set
if (isProduction && !process.env.FRONTEND_URL) {
  console.warn('WARNING: FRONTEND_URL environment variable is not set in production');
}

const allowedOrigins = [
  'http://localhost:5173',
  'https://repo-analyzer-2ra5.vercel.app'
];

// Add frontend URL to allowed origins if not already present
if (frontendUrl && !allowedOrigins.includes(frontendUrl)) {
  allowedOrigins.push(frontendUrl);
}

// Add localhost for development
if (!isProduction) {
  allowedOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173');
}

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin && !isProduction) {
      return callback(null, true);
    }
    
    // Check if the origin is allowed
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      console.warn(`Blocked request from unauthorized origin: ${origin}`);
      console.log('Allowed origins:', allowedOrigins);
      callback(new Error(`The CORS policy for this site does not allow access from the specified origin: ${origin}`), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['Set-Cookie', 'Date', 'ETag', 'Authorization'],
  maxAge: 86400 // 24 hours
};

// Log CORS configuration
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

// Generate a random state string
function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

// No need for verifyState function anymore as we'll use cookies

// GitHub OAuth login endpoint
app.get('/auth/github', (req, res) => {
  try {
    const state = generateState();
    
    console.log('=== /auth/github ===');
    console.log('Generated state:', state);
    console.log('Request headers:', req.headers);
    
    // Set state in HTTP-only cookie with appropriate settings for the environment
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction, // true in production, false in development
      sameSite: isProduction ? 'none' : 'lax', // 'none' in production, 'lax' in development
      maxAge: 10 * 60 * 1000, // 10 minutes
      path: '/', // Available on all paths
    };
    
    // Only set domain in production
    if (isProduction) {
      cookieOptions.domain = '.onrender.com';
    }
    
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Cookie options:', JSON.stringify(cookieOptions, null, 2));
    
    res.cookie('oauth_state', state, cookieOptions);
    
    console.log('Setting cookie with options:', JSON.stringify(cookieOptions, null, 2));
    
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=user:email&state=${state}`;
    console.log('Auth URL:', authUrl);
    
    // For debugging, also set a non-httpOnly cookie with same settings
    const debugCookieOptions = { ...cookieOptions, httpOnly: false };
    res.cookie('debug_state', state, debugCookieOptions);
    
    // Set a response header to help with debugging
    res.setHeader('X-Debug-Auth-URL', authUrl);
    res.setHeader('X-Debug-Cookie-Set', 'true');
    
    console.log('Cookies being set:', {
      oauth_state: state,
      debug_state: state
    });
    
    // Redirect to GitHub for authorization
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authentication URL', details: error.message });
  }
});

// GitHub OAuth callback endpoint
app.get('/auth/github/callback', async (req, res) => {
  console.log('=== /auth/github/callback ===');
  console.log('Received callback with query params:', req.query);
  
  try {
    const { code, state: stateFromGitHub, error, error_description } = req.query;
    const stateFromCookie = req.cookies.oauth_state;
    
    console.log('State from GitHub:', stateFromGitHub);
    console.log('State from cookie:', stateFromCookie);
    console.log('All cookies received:', req.cookies);
    console.log('Request headers:', req.headers);
    
    // Clear the state cookie with same options used to set it
    const clearOptions = {
      path: '/',
      httpOnly: true,
      secure: isProduction,
    };
    
    if (isProduction) {
      clearOptions.domain = '.onrender.com';
    }
    
    res.clearCookie('oauth_state', clearOptions);
    res.clearCookie('debug_state', { ...clearOptions, httpOnly: false });
    
    console.log('Clearing cookies with options:', JSON.stringify(clearOptions, null, 2));
    
    // Verify state parameter to prevent CSRF attacks
    if (!stateFromGitHub || !stateFromCookie || stateFromGitHub !== stateFromCookie) {
      console.error('State validation failed', {
        reason: !stateFromGitHub ? 'No state from GitHub' : 
               !stateFromCookie ? 'No state cookie found' :
               'State mismatch',
        stateFromGitHub,
        stateFromCookie,
        allCookies: req.cookies,
        headers: req.headers
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid state parameter',
        message: 'Authentication failed due to invalid state parameter.',
        debug: {
          receivedState: stateFromGitHub,
          expectedState: stateFromCookie,
          hasStateCookie: !!stateFromCookie,
          cookieKeys: Object.keys(req.cookies || {})
        }
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

    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
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
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=auth_failed`);
    }

    const { access_token: accessToken } = tokenResponse.data;
    
    // Get user data from GitHub
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    // Get user emails
    const emailsResponse = await axios.get('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    const primaryEmail = emailsResponse.data.find(email => email.primary)?.email || '';
    
    // Set the access token in an HTTP-only cookie
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction, // true in production, false in development
      sameSite: isProduction ? 'none' : 'lax', // Required for cross-site cookies
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: '/',
    };
    
    // In production, set the domain for cross-subdomain cookies
    if (isProduction) {
      cookieOptions.domain = '.onrender.com';
    }
    
    console.log('Setting cookie with options:', {
      ...cookieOptions,
      // Don't log the actual token
      value: '***REDACTED***',
      // Show if domain is set
      domainSet: !!cookieOptions.domain
    });
    
    // Set the token in a cookie
    res.cookie('github_token', accessToken, cookieOptions);
    
    // Create a JWT or use the GitHub token for your app's authentication
    // For now, we'll just use the GitHub token
    const userData = {
      id: userResponse.data.id,
      login: userResponse.data.login,
      name: userResponse.data.name,
      email: primaryEmail,
      avatar_url: userResponse.data.avatar_url
    };
    
    // Set user data in a secure, httpOnly cookie
    const userDataString = JSON.stringify(userData);
    res.cookie('user_data', userDataString, {
      ...cookieOptions,
      httpOnly: false // Allow client-side access for now
    });
    
    // Redirect to the frontend with success status
    const frontendUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:5173');
    frontendUrl.searchParams.set('login', 'success');
    
    // Redirect to the frontend with the token in the URL (temporary for demo)
    // In production, you should only use HTTP-only cookies and not expose tokens in URLs
    res.redirect(`${frontendUrl.toString()}`);
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
