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
          setLoading(false);
          return;
        }
        
        // Check for regular user
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          console.log('Found regular user:', parsedUser);
          setUser(parsedUser);
          setIsAuthenticated(true);
          setIsAdmin(false);
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
        },
        replace: true
      });
      return;
    }
    
    // If we have both code and state parameters
    if (code && state) {
      console.log('Handling GitHub OAuth callback with code and state');
      handleGitHubCallback(code, state);
    } else if (location.pathname === '/auth/github/callback') {
      // If we're on the callback URL but don't have code/state, redirect to login
      console.warn('No code/state found in callback URL, redirecting to login');
      navigate('/login', { 
        state: { 
          error: 'Invalid authentication response from GitHub',
          errorDetails: { 
            missing: !code ? 'code' : '', 
            missingState: !state ? 'state' : '' 
          }
        },
        replace: true
      });
    }
  }, [location]);

  // GitHub OAuth flow
  const loginWithGitHub = () => {
    try {
      console.log('=== GitHub OAuth Flow Debug ===');
      
      // Always use the production callback URL to match GitHub app settings
      const clientId = 'Ov23liA914N4ENADI5iu'; // Your GitHub Client ID
      const callbackUrl = 'https://repo-analyzer-vpzo.onrender.com/auth/github/callback';
      
      console.log('OAuth Configuration:', {
        clientId: clientId ? '✅ Present' : '❌ Missing',
        callbackUrl: callbackUrl || '❌ Not set'
      });
      
      if (!clientId) {
        const error = 'GitHub Client ID is not set';
        console.error('❌ Error:', error);
        throw new Error('GitHub authentication is not properly configured. Please contact support.');
      }
      
      // Generate a random state parameter to prevent CSRF
      const state = Math.random().toString(36).substring(2);
      // Store state in both sessionStorage and localStorage for redundancy
      sessionStorage.setItem('github_oauth_state', state);
      localStorage.setItem('github_oauth_state', state);
      
      // Build the authorization URL
      const scope = 'read:user user:email';
      const authUrl = new URL('https://github.com/login/oauth/authorize');
      authUrl.searchParams.append('client_id', clientId);
      authUrl.searchParams.append('redirect_uri', callbackUrl);
      authUrl.searchParams.append('scope', scope);
      authUrl.searchParams.append('state', state);
      authUrl.searchParams.append('allow_signup', 'false');
      
      const finalAuthUrl = authUrl.toString();
      
      console.log('Generated OAuth URL:', {
        base: 'https://github.com/login/oauth/authorize',
        client_id: clientId,
        redirect_uri: callbackUrl,
        scope: scope,
        state: '***', // Don't log the actual state
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
      const backendUrl = 'https://repo-analyzer-vpzo.onrender.com';
      const tokenEndpoint = `${backendUrl}/auth/github/access_token`;
      
      console.log('Sending request to token endpoint:', tokenEndpoint);
      
      const tokenResponse = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': window.location.origin
        },
        body: JSON.stringify({
          code: code,
          // No need to send client_secret from the frontend - handled by backend
        }),
        credentials: 'include' // Important for cookies/session
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
          token_type: tokenData.token_type,
          user: tokenData.user ? '✅ Present' : '❌ Missing'
        });
        
        // If we have user data in the response, return it directly
        if (tokenData.user) {
          return {
            accessToken: tokenData.access_token,
            user: tokenData.user
          };
        }
        
      } catch (e) {
        console.error('Failed to parse token response:', responseText);
        throw new Error('Invalid response from server');
      }
      
      if (!tokenData.access_token) {
        console.error('No access token in response:', tokenData);
        throw new Error('No access token received from server');
      }

      return {
        accessToken: tokenData.access_token,
        user: null // Will be fetched in the next step if needed
      };
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
      const userResponse = await fetch('/github/user', {
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
          const emailResponse = await fetch('/github/user/emails', {
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

  // Handle the OAuth callback from the backend
  const handleAuthCallback = async ({ token, user, state }) => {
    try {
      setLoading(true);
      console.log('=== Handling Auth Callback ===');
      console.log('Received auth data:', { user, state: state ? '***' : 'none' });

      // Get state from both sessionStorage and localStorage for redundancy
      const savedSessionState = sessionStorage.getItem('github_oauth_state');
      const savedLocalState = localStorage.getItem('github_oauth_state');
      const savedState = savedSessionState || savedLocalState;
      
      console.log('State verification:', {
        savedSessionState: savedSessionState ? '✅ Present' : '❌ Missing',
        savedLocalState: savedLocalState ? '✅ Present' : '❌ Missing',
        receivedState: state || 'none',
        stateMatch: savedState === state ? '✅ Valid' : '❌ Mismatch'
      });

      // Only check state if it was provided (for backward compatibility)
      if (state && (!savedState || savedState !== state)) {
        // Clear states to prevent reuse
        sessionStorage.removeItem('github_oauth_state');
        localStorage.removeItem('github_oauth_state');
        throw new Error('Session expired or invalid state. Please try logging in again.');
      }

      // Clear the states to prevent replay attacks
      sessionStorage.removeItem('github_oauth_state');
      localStorage.removeItem('github_oauth_state');

      // Validate required user data
      if (!user || !user.id) {
        throw new Error('Invalid user data received from authentication provider');
      }

      // Store the token and user data
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Update state
      setUser(user);
      setToken(token);
      setIsAuthenticated(true);
      
      // Update analytics
      setAnalytics(prev => ({
        ...prev,
        totalLogins: (prev.totalLogins || 0) + 1,
        userLogs: [
          ...(prev.userLogs || []),
          {
            username: user.login || 'unknown',
            action: 'github_login',
            time: new Date().toISOString(),
            source: 'github'
          }
        ].slice(-50)
      }));
      
      // Initialize analytics if needed
      if (window.analytics) {
        window.analytics.identify(user.id, {
          name: user.name,
          email: user.email,
          login: user.login,
          avatar: user.avatar_url
        });
      }
      
      console.log('✅ Authentication successful');
      return user;
      
    } catch (error) {
      console.error('Error in handleAuthCallback:', error);
      // Clear any partial auth state on error
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Handle GitHub OAuth callback (legacy, can be removed after migration)
  const handleGitHubCallback = async (code, state) => {
    console.log('=== GitHub OAuth Callback Debug ===');
    console.log('Starting OAuth callback with code and state');
    
    try {
      setLoading(true);
      
      // Verify state to prevent CSRF
      const savedState = sessionStorage.getItem('github_oauth_state') || 
                       localStorage.getItem('github_oauth_state');
      console.log('State verification:', {
        savedState: savedState ? '✅ Present' : '❌ Missing',
        receivedState: state || '❌ Missing',
        stateMatch: savedState === state ? '✅ Valid' : '❌ Mismatch'
      });
      
      // Clean up the state regardless of the result
      sessionStorage.removeItem('github_oauth_state');
      localStorage.removeItem('github_oauth_state');
      
      if (!savedState || savedState !== state) {
        const error = 'State mismatch. Possible CSRF attack or session expired.';
        console.error('❌ Security Error:', error);
        throw new Error('Session expired. Please try logging in again.');
      }
      
      console.log('Exchanging authorization code for access token...');
      const { accessToken, user } = await exchangeCodeForToken(code);
      
      // If we already have user data from the token exchange, use it
      if (user) {
        console.log('User data received from token exchange:', { 
          id: user.id, 
          username: user.username || user.login,
          email: user.email 
        });
        
        // Save user data to localStorage
        localStorage.setItem('user', JSON.stringify(user));
        setUser(user);
        setIsAuthenticated(true);
        setIsAdmin(false);
        
        // Update analytics
        setAnalytics(prev => ({
          ...prev,
          totalLogins: (prev.totalLogins || 0) + 1,
          userLogs: [
            ...(prev.userLogs || []),
            {
              username: user.username || user.login || 'unknown',
              action: 'github_login',
              time: new Date().toISOString(),
              source: 'github'
            }
          ].slice(-50)
        }));
        
        // Clean up the URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        
        // Redirect to home page
        navigate('/');
        return;
      }
      
      if (!accessToken) {
        throw new Error('No access token received from server');
      }
      
      console.log('Successfully obtained access token');
      
      // Fetch user data using the access token
      console.log('Fetching user data from GitHub...');
      const userData = await fetchGitHubUser(accessToken);
      
      // Save user data to localStorage
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      setIsAuthenticated(true);
      setIsAdmin(false);
      
      // Update analytics
      setAnalytics(prev => ({
        ...prev,
        totalLogins: (prev.totalLogins || 0) + 1,
        userLogs: [
          ...(prev.userLogs || []),
          {
            username: userData.username || userData.login || 'unknown',
            action: 'github_login',
            time: new Date().toISOString(),
            source: 'github'
          }
        ].slice(-50)
      }));
      
      // Clean up the URL
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      
      // Redirect to home page or the page they were trying to access
      const from = location.state?.from?.pathname || '/';
      console.log(`✅ Login successful, redirecting to ${from}`);
      navigate(from, { replace: true });
      
    } catch (error) {
      console.error('Error in handleGitHubCallback:', error);
      
      // Clean up any stored state on error
      sessionStorage.removeItem('github_oauth_state');
      localStorage.removeItem('github_oauth_state');
      
      // Navigate to login with error
      navigate('/login', { 
        state: { 
          error: error.message || 'Failed to authenticate with GitHub',
          errorDetails: error
        },
        replace: true
      });
    } finally {
      setLoading(false);
    }
  };

  // Admin login function
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
      
      // Store in localStorage
      localStorage.setItem('adminUser', JSON.stringify(adminUser));
      console.log('Admin user stored in localStorage');
      
      return true;
    }
    
    console.log('Admin login failed: Invalid credentials');
    throw new Error('Invalid admin credentials');
  };

  // Logout function
  const logout = () => {
    if (isAdmin) {
      localStorage.removeItem('adminUser');
    } else {
      localStorage.removeItem('user');
    }
    
    // Clear all auth-related data
    sessionStorage.removeItem('github_oauth_state');
    localStorage.removeItem('github_oauth_state');
    
    // Reset state
    setUser(null);
    setIsAdmin(false);
    setIsAuthenticated(false);
    
    // Redirect to login page
    navigate('/login', { replace: true });
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
        handleAuthCallback
      }}
    >
      {children}
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
