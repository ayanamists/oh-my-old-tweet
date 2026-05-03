import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

// Integration tests that need real R2/D1/KV bindings (via Miniflare).
// Run separately: vitest run --config vitest.workers.config.ts
export default defineWorkersConfig({
  test: {
    include: ['test/**/*.workers.test.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          r2Buckets: ['OMOT_CACHE'],
          d1Databases: ['OMOT_DB'],
        },
      },
    },
  },
});
