/**
 * Environment Test Fixtures
 * 
 * Predefined environment configurations for different testing scenarios.
 */

import type { Env } from '../../src/types';

export const environmentConfigs: Record<string, Partial<Env>> = {
  development: {
    ENVIRONMENT: 'development',
    API_VERSION: 'v1',
    JWT_SECRET: 'dev-secret-at-least-32-characters-long-for-security',
    JWT_REFRESH_SECRET: 'dev-refresh-secret-at-least-32-characters-long',
    API_KEY_SALT: 'dev-api-key-salt-at-least-32-characters-long',
    SECURITY_PERFORMANCE_THRESHOLD: '100',
    SECURITY_METRICS_RETENTION_DAYS: '7',
    SECURITY_ENABLE_REAL_TIME_MONITORING: 'true',
  },
  
  test: {
    ENVIRONMENT: 'test',
    API_VERSION: 'v1',
    JWT_SECRET: 'test-secret-at-least-32-characters-long-for-security',
    JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters-long',
    API_KEY_SALT: 'test-api-key-salt-at-least-32-characters-long',
    SECURITY_PERFORMANCE_THRESHOLD: '100',
    SECURITY_METRICS_RETENTION_DAYS: '30',
    SECURITY_ENABLE_REAL_TIME_MONITORING: 'true',
  },
  
  production: {
    ENVIRONMENT: 'production',
    API_VERSION: 'v1',
    JWT_SECRET: 'prod-secret-at-least-32-characters-long-for-security',
    JWT_REFRESH_SECRET: 'prod-refresh-secret-at-least-32-characters-long',
    API_KEY_SALT: 'prod-api-key-salt-at-least-32-characters-long',
    SECURITY_PERFORMANCE_THRESHOLD: '25',
    SECURITY_METRICS_RETENTION_DAYS: '90',
    SECURITY_ENABLE_REAL_TIME_MONITORING: 'true',
  },
  
  // Insecure configurations for testing error handling
  insecureShortSecret: {
    ENVIRONMENT: 'test',
    JWT_SECRET: 'short', // Too short
    JWT_REFRESH_SECRET: 'also-short',
    API_KEY_SALT: 'tiny',
  },
  
  missingSecrets: {
    ENVIRONMENT: 'test',
    // Missing JWT_SECRET, JWT_REFRESH_SECRET, API_KEY_SALT
  },
  
  invalidValues: {
    ENVIRONMENT: 'test',
    JWT_SECRET: 'test-secret-at-least-32-characters-long-for-security',
    SECURITY_PERFORMANCE_THRESHOLD: 'invalid-number',
    SECURITY_METRICS_RETENTION_DAYS: 'not-a-number',
    SECURITY_ENABLE_REAL_TIME_MONITORING: 'maybe', // Should be true/false
  },
};

export const bindingConfigs = {
  complete: {
    kvNamespaces: ['AUTH_KV', 'SECURITY_CONFIG', 'SECURITY_EVENTS', 'SECURITY_METRICS'],
    d1Databases: ['DB'],
    r2Buckets: ['FILE_STORAGE'],
    analyticsEngineDatasets: ['ANALYTICS'],
  },
  
  minimal: {
    kvNamespaces: ['AUTH_KV'],
    d1Databases: ['DB'],
  },
  
  missing: {
    // No bindings
  },
  
  partial: {
    kvNamespaces: ['AUTH_KV'],
    // Missing D1, R2, Analytics
  },
};

export const securityConfigs = {
  strict: {
    SECURITY_PERFORMANCE_THRESHOLD: '10',
    SECURITY_METRICS_RETENTION_DAYS: '90',
    SECURITY_ENABLE_REAL_TIME_MONITORING: 'true',
  },
  
  relaxed: {
    SECURITY_PERFORMANCE_THRESHOLD: '1000',
    SECURITY_METRICS_RETENTION_DAYS: '7',
    SECURITY_ENABLE_REAL_TIME_MONITORING: 'false',
  },
  
  disabled: {
    SECURITY_PERFORMANCE_THRESHOLD: '0',
    SECURITY_METRICS_RETENTION_DAYS: '0',
    SECURITY_ENABLE_REAL_TIME_MONITORING: 'false',
  },
};

export const dbSchemas = {
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,
  
  sessions: `
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
  `,
  
  files: `
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      r2_key TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
  `,
  
  security_events: `
    CREATE TABLE IF NOT EXISTS security_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      user_id INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,
};