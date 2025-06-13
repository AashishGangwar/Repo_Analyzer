import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Helper to clean up URL after successful auth
const cleanUrl = () => {
  const cleanUri = window.location.origin + window.location.pathname;
  window.history.replaceState({}, document.title, cleanUri);
};

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { handleAuthCallback } = useAuth();

  const hasProcessed = useRef(false);

  useEffect(() => {
    const processAuthCallback = async () => {
      // Prevent multiple executions
      if (hasProcessed.current) return;
      hasProcessed.current = true;

      try {
        console.log('=== AuthCallback Mounted ===');
        console.log('URL Search Params:', Object.fromEntries([...searchParams]));
        
        const token = searchParams.get('token');
        const userParam = searchParams.get('user');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        console.log('Processing auth callback with params:', { 
          hasToken: !!token, 
          hasUser: !!userParam, 
          state: state ? '***' : 'none',
          error: error || 'none'
        });

        // Handle OAuth errors
        if (error) {
          console.error('OAuth error from provider:', error);
          const errorDesc = searchParams.get('error_description') || 'Authentication failed';
          cleanUrl();
          navigate('/login', { 
            state: { 
              error: `Authentication failed: ${error}`,
              errorDetails: errorDesc
            },
            replace: true 
          });
          return;
        }

        // Validate required parameters
        if (!token || !userParam) {
          console.error('Missing required parameters:', { token: !!token, user: !!userParam });
          cleanUrl();
          navigate('/login', { 
            state: { 
              error: 'Authentication incomplete',
              errorDetails: 'Missing required authentication data.'
            },
            replace: true 
          });
          return;
        }

        // Parse user data
        let userData;
        try {
          userData = JSON.parse(decodeURIComponent(userParam));
          console.log('Parsed user data:', userData);
        } catch (e) {
          console.error('Failed to parse user data:', e);
          throw new Error('Invalid user data received');
        }

        // Process the authentication
        console.log('Calling handleAuthCallback...');
        await handleAuthCallback({
          token,
          user: userData,
          state
        });

        // Get the original URL or default to dashboard
        const from = location.state?.from?.pathname || '/';
        console.log('Authentication successful, redirecting to:', from);
        
        // Clean up the URL and redirect
        cleanUrl();
        navigate(from, { replace: true });
        
      } catch (err) {
        console.error('Error in AuthCallback:', err);
        cleanUrl();
        navigate('/login', { 
          state: { 
            error: 'Authentication Failed',
            errorDetails: err.message || 'An error occurred during authentication',
            errorStack: process.env.NODE_ENV === 'development' ? err.stack : undefined
          },
          replace: true 
        });
      }
    };

    processAuthCallback();
  }, [searchParams, navigate, handleAuthCallback, location.state]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Completing Authentication</h2>
        <p className="text-gray-600 dark:text-gray-300">Please wait while we log you in...</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">This may take a few moments</p>
      </div>
    </div>
  );
}
