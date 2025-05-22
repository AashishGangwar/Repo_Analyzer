import React from 'react';

const TestInput = () => {
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
        <h1>Test Input Page</h1>
        <p>If you can see this, the basic routing is working!</p>
        <p>Now let's check the InputPage component.</p>
      </div>
    </div>
  );
};

export default TestInput;
