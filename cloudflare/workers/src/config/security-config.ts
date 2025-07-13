/**
 * Centralized Security Configuration Management
 * 
 * This module provides a centralized approach to managing security configurations
 * across the entire application. It supports dynamic configuration updates via 
 * KV store and provides type-safe access to security settings.
 */

export interface SecurityPolicy {
  // Index signature to allow Record<string, unknown> conversion
  [key: string]: unknown;
  
  // Authentication & Authorization
  auth: {
    jwtExpirationSeconds: number;
    refreshTokenExpirationSeconds: number;
    maxLoginAttempts: number;
    lockoutDurationMinutes: number;
    requireMfa: boolean;
    passwordMinLength: number;
    passwordRequireSpecialChars: boolean;
    allowedOrigins: string[];
  };
  
  // File Upload Security
  fileUpload: {
    maxFileSize: number;
    maxFilesPerHour: number;
    maxTotalSizePerHour: number;
    allowedMimeTypes: string[];
    allowedExtensions: string[];
    enableMagicByteValidation: boolean;
    enableContentScanning: boolean;
    quarantineHighRiskFiles: boolean;
    virusScanTimeout: number;
  };
  
  // Rate Limiting
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
    standardHeaders: boolean;
    legacyHeaders: boolean;
  };
  
  // Security Headers
  headers: {
    contentSecurityPolicy: string;
    strictTransportSecurity: string;
    xFrameOptions: string;
    xContentTypeOptions: string;
    referrerPolicy: string;
    permissionsPolicy: string;
    expectCt: string;
    crossOriginResourcePolicy: string;
    crossOriginOpenerPolicy: string;
    crossOriginEmbedderPolicy: string;
  };
  
  // Data Protection
  dataProtection: {
    enableEncryptionAtRest: boolean;
    enableEncryptionInTransit: boolean;
    piiDetectionEnabled: boolean;
    dataRetentionDays: number;
    enableAuditLogging: boolean;
    enableDataLineageTracking: boolean;
  };
  
  // Monitoring & Alerting
  monitoring: {
    enableSecurityMetrics: boolean;
    enableThreatDetection: boolean;
    enableAnomalyDetection: boolean;
    alertThresholds: {
      failedLoginAttempts: number;
      suspiciousFileUploads: number;
      rateLimitExceeded: number;
      securityViolations: number;
    };
    metricsRetentionDays: number;
  };
  
  // Version and metadata
  version: string;
  lastUpdated: string;
  environment: 'development' | 'production';
}

export interface SecurityConfigOptions {
  kvNamespace: KVNamespace;
  environment: 'development' | 'production';
  enableDynamicUpdates: boolean;
  cacheExpirationMinutes: number;
  fallbackToDefaults: boolean;
}

/**
 * Centralized Security Configuration Manager
 * 
 * Provides unified access to security configurations with support for:
 * - Dynamic configuration updates via KV store
 * - Environment-specific settings
 * - Performance monitoring integration
 * - Type-safe configuration access
 */
export class SecurityConfigManager {
  private kvNamespace: KVNamespace;
  private environment: string;
  private enableDynamicUpdates: boolean;
  private cacheExpirationMinutes: number;
  private fallbackToDefaults: boolean;
  
  private cachedConfig: SecurityPolicy | null = null;
  private lastCacheUpdate: number = 0;
  
  private static readonly CONFIG_KEY = 'security-config';
  
  constructor(options: SecurityConfigOptions) {
    this.kvNamespace = options.kvNamespace;
    this.environment = options.environment;
    this.enableDynamicUpdates = options.enableDynamicUpdates;
    this.cacheExpirationMinutes = options.cacheExpirationMinutes;
    this.fallbackToDefaults = options.fallbackToDefaults;
  }
  
  /**
   * Get current security configuration
   */
  async getConfig(): Promise<SecurityPolicy> {
    // Check cache first
    if (this.isCacheValid() && this.cachedConfig) {
      return this.cachedConfig;
    }
    
    try {
      // Try to load from KV store if dynamic updates are enabled
      if (this.enableDynamicUpdates) {
        const storedConfig = await this.loadFromKV();
        if (storedConfig) {
          this.cachedConfig = storedConfig;
          this.lastCacheUpdate = Date.now();
          return storedConfig;
        }
      }
      
      // Fall back to default configuration
      const defaultConfig = this.getDefaultConfig();
      this.cachedConfig = defaultConfig;
      this.lastCacheUpdate = Date.now();
      return defaultConfig;
      
    } catch (error) {
      console.error('Failed to load security configuration:', error);
      
      // Return cached config if available, otherwise defaults
      if (this.cachedConfig) {
        return this.cachedConfig;
      }
      
      if (this.fallbackToDefaults) {
        return this.getDefaultConfig();
      }
      
      throw new Error('Security configuration unavailable and fallback disabled');
    }
  }
  
