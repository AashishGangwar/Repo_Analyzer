import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleAuthCallback } = useAuth();

  useEffect(() => {
    const processAuthCallback = async () => {
      const token = searchParams.get('token');
      const user = searchParams.get('user');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      console.log('Processing auth callback with params:', { token, user, state, error });

      if (error) {
        console.error('Authentication error:', error);
        navigate('/login', { 
          state: { 
            error: 'Authentication failed',
            errorDetails: error
          },
          replace: true 
        });
        return;
      }

      if (!token || !user) {
        console.error('Missing token or user data in callback');
        navigate('/login', { 
          state: { 
            error: 'Authentication incomplete',
            errorDetails: 'Missing authentication data. Please try again.'
          },
          replace: true 
        });
        return;
      }

      try {
        // Handle the authentication callback
        await handleAuthCallback({
          token,
          user: JSON.parse(user),
          state
        });

        // Redirect to the home page or the originally requested page
        const from = searchParams.get('from') || '/';
        navigate(from, { replace: true });
      } catch (err) {
        console.error('Error processing authentication:', err);
        navigate('/login', { 
          state: { 
            error: 'Authentication error',
            errorDetails: err.message
          },
          replace: true 
        });
      }
    };

    processAuthCallback();
  }, [searchParams, navigate, handleAuthCallback]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-700">Completing authentication...</p>
      </div>
    </div>
  );
}
