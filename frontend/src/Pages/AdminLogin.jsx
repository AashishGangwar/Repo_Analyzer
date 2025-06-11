import React, { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaSignInAlt, FaSpinner } from 'react-icons/fa';
import PropTypes from 'prop-types';

// Constants
const INITIAL_FORM_STATE = {
  username: '',
  password: ''
};

const INITIAL_TOUCHED_STATE = {
  username: false,
  password: false
};

/**
 * AdminLogin Component
 * Handles admin authentication with username and password
 */
const AdminLogin = () => {
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [touched, setTouched] = useState(INITIAL_TOUCHED_STATE);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { username, password } = formData;
  const isFormValid = username.trim() !== '' && password.trim() !== '';

  // Load saved credentials if "Remember me" was checked
  useEffect(() => {
    const savedUsername = localStorage.getItem('savedUsername');
    if (savedUsername) {
      setFormData(prev => ({ ...prev, username: savedUsername }));
      setRememberMe(true);
    }
  }, []);

  // Save or clear credentials based on "Remember me"
  useEffect(() => {
    if (rememberMe && username) {
      localStorage.setItem('savedUsername', username);
    } else if (!rememberMe) {
      localStorage.removeItem('savedUsername');
    }
  }, [rememberMe, username]);

  // Handlers
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value.trimStart()
    }));
  }, []);

  const handleBlur = useCallback((field) => {
    setTouched(prev => ({
      ...prev,
      [field]: true
    }));
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!isFormValid) {
      setTouched({
        username: true,
        password: true
      });
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      // Save username to localStorage if "Remember me" is checked
      if (rememberMe) {
        localStorage.setItem('savedUsername', username);
      } else {
        localStorage.removeItem('savedUsername');
      }
      
      // Use the login function from AuthContext
      await login(username, password);
      navigate('/admin/dashboard');
    } catch (err) {
      console.error('Login failed:', err);
      setError(err.response?.data?.message || 'Invalid username or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [username, password, isFormValid, login, navigate, rememberMe]);

  const handleRememberMeChange = useCallback((e) => {
    setRememberMe(e.target.checked);
    if (!e.target.checked) {
      localStorage.removeItem('savedUsername');
    } else if (username) {
      localStorage.setItem('savedUsername', username);
    }
  }, [username]);

  // Render Functions
  const renderErrorAlert = () => (
    error && (
      <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    )
  );

  const renderFormField = (name, type = 'text', label) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={formData[name]}
        onChange={handleChange}
        onBlur={() => handleBlur(name)}
        className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
          touched[name] && !formData[name] ? 'border-red-500' : 'border-gray-300'
        }`}
        placeholder={`Enter your ${label.toLowerCase()}`}
        disabled={isLoading}
      />
      {touched[name] && !formData[name] && (
        <p className="mt-1 text-sm text-red-600">{label} is required</p>
      )}
    </div>
  );

  const renderLoginButton = () => (
    <button
      type="submit"
      disabled={!isFormValid || isLoading}
      className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${
        !isFormValid || isLoading
          ? 'bg-indigo-300 cursor-not-allowed'
          : 'bg-indigo-600 hover:bg-indigo-700'
      } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
    >
      {isLoading ? (
        <>
          <FaSpinner className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
          Signing in...
        </>
      ) : (
        <>
          <FaSignInAlt className="-ml-1 mr-3 h-5 w-5" />
          Sign in
        </>
      )}
    </button>
  );

  const renderSocialLogin = () => (
    <div className="mt-6">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Or continue with</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <SocialButton
          provider="GitHub"
          icon={
            <path
              fillRule="evenodd"
              d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.842-2.339 4.687-4.566 4.933.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C17.14 18.204 20 14.437 20 10.017 20 4.484 15.522 0 10 0z"
              clipRule="evenodd"
            />
          }
        />
        <SocialButton
          provider="Google"
          icon={
            <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
          }
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white p-8 rounded-2xl shadow-xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Portal</h1>
            <p className="text-gray-500">Sign in to access the dashboard</p>
          </div>
          
          {renderErrorAlert()}
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              {renderFormField('username', 'text', 'Username')}
              {renderFormField('password', 'password', 'Password')}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={handleRememberMeChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <Link to="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
                  Forgot your password?
                </Link>
              </div>
            </div>

            <div>
              {renderLoginButton()}
            </div>
          </form>

          {renderSocialLogin()}
        </div>
      </div>
    </div>
  );
};

// Social Button Component
const SocialButton = ({ provider, icon }) => (
  <a
    href="#"
    className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
  >
    <span className="sr-only">Sign in with {provider}</span>
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      {icon}
    </svg>
  </a>
);

SocialButton.propTypes = {
  provider: PropTypes.string.isRequired,
  icon: PropTypes.node.isRequired
};

AdminLogin.propTypes = {
  // No props needed as we're using AuthContext directly
};

export default AdminLogin;
