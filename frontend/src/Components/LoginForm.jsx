import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
import { FaGithub, FaUserShield } from 'react-icons/fa';

const LoginForm = () => {
  const { loginWithGitHub, adminLogin } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  
  const handleGitHubLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      console.log('=== GitHub Login Button Clicked ===');
      const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
      const callbackUrl = encodeURIComponent(import.meta.env.VITE_GITHUB_CALLBACK_URL);
      const scope = encodeURIComponent('user:email');
      
      console.log('OAuth Parameters:', { clientId, callbackUrl });
      
      // Redirect to GitHub OAuth
      window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${callbackUrl}&scope=${scope}`;
    } catch (err) {
      console.error('GitHub login error:', err);
      setError('Failed to initiate GitHub login. Please try again.');
      setIsLoading(false);
    }
  };
  
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }
    
    try {
      setIsLoading(true);
      const success = await adminLogin(username, password);
      
      if (success) {
        navigate('/admin/dashboard');
      } else {
        setError('Invalid admin credentials');
      }
    } catch (err) {
      console.error('Admin login error:', err);
      setError('Failed to log in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <StyledWrapper>
      <div className="form-container">
        <p className="title">Github Repo Analyzer</p>
        <p className="subtitle">Login</p>
        <form className="form">
          <div className="input-group">
            <label htmlFor="username">Username (Admin)</label>
            <input 
              type="text" 
              name="username" 
              id="username" 
              placeholder="Admin Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password (Admin)</label>
            <input 
              type="password" 
              name="password" 
              id="password" 
              placeholder="Admin Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin(e)}
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button 
            type="button" 
            className="sign"
            onClick={handleAdminLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              'Signing in...'
            ) : (
              <>
                <FaUserShield className="admin-icon" />
                <span>Sign in (Admin)</span>
              </>
            )}
          </button>
          <button 
            type="button" 
            className="github-signin"
            onClick={handleGitHubLogin}
            disabled={isLoading}
          >
            <FaGithub className="github-icon" />
            <span>Continue with GitHub</span>
          </button>
        </form>
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  .form-container {
    width: 100%;
    max-width: 400px;
    padding: 2rem;
    border-radius: 0.75rem;
    background-color: rgb(18, 26, 43);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    
    .title {
      font-size: 1.5rem;
      font-weight: 700;
      text-align: center;
      color: rgb(255, 255, 255);
      margin-bottom: 0.5rem;
    }
    
    .subtitle {
      font-size: 1.125rem;
      text-align: center;
      color: rgb(255, 255, 255);
      margin-bottom: 1.5rem;
    }
    
    .form {
      width: 100%;
    }
    
    .input-group {
      margin-bottom: 1rem;
      
      label {
        display: block;
        margin-bottom: 0.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: rgb(255, 255, 255);
      }
      
      input {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #2d3748;
        border-radius: 0.375rem;
        background-color: rgb(26, 32, 44);
        color: white;
        font-size: 1rem;
        transition: border-color 0.2s, box-shadow 0.2s;
        
        &:focus {
          outline: none;
          border-color: #4f46e5;
          box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.5);
        }
        
        &::placeholder {
          color: #a0aec0;
        }
        
        &:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
      }
    }
    
    .sign {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      background-color: #6d28d9;
      color: white;
      padding: 0.75rem 1rem;
      border: none;
      border-radius: 0.375rem;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      margin: 1rem 0;
      
      &:hover {
        background-color: #5b21b6;
        transform: translateY(-1px);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      }
      
      &:disabled {
        opacity: 0.7;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }
      
      .admin-icon {
        font-size: 1.1rem;
      }
    }
    
    .github-signin {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      width: 100%;
      background-color: #24292e;
      color: white;
      border: none;
      border-radius: 0.375rem;
      padding: 0.75rem;
      font-weight: 500;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover {
        background-color: #1a1f24;
        transform: translateY(-1px);
      }
      
      &:disabled {
        opacity: 0.7;
        cursor: not-allowed;
        transform: none;
      }
      
      .github-icon {
        font-size: 1.25rem;
      }
    }
    
    .error-message {
      color: #f87171;
      font-size: 0.875rem;
      margin: -0.5rem 0 0.5rem;
      text-align: center;
    }
  }
`;

export default LoginForm;
