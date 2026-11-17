
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
      '/api': 'http://127.0.0.1:5080',
      // SignalR negotiate + WebSocket upgrade must reach ASP.NET Core.
      '/hubs': {target:'http://127.0.0.1:5080',ws:true},
      '/health': 'http://127.0.0.1:5080',
    },
  },

  worker: {
    format: 'es',
  },
});
