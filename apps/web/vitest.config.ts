import { defineConfig } from 'vitest/config';
import path from 'node:path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      // Aligned with vite.config.ts: React Compiler disabled (runtime crash with
      // reportAllChanges). Tests must validate the same transform that ships.
      babel: {},
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['**/tests/e2e/**', '**/e2e/**', '**/node_modules/**', '**/dist/**', '**/build/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', '**/__tests__/**', '**/*.{test,spec}.*', '**/*.d.ts'],
      thresholds: {
        // Ratchet floor for the whole app (baseline 2026-09: 10.15 stmts / 10.11 lines).
        // Most pages and the voice/TTS hooks are still untested. Raise these as
        // coverage improves — never lower them.
        lines: 10,
        statements: 10,
        functions: 8,
        branches: 6,
        // Stricter floors for the well-tested core — protect it from erosion.
        'src/features/auth/hooks/**': { lines: 75, statements: 76, functions: 76, branches: 72 },
        'src/features/auth/components/**': {
          lines: 84,
          statements: 84,
          functions: 76,
          branches: 84,
        },
        'src/features/audio/stores/**': { lines: 80, statements: 83, functions: 80 },
        'src/services/sse-retry.ts': { lines: 97, statements: 97, functions: 100, branches: 88 },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
