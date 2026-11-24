import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-expect-error -- plain ESM server helper shared with production start script
import { createRoomHub } from './server/roomHub.mjs';

function coupleRoomWsPlugin(): Plugin {
  return {
    name: 'loykratong-couple-room-ws',
    configureServer(server) {
      if (server.httpServer) {
        const hub = createRoomHub();
        hub.attachToServer(server.httpServer);
        server.middlewares.use((req, res, next) => {
          if (!hub.handleInvitation(req, res)) next();
        });
      }
    },
    configurePreviewServer(server) {
      if (server.httpServer) {
        const hub = createRoomHub();
        hub.attachToServer(server.httpServer);
        server.middlewares.use((req, res, next) => {
          if (!hub.handleInvitation(req, res)) next();
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), coupleRoomWsPlugin()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
