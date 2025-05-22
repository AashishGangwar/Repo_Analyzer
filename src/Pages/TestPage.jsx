import React from 'react';

const TestPage = () => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#0f172a',
      color: 'white',
      fontSize: '24px',
      textAlign: 'center',
      padding: '20px'
    }}>
      <div>
        <h1>Test Page</h1>
        <p>If you can see this, routing is working!</p>
        <a href="/login" style={{ color: '#60a5fa' }}>Go to Login</a>
      </div>
    </div>
  );
};

export default TestPage;
