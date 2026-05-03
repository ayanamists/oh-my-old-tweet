import { defineConfig } from 'vitest/config';

// Pure-logic unit tests (no Workers runtime needed).
// For integration tests that need real R2/D1 bindings, use vitest.workers.config.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
