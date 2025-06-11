import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    totalLogins: 0,
    totalReposAnalyzed: 0,
    userLogs: []
  });
  const navigate = useNavigate();
  const location = useLocation();

  // Check for existing session on initial load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true);
        
        // Check for admin user first
        const adminUser = localStorage.getItem('adminUser');
        if (adminUser) {
          const parsedAdmin = JSON.parse(adminUser);
          console.log('Found admin user:', parsedAdmin);
          setUser(parsedAdmin);
          setIsAdmin(true);
          setIsAuthenticated(true);
          
          // Update analytics
          setAnalytics(prev => ({
            ...prev,
            totalLogins: (prev.totalLogins || 0) + 1,
            userLogs: [
              ...(prev.userLogs || []),
              {
                username: parsedAdmin.username || 'admin',
                action: 'admin_session_restored',
                time: new Date().toISOString()
              }
            ].slice(-50)
          }));
          
          setLoading(false);
          return;
        }
        
        // Check for regular user
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          console.log('Found regular user:', parsedUser);
          setUser(parsedUser);
          setIsAdmin(false);
          setIsAuthenticated(true);
        } else {
          console.log('No saved user found');
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Handle GitHub OAuth callback
  useEffect(() => {
    console.log('Checking for GitHub OAuth callback...');
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    
    console.log('OAuth callback params:', { 
      code: code ? '***' : 'null', 
      state: state ? '***' : 'null', 
      error,
      path: location.pathname,
      fullPath: location.pathname + location.search
    });
    
    // If there's an error in the OAuth flow
    if (error) {
      const errorDesc = params.get('error_description') || 'Authentication failed';
      console.error('GitHub OAuth error:', { error, errorDesc });
      
      // Clean up the URL
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      
      // Navigate to login with error
      navigate('/login', { 
        state: { 
          error: `GitHub authentication failed: ${errorDesc}`,
          errorDetails: { error, error_description: errorDesc }
        } 
      });
      return;
    }
    
    // If we have both code and state parameters
    if (code && state) {
      if (location.pathname === '/auth/github/callback') {
        console.log('Handling GitHub OAuth callback with code and state');
        handleGitHubCallback(code, state);
      } else {
        console.warn('Received OAuth code and state but path is not /auth/github/callback');
        // If we're not on the callback path but have the code, redirect to the callback
        navigate(`/auth/github/callback?code=${code}&state=${state}`, { replace: true });
      }
    } else {
      console.log('No OAuth code/state found in URL');
      
      // If we're on the callback URL but don't have code/state, redirect to login
      if (location.pathname === '/auth/github/callback') {
        console.warn('No code/state found in callback URL, redirecting to login');
        navigate('/login', { 
          state: { 
            error: 'Invalid authentication response from GitHub',
            errorDetails: { missing: !code ? 'code' : '', missingState: !state ? 'state' : '' }
          } 
        });
      }
    }
  }, [location]);

  // GitHub OAuth flow
  const loginWithGitHub = () => {
    try {
      console.log('=== GitHub OAuth Flow Debug ===');
      
      // Get client ID and callback URL from environment variables
      const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
      let callbackUrl = import.meta.env.VITE_GITHUB_CALLBACK_URL;
      
      console.log('OAuth Configuration:', {
        clientId: clientId ? '✅ Present' : '❌ Missing',
        callbackUrl: callbackUrl || '❌ Not set'
      });
      
      if (!clientId) {
        const error = 'GitHub Client ID is not set in environment variables';
        console.error('❌ Error:', error);
        throw new Error('GitHub authentication is not properly configured. Please contact support.');
      }
      
      if (!callbackUrl) {
        const error = 'GitHub Callback URL is not set in environment variables';
        console.error('❌ Error:', error);
        throw new Error('GitHub authentication is not properly configured. Please contact support.');
      }
      
      // Generate a random state parameter to prevent CSRF
      const state = Math.random().toString(36).substring(2);
      localStorage.setItem('github_auth_state', state);
      
      // Build the authorization URL
      const scope = 'read:user user:email';
      const authUrl = new URL('https://github.com/login/oauth/authorize');
      authUrl.searchParams.append('client_id', clientId);
      authUrl.searchParams.append('redirect_uri', callbackUrl);
      authUrl.searchParams.append('scope', scope);
      authUrl.searchParams.append('state', state);
      
      const finalAuthUrl = authUrl.toString();
      
      console.log('Generated OAuth URL:', {
        base: 'https://github.com/login/oauth/authorize',
        client_id: clientId,
        redirect_uri: callbackUrl,
        scope: scope,
        state: state,
        full_url: finalAuthUrl
      });
      
      console.log('🔗 Redirecting to GitHub for authentication...');
      window.location.href = finalAuthUrl;
      
    } catch (error) {
      console.error('Error in loginWithGitHub:', error);
      navigate('/login', { state: { error: error.message } });
    }
  };

  // Exchange authorization code for access token and fetch user data
  const exchangeCodeForToken = async (code) => {
    console.log('=== Exchanging Code for Token ===');
    console.log('Starting token exchange with GitHub...');
    
    try {
      const requestBody = {
        client_id: import.meta.env.VITE_GITHUB_CLIENT_ID,
        client_secret: import.meta.env.VITE_GITHUB_CLIENT_SECRET,
        code: code,
        redirect_uri: import.meta.env.VITE_GITHUB_CALLBACK_URL
      };
      
      console.log('Request body:', {
        client_id: requestBody.client_id ? '✅ Present' : '❌ Missing',
        client_secret: requestBody.client_secret ? '✅ Present' : '❌ Missing',
        code: code ? '✅ Present' : '❌ Missing',
        redirect_uri: requestBody.redirect_uri || '❌ Missing'
      });
      
      // Using Vite's proxy to avoid CORS issues
      const apiUrl = '/api/github/login/oauth/access_token';
      console.log('Sending request to local proxy:', apiUrl);
      
      const tokenResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Token exchange response status:', tokenResponse.status);
      
      const responseText = await tokenResponse.text();
      console.log('Raw response:', responseText);
      
      if (!tokenResponse.ok) {
        console.error('❌ Token exchange failed with status:', tokenResponse.status);
        let errorData;
        try {
          errorData = JSON.parse(responseText);
          console.error('Error details:', errorData);
        } catch (e) {
          console.error('Failed to parse error response:', responseText);
          throw new Error(`Failed to exchange code for token. Status: ${tokenResponse.status}`);
        }
        
        if (errorData.error_description) {
          throw new Error(`GitHub: ${errorData.error_description}`);
        }
        throw new Error(errorData.error || 'Failed to get access token from GitHub');
      }

      let tokenData;
      try {
        tokenData = JSON.parse(responseText);
        console.log('Token data received:', {
          has_access_token: !!tokenData.access_token,
          scope: tokenData.scope,
          token_type: tokenData.token_type
        });
      } catch (e) {
        console.error('Failed to parse token response:', responseText);
        throw new Error('Invalid response from GitHub');
      }
      
      if (!tokenData.access_token) {
        console.error('No access token in response:', tokenData);
        throw new Error('No access token received from GitHub');
      }

      return tokenData.access_token;
    } catch (error) {
      console.error('Error in exchangeCodeForToken:', error);
      throw new Error(`Failed to exchange code for token: ${error.message}`);
    }
  };

  // Fetch GitHub user data using access token
  const fetchGitHubUser = async (accessToken) => {
    console.log('Fetching GitHub user data...');
    try {
      // First, get user profile
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      console.log('User data response status:', userResponse.status);
      
      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        console.error('Failed to fetch user data:', errorText);
        throw new Error('Failed to fetch user data from GitHub');
      }

      const userData = await userResponse.json();
      console.log('User data received:', { 
        id: userData.id, 
        login: userData.login,
        name: userData.name,
        email: userData.email 
      });
      
      // Fetch primary email if not available in the initial response
      let email = userData.email;
      if (!email || userData.email === null) {
        console.log('No email in initial response, fetching emails...');
        try {
          const emailResponse = await fetch('https://api.github.com/user/emails', {
            headers: {
              'Authorization': `token ${accessToken}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          });
          
          if (emailResponse.ok) {
            const emails = await emailResponse.json();
            console.log('User emails:', emails);
            const primaryEmail = emails.find(e => e.primary);
            if (primaryEmail) {
              email = primaryEmail.email;
            } else if (emails.length > 0) {
              email = emails[0].email;
            }
          }
        } catch (emailError) {
          console.warn('Error fetching user emails:', emailError);
          // Continue without email if there's an error
        }
      }

      const formattedUser = {
        id: userData.id,
        name: userData.name || userData.login,
        username: userData.login,
        avatar: userData.avatar_url,
        email: email,
        // In a real app, don't store the access token in localStorage
        // Instead, use httpOnly cookies or a secure session management solution
        accessToken: accessToken
      };

      console.log('Formatted user data:', formattedUser);
      return formattedUser;
      
    } catch (error) {
      console.error('Error in fetchGitHubUser:', error);
      throw error;
    }
  };

  // Handle GitHub OAuth callback
  const handleGitHubCallback = async (code, state) => {
    console.log('=== GitHub OAuth Callback Debug ===');
    console.log('Starting OAuth callback with code and state');
    
    try {
      setLoading(true);
      
      // Verify state to prevent CSRF
      const savedState = localStorage.getItem('github_auth_state');
      console.log('State verification:', {
        savedState: savedState ? '✅ Present' : '❌ Missing',
        receivedState: state || '❌ Missing',
        stateMatch: savedState === state ? '✅ Valid' : '❌ Mismatch'
      });
      
      if (!savedState || savedState !== state) {
        const error = 'State mismatch. Possible CSRF attack or session expired.';
        console.error('❌ Security Error:', error);
        throw new Error('Session expired. Please try logging in again.');
      }
      
      console.log('Exchanging authorization code for access token...');
      const accessToken = await exchangeCodeForToken(code);
      
      if (!accessToken) {
        throw new Error('Failed to obtain access token from GitHub');
      }
      
      console.log('✅ Successfully obtained access token');
      console.log('Fetching user data from GitHub...');
      
      const userData = await fetchGitHubUser(accessToken);
      
      if (!userData || !userData.id) {
        throw new Error('Failed to fetch user data from GitHub');
      }
      
      console.log('✅ Successfully fetched user data:', {
        id: userData.id,
        username: userData.username,
        name: userData.name
      });
      
      // Save user data to state and localStorage
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('githubUser', JSON.stringify(userData));
      localStorage.removeItem('github_auth_state');
      
      // Clean up the URL
      const cleanPath = window.location.pathname;
      window.history.replaceState({}, document.title, cleanPath);
      console.log('✅ Cleaned up URL, redirecting to home page...');
      
      // Redirect to home page
      navigate('/');
      
    } catch (error) {
      console.error('❌ Error during GitHub authentication:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Clear any partial auth state
      localStorage.removeItem('githubUser');
      localStorage.removeItem('github_auth_state');
      
      // Navigate to login with error
      navigate('/login', { 
        state: { 
          error: error.message || 'Failed to authenticate with GitHub',
          errorDetails: {
            name: error.name,
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          }
        } 
      });
    } finally {
      setLoading(false);
    }
  };

  const login = (userData, isAdminUser = false) => {
    if (isAdminUser) {
      const adminUser = {
        username: 'admin',
        isAdmin: true
      };
      setUser(adminUser);
      setIsAdmin(true);
      setIsAuthenticated(true);
      localStorage.setItem('adminUser', JSON.stringify(adminUser));
      return;
    }

    const userToSet = userData || {
      name: 'Developer',
      username: 'dev',
      email: 'dev@example.com'
    };
    setUser(userToSet);
    setIsAdmin(false);
    setIsAuthenticated(true);
    localStorage.setItem('user', JSON.stringify(userToSet));
    
    // Update analytics
    setAnalytics(prev => ({
      ...prev,
      totalLogins: (prev.totalLogins || 0) + 1,
      userLogs: [
        ...(prev.userLogs || []),
        {
          username: userToSet.username,
          loginTime: new Date().toISOString(),
          action: 'login'
        }
      ].slice(-50)
    }));
  };
  
  const adminLogin = async (username, password) => {
    console.log('adminLogin called with:', { username });
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (username === 'csfirst' && password === 'Aashish') {
      const adminUser = {
        username: 'csfirst',
        name: 'Admin User',
        isAdmin: true,
        loginTime: new Date().toISOString()
      };
      
      console.log('Admin login successful, setting user state...');
      setUser(adminUser);
      setIsAdmin(true);
      setIsAuthenticated(true);
      
      // Update analytics
      setAnalytics(prev => ({
        ...prev,
        totalLogins: (prev.totalLogins || 0) + 1,
        userLogs: [
          ...(prev.userLogs || []),
          {
            username: 'admin',
            action: 'admin_login',
            time: new Date().toISOString()
          }
        ].slice(-50)
      }));
      
      // Store in localStorage
      localStorage.setItem('adminUser', JSON.stringify(adminUser));
      console.log('Admin user stored in localStorage');
      
      return true;
    }
    
    console.log('Admin login failed: Invalid credentials');
    throw new Error('Invalid admin credentials');
  };

  const logout = () => {
    if (isAdmin) {
      localStorage.removeItem('adminUser');
    } else {
      localStorage.removeItem('user');
      localStorage.removeItem('githubUser');
      localStorage.removeItem('github_auth_state');
    }
    setUser(null);
    setIsAdmin(false);
    setIsAuthenticated(false);
    navigate('/login');
  };

  // Add a repository analyzed to the analytics
  const addRepoAnalyzed = (repoName) => {
    setAnalytics(prev => ({
      ...prev,
      totalReposAnalyzed: (prev.totalReposAnalyzed || 0) + 1,
      userLogs: [
        ...(prev.userLogs || []),
        {
          username: user?.username || 'anonymous',
          action: `analyzed ${repoName}`,
          time: new Date().toISOString()
        }
      ].slice(-50)
    }));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isAuthenticated,
        loading,
        analytics,
        loginWithGitHub,
        adminLogin,
        logout,
        login,
        addRepoAnalyzed
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
