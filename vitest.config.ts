import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['**/*.{ts,tsx}'],
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.config.{ts,js}',
        '**/index.tsx',
        'conductor/**',
        '**/services/**'
      ],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 15,
        lines: 60
      }
    }
  }
});
