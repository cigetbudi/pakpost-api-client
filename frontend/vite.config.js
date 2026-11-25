
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const apiOrigin = 'http://127.0.0.1:5080';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: [
      'quickjs-emscripten-core',
      '@jitl/quickjs-singlefile-browser-release-sync',
    ],
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,

    // Allow local HTTPS reverse proxy (Caddy)
    allowedHosts: ['pakpost.local.test'],

    proxy: {
      '/api': apiOrigin,
      // SignalR negotiation and WebSocket upgrades use the same API origin.
      '/hubs': { target: apiOrigin, ws: true },
      '/health': apiOrigin,
    },
  },
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          const path = id.replaceAll('\\', '/');
          if (!path.includes('/node_modules/')) return;
          if (/\/node_modules\/(?:react|react-dom|scheduler)\//.test(path)) return 'vendor-react';
          if (/\/node_modules\/@lezer\//.test(path)) return 'vendor-parser';
          if (/\/node_modules\/@codemirror\/lang-/.test(path)) return 'vendor-editor-languages';
          if (/\/node_modules\/(?:@codemirror|@uiw)\//.test(path)) return 'vendor-editor';
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
});
