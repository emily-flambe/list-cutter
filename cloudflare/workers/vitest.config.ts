import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    pool: '@cloudflare/vitest-pool-workers',
    poolOptions: {
      workers: {
        miniflare: {
          compatibilityDate: '2024-12-30',
          compatibilityFlags: ['nodejs_compat'],
          bindings: {
            ENVIRONMENT: 'test',
            API_VERSION: 'v1'
          }
        }
      }
    },
    include: ['tests/**/*.test.ts']
  }
});