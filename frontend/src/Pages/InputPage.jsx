import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import NavBar from '../Components/NavBar';
import { colors } from '../theme/colors';

const PageContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: ${colors.background.primary};
  color: ${colors.text.primary};
`;

const Content = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  padding: 12rem 2rem 2rem;
  width: 100%;
  margin-top: -2rem;
`;

const FormContainer = styled.div`
  background-color: ${colors.background.secondary};
  border-radius: 0.5rem;
  padding: 2.5rem;
  width: 100%;
  max-width: 600px;
  box-shadow: 0 4px 6px -1px ${colors.additional.shadow}, 0 2px 4px -1px rgba(0, 0, 0, 0.06);
`;

const Title = styled.h1`
  font-size: 2.25rem;
  margin-bottom: 1rem;
  color: ${colors.text.primary};
  text-align: center;
  font-weight: 700;
`;

const Description = styled.p`
  color: ${colors.text.secondary};
  margin-bottom: 2.5rem;
  text-align: center;
  font-size: 1.125rem;
  max-width: 600px;
  line-height: 1.6;
`;

const Input = styled.input`
  width: 100%;
  padding: 1rem 1.25rem;
  border: 1px solid ${colors.ui.border};
  border-radius: 0.5rem;
  background-color: ${colors.ui.inputBg};
  color: ${colors.text.primary};
  font-size: 1rem;
  margin-bottom: 1.5rem;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: ${colors.ui.primary};
    box-shadow: 0 0 0 3px ${colors.ui.primary}20;
  }
  
  &::placeholder {
    color: ${colors.text.muted};
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  background-color: ${colors.ui.primary};
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    background-color: ${colors.ui.primaryHover};
    cursor: pointer;
  }
  
  &:active:not(:disabled) {
    transform: translateY(1px);
  }
  
  &:disabled {
    background-color: ${colors.state.disabled};
    cursor: not-allowed;
    opacity: 0.8;
  }
`;

const InputPage = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    
    setIsLoading(true);
    
    try {
      // Try to extract owner/repo from URL
      const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      let owner, repo;
      
      if (match) {
        [, owner, repo] = match;
      } else {
        // If URL format is wrong, try to use as direct input
        const parts = repoUrl.split('/').filter(Boolean);
        if (parts.length >= 2) {
          [owner, repo] = parts.slice(-2);
        } else {
          throw new Error('Invalid repository format');
        }
      }
      
      // Clean up repository name (remove .git if present)
      repo = repo.replace(/\.git$/, '');
      
      // Navigate to the analyze page
      navigate(`/analyze/${owner}/${repo}`);
      
    } catch (error) {
      console.error('Error processing repository URL:', error);
      alert('Please enter a valid GitHub repository URL (e.g., https://github.com/username/repo)');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PageContainer>
      <NavBar />
      <Content>
        <Title>GitHub Repository Analyzer</Title>
        <Description>
          Enter a GitHub repository URL to analyze its code quality, 
          dependencies, and other important metrics.
        </Description>
        
        <FormContainer>
          <form onSubmit={handleSubmit}>
            <Input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/username/repository"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              disabled={!repoUrl.trim() || isLoading}
            >
              {isLoading ? 'Analyzing...' : 'Analyze Repository'}
            </Button>
          </form>
        </FormContainer>
      </Content>
    </PageContainer>
  );
};

export default InputPage;