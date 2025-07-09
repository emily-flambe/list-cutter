import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    pool: '@cloudflare/vitest-pool-workers',
    poolOptions: {
      workers: {
        miniflare: {
          compatibilityDate: '2024-12-30',
          compatibilityFlags: ['nodejs_compat'],
          kvNamespaces: ['AUTH_TOKENS', 'SECURITY_CONFIG', 'SECURITY_EVENTS', 'SECURITY_METRICS'],
          d1Databases: ['DB'],
          r2Buckets: ['FILE_STORAGE'],
          analyticsEngineDatasets: ['ANALYTICS'],
          bindings: {
            ENVIRONMENT: 'test',
            API_VERSION: 'v1',
            JWT_SECRET: 'test-secret',
            JWT_REFRESH_SECRET: 'test-refresh-secret',
            SECURITY_PERFORMANCE_THRESHOLD: '100',
            SECURITY_METRICS_RETENTION_DAYS: '30',
            SECURITY_ENABLE_REAL_TIME_MONITORING: 'true'
          },
          modules: true
        }
      }
    },
    include: ['tests/**/*.test.ts']
  }
});