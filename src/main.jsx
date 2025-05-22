import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Configure BrowserRouter with future flags to suppress warnings
const routerConfig = {
  future: {
    v7_relativeSplatPath: true,
    v7_startTransition: true,
  },
};

root.render(
  <React.StrictMode>
    <BrowserRouter {...routerConfig}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);