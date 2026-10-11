/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { port: 5173, host: true },
  test: { env: loadEnv(mode === 'test' ? 'test' : mode, process.cwd(), '') },
}));
