require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Validate route paths to prevent path-to-regexp errors
// Debug log
console.log('Starting server with configuration:');
console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`- PORT: ${PORT}`);
console.log(`- GITHUB_CLIENT_ID: ${process.env.GITHUB_CLIENT_ID ? 'Set' : 'Not set'}`);

// CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'https://repo-analyzer-2ra5.vercel.app',
  'https://repo-analyzer-2ra5.vercel.app'
].filter(Boolean);

// Add body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS for all routes
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Allow requests with no origin (like mobile apps or curl requests)
  if (!origin) return next();
  
  // Check if origin is allowed
  if (allowedOrigins.some(allowedOrigin => 
    origin === allowedOrigin || 
    origin.replace(/\/$/, '') === allowedOrigin.replace(/\/$/, '')
  )) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});
app.use(express.json());

// Root route
console.log('Registering GET route: /');
app.get('/', (req, res) => {
  res.json({ 
    status: 'Server is running', 
    endpoints: {
      githubAuth: '/api/auth/github/token',
      // Add other endpoints here
    }
  });
});

// GitHub OAuth callback endpoint
console.log('Registering GET route: /auth/github/callback');
app.get('/auth/github/callback', async (req, res) => {
  console.log('GitHub OAuth callback received', { query: req.query });
  
  const { code, state, error, error_description, error_uri } = req.query;
  
  // Verify state parameter to prevent CSRF attacks
  if (!state) {
    console.error('Missing state parameter in OAuth callback');
    return res.status(400).json({
      success: false,
      error: 'Missing state parameter',
      message: 'Authentication failed due to missing state parameter.'
    });
  }
  
  // Note: In a real application, you would verify the state parameter matches what was sent
  // Since we can't access the frontend's session storage here, we'll trust the state for now
  // In production, consider using a session store or signed cookies to verify the state
  console.log('OAuth state parameter:', state);
  
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

    // Redirect to frontend with user data
    // In production, you should use a proper JWT or session token
    const frontendUrl = allowedOrigins[0] || 'https://repo-analyzer-2ra5.vercel.app';
    const userDataParam = encodeURIComponent(JSON.stringify(userData));
    const redirectUrl = new URL('/dashboard', frontendUrl);
    redirectUrl.searchParams.set('user', userDataParam);
    
    console.log('Redirecting to:', redirectUrl.toString());
    return res.redirect(redirectUrl.toString());
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

// Frontend is hosted separately on Vercel
console.log('Frontend is hosted separately on Vercel');

// Log all registered routes for debugging
console.log('Registered API routes:');
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    // Routes registered directly on the app
    console.log(`- ${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    // Routes added as router
    middleware.handle.stack.forEach((handler) => {
      if (handler.route) {
        console.log(`- ${Object.keys(handler.route.methods).join(', ').toUpperCase()} ${handler.route.path}`);
      }
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
});
