import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  root: 'frontend',
  base: process.env.FIREATLAS_BASE_PATH || '/',
  plugins: [tailwindcss()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
});
