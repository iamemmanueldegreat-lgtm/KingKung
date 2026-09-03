import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    server: {
      host: '0.0.0.0',
      allowedHosts: true as true,
      // Replit's embedded preview should expose only the application port.
      // HMR opens a second socket port that can be routed as "Upgrade Required".
      hmr: false,
      ws: false as false,
      watch: {
        ignored: ['**/.local/**', '**/.cache/**', '**/node_modules/**'],
      },
    },
  };
});