  /**
   * Update security configuration
   */
  async updateConfig(config: Partial<SecurityPolicy>): Promise<void> {
    if (!this.enableDynamicUpdates) {
      throw new Error('Dynamic configuration updates are disabled');
    }
    
    try {
      const currentConfig = await this.getConfig();
      const updatedConfig: SecurityPolicy = {
        ...currentConfig,
        ...config,
        version: crypto.randomUUID(),
        lastUpdated: new Date().toISOString(),
        environment: this.environment as SecurityPolicy['environment']
      };
      
      await this.saveToKV(updatedConfig);
      
      // Update cache
      this.cachedConfig = updatedConfig;
      this.lastCacheUpdate = Date.now();
      
    } catch (error) {
      console.error('Failed to update security configuration:', error);
      throw error;
    }
  }
  
  /**
   * Get configuration for a specific security domain
   */
  async getAuthConfig(): Promise<SecurityPolicy['auth']> {
    const config = await this.getConfig();
    return config.auth;
  }
  
  async getFileUploadConfig(): Promise<SecurityPolicy['fileUpload']> {
    const config = await this.getConfig();
    return config.fileUpload;
  }
  
  async getRateLimitConfig(): Promise<SecurityPolicy['rateLimit']> {
    const config = await this.getConfig();
    return config.rateLimit;
  }
  
  async getHeadersConfig(): Promise<SecurityPolicy['headers']> {
    const config = await this.getConfig();
    return config.headers;
  }
  
  async getDataProtectionConfig(): Promise<SecurityPolicy['dataProtection']> {
    const config = await this.getConfig();
    return config.dataProtection;
  }
  
  async getMonitoringConfig(): Promise<SecurityPolicy['monitoring']> {
    const config = await this.getConfig();
    return config.monitoring;
  }
  
  /**
   * Validate configuration integrity
   */
  async validateConfig(config: SecurityPolicy): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    // Auth validation
    if (config.auth.jwtExpirationSeconds < 300) {
      errors.push('JWT expiration must be at least 5 minutes');
    }
    
    if (config.auth.maxLoginAttempts < 1) {
      errors.push('Max login attempts must be at least 1');
    }
    
    if (config.auth.passwordMinLength < 8) {
      errors.push('Password minimum length must be at least 8 characters');
    }
    
    // File upload validation
    if (config.fileUpload.maxFileSize < 1024) {
      errors.push('Max file size must be at least 1KB');
    }
    
    if (config.fileUpload.maxFilesPerHour < 1) {
      errors.push('Max files per hour must be at least 1');
    }
    
    if (config.fileUpload.allowedMimeTypes.length === 0) {
      errors.push('At least one MIME type must be allowed');
    }
    
    // Rate limiting validation
    if (config.rateLimit.enabled && config.rateLimit.windowMs < 1000) {
      errors.push('Rate limit window must be at least 1 second');
    }
    
    if (config.rateLimit.enabled && config.rateLimit.maxRequests < 1) {
      errors.push('Max requests must be at least 1');
    }
    
    // Data protection validation
    if (config.dataProtection.dataRetentionDays < 1) {
      errors.push('Data retention must be at least 1 day');
    }
    
    // Monitoring validation
    if (config.monitoring.metricsRetentionDays < 1) {
      errors.push('Metrics retention must be at least 1 day');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    if (!this.cachedConfig) return false;
    
    const cacheAge = Date.now() - this.lastCacheUpdate;
    const maxAge = this.cacheExpirationMinutes * 60 * 1000;
    
    return cacheAge < maxAge;
  }
  
