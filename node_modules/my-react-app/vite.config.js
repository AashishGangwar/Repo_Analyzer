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
      // Proxy API requests to avoid CORS issues
      '/api/github': {
        target: 'https://github.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/github/, '')
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
