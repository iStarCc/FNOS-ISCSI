import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  base: '/app/fnnas-iscsi/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/app/fnnas-iscsi/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
