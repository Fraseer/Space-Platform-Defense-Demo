import { defineConfig } from 'vitest/config';

// Separate from the unit tests: the balance bot is slow and only reports.
export default defineConfig({
  test: { include: ['tools/**/*.test.ts'], silent: false },
});
