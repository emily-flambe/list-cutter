/**
 * Quality Gates Configuration
 * Defines thresholds and criteria for code quality enforcement
 */

module.exports = {
  // Test Coverage Requirements
  coverage: {
    // Minimum coverage percentages required to pass quality gates
    thresholds: {
      lines: 90,
      functions: 90,
      branches: 85,
      statements: 90,
    },
    // Coverage collection settings
    include: [
      'src/**/*.ts',
      'src/**/*.js',
    ],
    exclude: [
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
      'src/**/*.d.ts',
      'src/types/**',
      'src/**/*.config.*',
      'tests/**',
      'node_modules/**',
      'dist/**',
    ],
    // Fail fast on coverage below threshold
    failOnCoverageBelow: true,
    // Generate coverage reports in multiple formats
    reporters: ['text', 'html', 'lcov', 'json'],
  },

  // Code Quality Metrics
  codeQuality: {
    // ESLint configuration
    linting: {
      // Maximum number of ESLint errors allowed
      maxErrors: 0,
      // Maximum number of ESLint warnings allowed
      maxWarnings: 5,
      // Fail build on linting errors
      failOnError: true,
      // Warn on linting warnings
      warnOnWarning: true,
    },
    
    // TypeScript type checking
    typeChecking: {
      // Fail on TypeScript errors
      failOnError: true,
      // Enable strict type checking
      strict: true,
      // Check unused locals and parameters
      noUnusedLocals: true,
      noUnusedParameters: true,
    },
    
    // Code formatting
    formatting: {
      // Prettier configuration
      prettier: {
        // Fail on formatting violations
        failOnFormatting: true,
        // Auto-fix formatting in development
        autoFix: process.env.NODE_ENV === 'development',
      },
    },
    
    // Code complexity metrics
    complexity: {
      // Maximum cyclomatic complexity per function
      maxComplexity: 10,
      // Maximum file size in lines
      maxFileSize: 500,
      // Maximum function length in lines
      maxFunctionSize: 50,
      // Fail on complexity violations
      failOnComplexity: true,
    },
  },

  // Performance Requirements
  performance: {
    // Bundle size limits
    bundleSize: {
      // Maximum bundle size in bytes
      maxSize: 1024 * 1024, // 1MB
      // Warning threshold as percentage of max size
      warningThreshold: 0.8, // 80%
      // Fail build if bundle size exceeds limit
      failOnSizeExceed: true,
    },
    
    // Runtime performance thresholds
    runtime: {
      // Maximum response time for API endpoints (ms)
      maxResponseTime: 500,
      // Maximum memory usage per request (MB)
      maxMemoryUsage: 100,
      // Maximum CPU time per request (ms)
      maxCpuTime: 250,
      // Core Web Vitals thresholds
      webVitals: {
        lcp: 2500, // Largest Contentful Paint (ms)
        fid: 100,  // First Input Delay (ms)
        cls: 0.1,  // Cumulative Layout Shift
        fcp: 1800, // First Contentful Paint (ms)
        ttfb: 600, // Time to First Byte (ms)
      },
    },
    
    // Load testing thresholds
    loadTesting: {
      // Minimum requests per second
      minRps: 100,
      // Maximum error rate percentage
      maxErrorRate: 1,
      // Maximum 95th percentile response time (ms)
      maxP95ResponseTime: 1000,
    },
  },

  // Security Requirements
  security: {
    // Vulnerability scanning
    vulnerabilities: {
      // Maximum number of high severity vulnerabilities
      maxHigh: 0,
      // Maximum number of medium severity vulnerabilities
      maxMedium: 0,
      // Maximum number of low severity vulnerabilities
      maxLow: 5,
      // Fail build on vulnerabilities above threshold
      failOnVulnerabilities: true,
    },
    
    // Dependency scanning
    dependencies: {
      // Allowed license types
      allowedLicenses: [
        'MIT',
        'Apache-2.0',
        'BSD-2-Clause',
        'BSD-3-Clause',
        'ISC',
        'CC0-1.0',
      ],
      // Disallowed license types
      disallowedLicenses: [
        'GPL-2.0',
        'GPL-3.0',
        'AGPL-1.0',
        'AGPL-3.0',
        'LGPL-2.0',
        'LGPL-2.1',
        'LGPL-3.0',
      ],
      // Fail on disallowed licenses
      failOnLicense: true,
    },
    
    // Code security scanning
    codeScanning: {
      // OWASP security categories to check
      owaspCategories: [
        'A01:2021 – Broken Access Control',
        'A02:2021 – Cryptographic Failures',
        'A03:2021 – Injection',
        'A04:2021 – Insecure Design',
        'A05:2021 – Security Misconfiguration',
        'A06:2021 – Vulnerable and Outdated Components',
        'A07:2021 – Identification and Authentication Failures',
        'A08:2021 – Software and Data Integrity Failures',
        'A09:2021 – Security Logging and Monitoring Failures',
        'A10:2021 – Server-Side Request Forgery',
      ],
      // Custom security rules
      customRules: [
        'no-eval',
        'no-new-func',
        'no-script-url',
        'no-unsafe-inline',
      ],
    },
  },

  // Test Quality Requirements
  testQuality: {
    // Test execution requirements
    execution: {
      // Minimum test pass rate percentage
      minPassRate: 100,
      // Maximum test execution time (seconds)
      maxExecutionTime: 300,
      // Fail on test failures
      failOnTestFailure: true,
      // Retry flaky tests
      retryCount: 2,
    },
    
    // Test coverage by type
    coverageByType: {
      unit: {
        minCoverage: 95,
        required: true,
      },
      integration: {
        minCoverage: 85,
        required: true,
      },
      e2e: {
        minCoverage: 70,
        required: true,
      },
      security: {
        minCoverage: 90,
        required: true,
      },
    },
    
    // Test maintenance requirements
    maintenance: {
      // Maximum test execution time per test (ms)
      maxTestTime: 30000,
      // Maximum number of skipped tests allowed
      maxSkippedTests: 0,
      // Require test descriptions
      requireDescriptions: true,
      // Require assertions in tests
      requireAssertions: true,
    },
  },

  // Documentation Requirements
  documentation: {
    // API documentation
    api: {
      // Require JSDoc comments for all public functions
      requireJsDoc: true,
      // Minimum documentation coverage percentage
      minCoverage: 80,
      // OpenAPI specification validation
      openApiValidation: true,
    },
    
    // Code documentation
    code: {
      // Require comments for complex functions
      requireComplexComments: true,
      // Complexity threshold for requiring comments
      complexityThreshold: 5,
      // Require README files in major directories
      requireReadme: true,
    },
  },

  // Deployment Quality Gates
  deployment: {
    // Pre-deployment checks
    preDeployment: {
      // Build success required
      buildSuccess: true,
      // All tests must pass
      allTestsPass: true,
      // Security scan must pass
      securityScanPass: true,
      // Performance benchmarks must pass
      performancePass: true,
    },
    
    // Post-deployment validation
    postDeployment: {
      // Health check timeout (ms)
      healthCheckTimeout: 30000,
      // Number of health check retries
      healthCheckRetries: 3,
      // Smoke test execution required
      smokeTestRequired: true,
      // Rollback on health check failure
      rollbackOnFailure: true,
    },
    
    // Environment-specific requirements
    environments: {
      development: {
        // Relaxed requirements for development
        enforceQualityGates: false,
        allowSkippedTests: true,
        minCoverage: 70,
      },
      staging: {
        // Standard requirements for staging
        enforceQualityGates: true,
        allowSkippedTests: false,
        minCoverage: 85,
      },
      production: {
        // Strict requirements for production
        enforceQualityGates: true,
        allowSkippedTests: false,
        minCoverage: 90,
        requireApproval: true,
        requireSignoff: true,
      },
    },
  },

  // Reporting and Notifications
  reporting: {
    // Quality metrics dashboard
    dashboard: {
      // Enable real-time metrics dashboard
      enabled: true,
      // Dashboard refresh interval (seconds)
      refreshInterval: 60,
      // Metrics to display
      metrics: [
        'test-coverage',
        'build-status',
        'security-score',
        'performance-score',
        'code-quality-score',
      ],
    },
    
    // Notification settings
    notifications: {
      // Slack notifications
      slack: {
        enabled: process.env.SLACK_WEBHOOK_URL ? true : false,
        webhook: process.env.SLACK_WEBHOOK_URL,
        channels: {
          success: '#deployments',
          failure: '#alerts',
          security: '#security-alerts',
        },
      },
      
      // Email notifications
      email: {
        enabled: false,
        recipients: [
          'dev-team@company.com',
          'security-team@company.com',
        ],
        events: ['failure', 'security-alert'],
      },
    },
    
    // Report generation
    reports: {
      // Generate HTML reports
      html: true,
      // Generate JSON reports for API consumption
      json: true,
      // Generate XML reports for CI/CD integration
      xml: true,
      // Report retention period (days)
      retentionDays: 30,
    },
  },

  // Custom Quality Gates
  customGates: {
    // Business logic specific validations
    businessLogic: {
      // Validate CSV processing functions
      csvProcessingValidation: {
        enabled: true,
        maxProcessingTime: 5000, // ms
        maxMemoryUsage: 50, // MB
        supportedFormats: ['csv', 'tsv'],
      },
      
      // Validate file upload security
      fileUploadSecurity: {
        enabled: true,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['text/csv', 'text/tab-separated-values'],
        virusScanRequired: true,
      },
    },
    
    // Infrastructure validations
    infrastructure: {
      // Cloudflare Workers specific checks
      workersValidation: {
        enabled: true,
        maxBundleSize: 1024 * 1024, // 1MB
        maxExecutionTime: 30000, // 30s
        memoryLimit: 128, // MB
      },
      
      // Database performance checks
      databasePerformance: {
        enabled: true,
        maxQueryTime: 1000, // ms
        maxConcurrentConnections: 100,
        queryOptimizationRequired: true,
      },
    },
  },
};