  /**
   * Load configuration from KV store
   */
  private async loadFromKV(): Promise<SecurityPolicy | null> {
    try {
      const configKey = `${SecurityConfigManager.CONFIG_KEY}-${this.environment}`;
      const configData = await this.kvNamespace.get(configKey);
      
      if (!configData) {
        return null;
      }
      
      const config = JSON.parse(configData) as SecurityPolicy;
      
      // Validate loaded configuration
      const validation = await this.validateConfig(config);
      if (!validation.valid) {
        console.error('Invalid security configuration loaded from KV:', validation.errors);
        return null;
      }
      
      return config;
      
    } catch (error) {
      console.error('Failed to load configuration from KV:', error);
      return null;
    }
  }
  
  /**
   * Save configuration to KV store
   */
  private async saveToKV(config: SecurityPolicy): Promise<void> {
    try {
      const configKey = `${SecurityConfigManager.CONFIG_KEY}-${this.environment}`;
      const configData = JSON.stringify(config, null, 2);
      
      await this.kvNamespace.put(configKey, configData);
      
    } catch (error) {
      console.error('Failed to save configuration to KV:', error);
      throw error;
    }
  }
  
  /**
   * Get default security configuration
   */
  private getDefaultConfig(): SecurityPolicy {
    const baseConfig: SecurityPolicy = {
      auth: {
        jwtExpirationSeconds: 3600, // 1 hour
        refreshTokenExpirationSeconds: 86400 * 7, // 7 days
        maxLoginAttempts: 5,
        lockoutDurationMinutes: 15,
        requireMfa: false,
        passwordMinLength: 8,
        passwordRequireSpecialChars: true,
        allowedOrigins: ['http://localhost:5173']
      },
      
      fileUpload: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        maxFilesPerHour: 100,
        maxTotalSizePerHour: 500 * 1024 * 1024, // 500MB
        allowedMimeTypes: [
          'text/csv',
          'application/vnd.ms-excel',
          'text/plain',
          'application/json'
        ],
        allowedExtensions: ['.csv', '.txt', '.json'],
        enableMagicByteValidation: true,
        enableContentScanning: true,
        quarantineHighRiskFiles: true,
        virusScanTimeout: 30000
      },
      
      rateLimit: {
        enabled: true,
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        standardHeaders: true,
        legacyHeaders: false
      },
      
      headers: {
        contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: https://www.google-analytics.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://stats.g.doubleclick.net;",
        strictTransportSecurity: 'max-age=31536000; includeSubDomains',
        xFrameOptions: 'DENY',
        xContentTypeOptions: 'nosniff',
        referrerPolicy: 'strict-origin-when-cross-origin',
        permissionsPolicy: 'geolocation=(), microphone=(), camera=()',
        expectCt: 'max-age=86400, enforce',
        crossOriginResourcePolicy: 'cross-origin',
        crossOriginOpenerPolicy: 'same-origin',
        crossOriginEmbedderPolicy: 'require-corp'
      },
      
      dataProtection: {
        enableEncryptionAtRest: true,
        enableEncryptionInTransit: true,
        piiDetectionEnabled: true,
        dataRetentionDays: 90,
        enableAuditLogging: true,
        enableDataLineageTracking: true
      },
      
      monitoring: {
        enableSecurityMetrics: true,
        enableThreatDetection: true,
        enableAnomalyDetection: true,
        alertThresholds: {
          failedLoginAttempts: 10,
          suspiciousFileUploads: 5,
          rateLimitExceeded: 100,
          securityViolations: 3
        },
        metricsRetentionDays: 30
      },
      
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      environment: this.environment as SecurityPolicy['environment']
    };
    
    // Environment-specific overrides
    if (this.environment === 'development') {
      baseConfig.auth.allowedOrigins = ['http://localhost:5173', 'http://localhost:3000'];
      baseConfig.rateLimit.maxRequests = 1000;
      baseConfig.monitoring.alertThresholds.failedLoginAttempts = 50;
    } else if (this.environment === 'production') {
      baseConfig.auth.requireMfa = true;
      baseConfig.rateLimit.maxRequests = 50;
      baseConfig.fileUpload.maxFilesPerHour = 50;
      baseConfig.monitoring.alertThresholds.failedLoginAttempts = 5;
    }
    
