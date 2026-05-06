import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Read .env from the repo root so VITE_CESDK_LICENSE stays in sync with the
  // wizard-managed root .env (which also holds CESDK_LICENSE for the server).
  envDir: '..',
  server: {
    port: 5173,
    proxy: {
      // In Vite dev mode, the editor server runs in parallel on 3456
      // and serves the template API.
      '/api': {
        target: 'http://localhost:3456',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    // CE.SDK is a large dependency (~2.5 MB minified). Splitting it into its
    // own chunk lets the browser cache it independently of app-code changes.
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks: {
          cesdk: ['@cesdk/cesdk-js'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
