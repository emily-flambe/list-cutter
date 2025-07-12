import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    pool: '@cloudflare/vitest-pool-workers',
    poolOptions: {
      workers: {
        miniflare: {
          compatibilityDate: '2024-12-30',
          compatibilityFlags: ['nodejs_compat'],
          kvNamespaces: ['AUTH_KV', 'SECURITY_CONFIG', 'SECURITY_EVENTS', 'SECURITY_METRICS'],
          d1Databases: ['DB'],
          r2Buckets: ['FILE_STORAGE'],
          analyticsEngineDatasets: ['ANALYTICS'],
          bindings: {
            ENVIRONMENT: 'test',
            API_VERSION: 'v1',
            JWT_SECRET: 'test-secret-at-least-32-characters-long-for-security',
            JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters-long-for-security',
            API_KEY_SALT: 'test-api-key-salt-at-least-32-characters-long-for-security',
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