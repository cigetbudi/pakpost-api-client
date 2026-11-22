import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiOrigin = 'http://127.0.0.1:5080';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'quickjs-emscripten-core',
      '@jitl/quickjs-singlefile-browser-release-sync',
    ],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': apiOrigin,
      // SignalR negotiation and WebSocket upgrades use the same API origin.
      '/hubs': { target: apiOrigin, ws: true },
      '/health': apiOrigin,
    },
  },
  worker: {
    format: 'es',
  },
});
