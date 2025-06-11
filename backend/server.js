require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

// Debug log
console.log('Starting server with configuration:');
console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`- PORT: ${PORT}`);
console.log(`- GITHUB_CLIENT_ID: ${process.env.GITHUB_CLIENT_ID ? 'Set' : 'Not set'}`);

// CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'https://repo-analyzer-2ra5.vercel.app',
  'https://repo-analyzer-2ra5.vercel.app/'
];

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
app.get('/', (req, res) => {
  res.json({ 
    status: 'Server is running', 
    endpoints: {
      githubAuth: '/api/auth/github/token',
      // Add other endpoints here
    }
  });
});

// GitHub OAuth token exchange endpoint
app.post('/api/auth/github/token', async (req, res) => {
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
