require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const cookieParser = require('cookie-parser');

// Log environment variables (sanitized)
console.log('Environment Variables:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT || 5000,
  GITHUB_CLIENT_ID: !!process.env.GITHUB_CLIENT_ID ? 'Set' : 'Not set',
  GITHUB_CLIENT_SECRET: !!process.env.GITHUB_CLIENT_SECRET ? 'Set' : 'Not set'
});

// Validate required environment variables
if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
  console.error('❌ Error: Missing required GitHub OAuth credentials');
  console.error('Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Validate route paths to prevent path-to-regexp errors
// Debug log
console.log('Starting server with configuration:');
console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`- PORT: ${PORT}`);
console.log(`- GITHUB_CLIENT_ID: ${process.env.GITHUB_CLIENT_ID ? 'Set' : 'Not set'}`);

// Configure CORS with allowed origins
const allowedOrigins = [
  'http://localhost:5173',
  'https://repo-analyzer-2ra5.vercel.app'
];

// Apply middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Configure CORS with credentials support
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified origin: ${origin}`;
      console.warn(msg);
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  credentials: true
}));

// Handle preflight requests
app.options('*', cors());

// Health check endpoint
console.log('Registering GET route: /health');
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
console.log('Registering GET route: /');
app.get('/', (req, res) => {
  try {
    const state = generateState();
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=user:email&state=${state}`;
    res.json({ 
      status: 'Server is running',
      github_auth_url: authUrl
    });
  } catch (error) {
    console.error('Error in root route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// In-memory store for OAuth state (use Redis in production)
const stateStore = new Map();

// Generate and store state for CSRF protection
function generateState() {
  const state = require('crypto').randomBytes(16).toString('hex');
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

// GitHub OAuth callback endpoint
console.log('Registering GET route: /auth/github/callback');
app.get('/auth/github/callback', async (req, res) => {
  console.log('GitHub OAuth callback received', { query: req.query });
  
  const { code, state, error, error_description, error_uri } = req.query;
  
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
    console.error('GitHub OAuth error in callback:', { error, error_description, error_uri });
    return res.status(400).send(`GitHub OAuth error: ${error} - ${error_description}`);
  }
  
  if (!code) {
    console.error('No authorization code received in callback');
    return res.status(400).send('Authorization code is required');
  }

  console.log('Exchanging authorization code for access token...');
  console.log('Using client_id:', process.env.GITHUB_CLIENT_ID ? 'present' : 'missing');
  console.log('Using client_secret:', process.env.GITHUB_CLIENT_SECRET ? 'present' : 'missing');

  try {
    // Exchange the authorization code for an access token
    console.log('Exchanging code for token with client_id:', process.env.GITHUB_CLIENT_ID);
    const tokenParams = new URLSearchParams();
    tokenParams.append('client_id', process.env.GITHUB_CLIENT_ID);
    tokenParams.append('client_secret', process.env.GITHUB_CLIENT_SECRET);
    tokenParams.append('code', code);
    
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      tokenParams.toString(),
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    console.log('GitHub token exchange response:', response.data);
    
    const { access_token, error: ghError, error_description: ghErrorDescription } = response.data;

    if (ghError) {
      console.error('GitHub OAuth error in token exchange:', { 
        error: ghError, 
        description: ghErrorDescription,
        client_id: process.env.GITHUB_CLIENT_ID,
        has_client_secret: !!process.env.GITHUB_CLIENT_SECRET
      });
      return res.status(400).send(`GitHub OAuth error: ${ghError} - ${ghErrorDescription}`);
    }
    
    if (!access_token) {
      console.error('No access token received from GitHub');
      return res.status(400).send('Failed to obtain access token from GitHub');
    }

    // Get user data from GitHub
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${access_token}`,
      },
    });

    // Get user emails
    const emailsResponse = await axios.get('https://api.github.com/user/emails', {
      headers: {
        Authorization: `token ${access_token}`,
      },
    });

    const primaryEmail = emailsResponse.data.find(email => email.primary)?.email || '';
    const userData = {
      ...userResponse.data,
      email: primaryEmail || userResponse.data.email,
      access_token: access_token,
    };

    // Set secure HTTP-only cookie with token
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    };
    
    res.cookie('auth_token', access_token, cookieOptions);
    
    // Redirect to frontend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = new URL('/dashboard', frontendUrl);
    
    console.log('Redirecting to frontend with secure cookie');
    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('Error in GitHub OAuth callback:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      stack: error.stack
    });
    return res.status(500).send(`Authentication failed: ${error.message}`);
  }
});

// GitHub OAuth token exchange endpoint
console.log('Registering POST route: /api/auth/github/token');
app.post('/api/auth/github/token', async (req, res) => {
  // This endpoint is kept for backward compatibility
  // The new flow uses the /auth/github/callback endpoint above
  // Set CORS headers
  const origin = req.headers.origin;
  if (allowedOrigins.some(allowedOrigin => origin === allowedOrigin || origin?.replace(/\/$/, '') === allowedOrigin.replace(/\/$/, ''))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', true);
  }
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({
      success: false,
      error: 'Authorization code is required',
    });
  }

  try {
    console.log('Exchanging code for token...');
    // Exchange the authorization code for an access token
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );

    const { access_token, error: ghError, error_description } = response.data;
    
    if (ghError) {
      console.error('GitHub OAuth error:', { ghError, error_description });
      return res.status(400).json({
        success: false,
        error: ghError,
        error_description,
      });
    }

    if (!access_token) {
      throw new Error('No access token received from GitHub');
    }

    console.log('Fetching user data from GitHub...');
    // Get user data from GitHub
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${access_token}`,
        'User-Agent': 'Repo-Analyzer-App',
      },
    });

    // Get user's email if available
    let email = userResponse.data.email;
    if (!email) {
      try {
        const emailsResponse = await axios.get('https://api.github.com/user/emails', {
          headers: {
            'Authorization': `token ${access_token}`,
            'User-Agent': 'Repo-Analyzer-App',
          },
        });
        
        const primaryEmail = emailsResponse.data.find(e => e.primary);
        if (primaryEmail) {
          email = primaryEmail.email;
        }
      } catch (emailError) {
        console.warn('Could not fetch user emails:', emailError.message);
      }
    }

    // In a real app, you would create or authenticate the user in your database here
    const userData = {
      ...userResponse.data,
      email: email || null,
    };

    console.log('GitHub authentication successful for:', userData.login);
    
    // Set HTTP-only cookie for the access token
    res.cookie('github_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({
      success: true,
      user: userData,
      token: access_token, // For client-side use if needed
    });
  } catch (error) {
    console.error('GitHub OAuth error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to authenticate with GitHub',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// 404 Handler - Must be the last route
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Frontend is hosted separately on Vercel
console.log('Frontend is hosted separately on Vercel');

// Log basic server info
console.log('Server started successfully');
console.log('Available routes:');
console.log('- GET    /health');
console.log('- GET    /');
console.log('- GET    /auth/github/callback');
console.log('- POST   /api/auth/github/token');

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
});