    return baseConfig;
  }
  
  /**
   * Get configuration summary for monitoring
   */
  async getConfigSummary(): Promise<{
    version: string;
    environment: string;
    lastUpdated: string;
    enabledFeatures: string[];
    securityLevel: 'low' | 'medium' | 'high';
  }> {
    const config = await this.getConfig();
    
    const enabledFeatures: string[] = [];
    
    if (config.auth.requireMfa) enabledFeatures.push('MFA');
    if (config.fileUpload.enableContentScanning) enabledFeatures.push('ContentScanning');
    if (config.rateLimit.enabled) enabledFeatures.push('RateLimit');
    if (config.dataProtection.enableEncryptionAtRest) enabledFeatures.push('Encryption');
    if (config.monitoring.enableThreatDetection) enabledFeatures.push('ThreatDetection');
    if (config.monitoring.enableAnomalyDetection) enabledFeatures.push('AnomalyDetection');
    
    // Calculate security level
    let securityLevel: 'low' | 'medium' | 'high' = 'low';
    
    if (config.auth.requireMfa && 
        config.fileUpload.enableContentScanning &&
        config.rateLimit.enabled &&
        config.dataProtection.enableEncryptionAtRest &&
        config.monitoring.enableThreatDetection) {
      securityLevel = 'high';
    } else if (enabledFeatures.length >= 3) {
      securityLevel = 'medium';
    }
    
    return {
      version: config.version,
      environment: config.environment,
      lastUpdated: config.lastUpdated,
      enabledFeatures,
      securityLevel
    };
  }
  
  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<void> {
    if (!this.enableDynamicUpdates) {
      throw new Error('Dynamic configuration updates are disabled');
    }
    
    const defaultConfig = this.getDefaultConfig();
    await this.updateConfig(defaultConfig);
  }
}

/**
 * Configuration factory for creating security config managers
 */
export class SecurityConfigFactory {
  static create(options: SecurityConfigOptions): SecurityConfigManager {
    return new SecurityConfigManager(options);
  }
  
  static createFromEnv(env: {
    SECURITY_CONFIG?: KVNamespace;
    ENVIRONMENT?: string;
  }): SecurityConfigManager {
    if (!env.SECURITY_CONFIG) {
      throw new Error('SECURITY_CONFIG KV namespace not found in environment');
    }
    
    return new SecurityConfigManager({
      kvNamespace: env.SECURITY_CONFIG,
      environment: (env.ENVIRONMENT as SecurityPolicy['environment']) || 'development',
      enableDynamicUpdates: true,
      cacheExpirationMinutes: 5,
      fallbackToDefaults: true
    });
  }
}

/**
 * Utility functions for security configuration
 */
export class SecurityConfigUtils {
  /**
   * Merge configuration objects safely
   */
  static mergeConfigs(base: SecurityPolicy, override: Partial<SecurityPolicy>): SecurityPolicy {
    return {
      ...base,
      ...override,
      auth: { ...base.auth, ...override.auth },
      fileUpload: { ...base.fileUpload, ...override.fileUpload },
      rateLimit: { ...base.rateLimit, ...override.rateLimit },
      headers: { ...base.headers, ...override.headers },
      dataProtection: { ...base.dataProtection, ...override.dataProtection },
      monitoring: { ...base.monitoring, ...override.monitoring },
      version: override.version || base.version,
      lastUpdated: override.lastUpdated || base.lastUpdated,
      environment: override.environment || base.environment
    };
  }
  
  /**
   * Compare two configurations for differences
   */
  static compareConfigs(
    config1: SecurityPolicy, 
    config2: SecurityPolicy
  ): { identical: boolean; differences: string[] } {
    const differences: string[] = [];
    
    // Compare each section
    const sections = ['auth', 'fileUpload', 'rateLimit', 'headers', 'dataProtection', 'monitoring'];
    
    for (const section of sections) {
      const obj1 = (config1 as Record<string, unknown>)[section] as Record<string, unknown>;
      const obj2 = (config2 as Record<string, unknown>)[section] as Record<string, unknown>;
      
      for (const key in obj1) {
        if (JSON.stringify(obj1[key]) !== JSON.stringify(obj2[key])) {
          differences.push(`${section}.${key}`);
        }
      }
    }
    
    return {
      identical: differences.length === 0,
      differences
    };
  }
  
  /**
   * Generate configuration hash for integrity verification
   */
  static generateConfigHash(config: SecurityPolicy): string {
    // Remove dynamic fields from hash calculation
    const hashableConfig = {
      ...config,
      version: undefined,
      lastUpdated: undefined
    };
    
    const configString = JSON.stringify(hashableConfig, Object.keys(hashableConfig).sort());
    return btoa(configString).substring(0, 32);
  }
}