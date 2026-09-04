import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 4300,
    strictPort: false,
    // The shared domain vocabulary lives outside the client root.
    fs: { allow: [path.resolve(__dirname, '..')] },
    proxy: {
      '/api': 'http://localhost:4310',
      '/uploads': 'http://localhost:4310',
    },
  },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1200 },
});
