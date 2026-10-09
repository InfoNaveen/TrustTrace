import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/trusttrace/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
});
