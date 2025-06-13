import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: 'localhost',
    strictPort: true,
    proxy: {
      // Proxy API requests to your backend
      '/api': {
        target: 'https://repo-analyzer-vpzo.onrender.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      // Proxy OAuth requests to backend
      '/auth': {
        target: 'https://repo-analyzer-vpzo.onrender.com',
        changeOrigin: true,
        secure: true
      },
      // Proxy GitHub API requests
      '/github': {
        target: 'https://api.github.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/github/, '')
      }
    },
    headers: {
      'Content-Security-Policy': `
        default-src 'self';
        script-src 'self' 'unsafe-inline' 'unsafe-eval';
        style-src 'self' 'unsafe-inline' https://github.githubassets.com;
        img-src 'self' data: https:;
        font-src 'self' data: https://github.githubassets.com;
        connect-src 'self' 
          https://api.github.com 
          https://github.com 
          http://localhost:5173/api/github
          http://localhost:5173;
        frame-src 'self' https://github.com;
        form-action 'self' https://github.com;
      `.replace(/\s+/g, ' ').trim()
    }
  },
  define: {
    'process.env': {}
  },
});
