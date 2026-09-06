import path from 'node:path';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react({
      // React Compiler disabled: was causing `reportAllChanges` / `startTime` runtime crash
      // Re-enable once babel-plugin-react-compiler is verified with React 19.2 + Zustand
      babel: {},
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@pixel-mentor/web': path.resolve(__dirname, './src'),
    },
  },
  // Emit .riv animation files as hashed cacheable assets (?url imports).
  assetsInclude: ['**/*.riv'],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
