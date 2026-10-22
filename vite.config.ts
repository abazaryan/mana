/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build number: UTC time of the build as YYYYMMDDHHmm (src/core/build.ts, Р36).
const BUILD = Number(new Date().toISOString().slice(0, 16).replace(/\D/g, ''));

// Relative base: the app works under any GitHub Pages path (/<repo>/).
export default defineConfig({
  base: './',
  plugins: [react()],
  define: { __MANA_BUILD__: JSON.stringify(BUILD) },
  test: {
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
  },
});
