import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base so the built dist/ works from any static host or sub-path.
  base: './',
  test: {
    include: ['src/**/*.test.ts'],
  },
});
