import React from 'react';
import { useParams } from 'react-router-dom';
import PropTypes from 'prop-types';

// Styles
const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f2f5',
    padding: '20px',
    textAlign: 'center'
  },
  title: {
    color: '#333',
    marginBottom: '20px'
  },
  card: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    maxWidth: '600px',
    width: '100%'
  }
};

/**
 * SimpleAnalyze Component
 * Displays repository analysis information
 */
const SimpleAnalyze = () => {
  const { owner, repo } = useParams();
  
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Simple Analyze Page</h1>
      <div style={styles.card}>
        <h2>Repository Information</h2>
        <p><strong>Owner:</strong> {owner || 'Not provided'}</p>
        <p><strong>Repository:</strong> {repo || 'Not provided'}</p>
        <p style={{ marginTop: '20px', color: '#666' }}>
          This is a simplified version of the analyze page to test basic rendering.
        </p>
      </div>
    </div>
  );
};

export default SimpleAnalyze;
