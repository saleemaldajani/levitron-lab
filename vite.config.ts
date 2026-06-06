import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Codespaces: host:true exposes the dev server; HMR clientPort 443 for HTTPS proxy
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    hmr: {
      clientPort: 443,
    },
  },
});
