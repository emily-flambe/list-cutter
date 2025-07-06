#!/usr/bin/env node

/**
 * Quality Gates Enforcement Script
 * Validates all quality requirements before allowing deployments
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load quality gates configuration
const config = require('../quality-gates.config.js');

class QualityGatesChecker {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      errors: [],
      warnings: [],
    };
    
    this.isCI = process.env.CI === 'true';
    this.environment = process.env.NODE_ENV || 'development';
    this.verbose = process.argv.includes('--verbose');
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async runCommand(command, description) {
    this.log(`Running: ${description}`, 'info');
    try {
      const output = execSync(command, { 
        encoding: 'utf8', 
        stdio: this.verbose ? 'inherit' : 'pipe',
        cwd: process.cwd()
      });
      return { success: true, output: output.trim() };
    } catch (error) {
      return { 
        success: false, 
        output: error.stdout || error.message,
        error: error.stderr || error.message
      };
    }
  }

  async checkLinting() {
    this.log('Checking code linting...', 'info');
    
    const result = await this.runCommand('npm run lint', 'ESLint check');
    
    if (!result.success) {
      this.results.failed++;
      this.results.errors.push('Linting check failed');
      this.log('Linting check failed', 'error');
      return false;
    }
    
    this.results.passed++;
    this.log('Linting check passed', 'success');
    return true;
  }

  async checkTypeScript() {
    this.log('Checking TypeScript compilation...', 'info');
    
    const result = await this.runCommand('npm run type-check', 'TypeScript check');
    
    if (!result.success) {
      this.results.failed++;
      this.results.errors.push('TypeScript check failed');
      this.log('TypeScript check failed', 'error');
      return false;
    }
    
    this.results.passed++;
    this.log('TypeScript check passed', 'success');
    return true;
  }

  async checkFormating() {
    this.log('Checking code formatting...', 'info');
    
    const result = await this.runCommand('npx prettier --check "src/**/*.{ts,js,json}" "tests/**/*.{ts,js,json}"', 'Prettier check');
    
    if (!result.success) {
      this.results.failed++;
      this.results.errors.push('Code formatting check failed');
      this.log('Code formatting check failed', 'error');
      return false;
    }
    
    this.results.passed++;
    this.log('Code formatting check passed', 'success');
    return true;
  }

  async checkTestCoverage() {
    this.log('Checking test coverage...', 'info');
    
    const result = await this.runCommand('npm run test:coverage', 'Test coverage');
    
    if (!result.success) {
      this.results.failed++;
      this.results.errors.push('Test coverage check failed');
      this.log('Test coverage check failed', 'error');
      return false;
    }

    // Parse coverage results
    try {
      const coverageFile = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
      if (fs.existsSync(coverageFile)) {
        const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
        const total = coverage.total;
        
        const checks = [
          { name: 'lines', value: total.lines.pct, threshold: config.coverage.thresholds.lines },
          { name: 'functions', value: total.functions.pct, threshold: config.coverage.thresholds.functions },
          { name: 'branches', value: total.branches.pct, threshold: config.coverage.thresholds.branches },
          { name: 'statements', value: total.statements.pct, threshold: config.coverage.thresholds.statements },
        ];
        
        let coveragePassed = true;
        for (const check of checks) {
          if (check.value < check.threshold) {
            this.results.errors.push(`${check.name} coverage ${check.value}% is below threshold ${check.threshold}%`);
            coveragePassed = false;
          }
        }
        
        if (!coveragePassed) {
          this.results.failed++;
          this.log('Coverage thresholds not met', 'error');
          return false;
        }
      }
    } catch (error) {
      this.log(`Failed to parse coverage results: ${error.message}`, 'warning');
      this.results.warnings++;
    }
    
    this.results.passed++;
    this.log('Test coverage check passed', 'success');
    return true;
  }

  async checkUnitTests() {
    this.log('Running unit tests...', 'info');
    
    const result = await this.runCommand('npm run test:unit', 'Unit tests');
    
    if (!result.success) {
      this.results.failed++;
      this.results.errors.push('Unit tests failed');
      this.log('Unit tests failed', 'error');
      return false;
    }
    
    this.results.passed++;
    this.log('Unit tests passed', 'success');
    return true;
  }

  async checkIntegrationTests() {
    this.log('Running integration tests...', 'info');
    
    const result = await this.runCommand('npm run test:integration', 'Integration tests');
    
    if (!result.success) {
      this.results.failed++;
      this.results.errors.push('Integration tests failed');
      this.log('Integration tests failed', 'error');
      return false;
    }
    
    this.results.passed++;
    this.log('Integration tests passed', 'success');
    return true;
  }

  async checkSecurityTests() {
    this.log('Running security tests...', 'info');
    
    const result = await this.runCommand('npm run test:security', 'Security tests');
    
    if (!result.success) {
      this.results.failed++;
      this.results.errors.push('Security tests failed');
      this.log('Security tests failed', 'error');
      return false;
    }
    
    this.results.passed++;
    this.log('Security tests passed', 'success');
    return true;
  }

  async checkSecurityVulnerabilities() {
    this.log('Checking for security vulnerabilities...', 'info');
    
    const auditResult = await this.runCommand('npm audit --audit-level moderate', 'NPM audit');
    
    if (!auditResult.success) {
      this.results.failed++;
      this.results.errors.push('Security vulnerabilities found');
      this.log('Security vulnerabilities found', 'error');
      return false;
    }
    
    this.results.passed++;
    this.log('No security vulnerabilities found', 'success');
    return true;
  }

  async checkBundleSize() {
    this.log('Checking bundle size...', 'info');
    
    const buildResult = await this.runCommand('npm run build', 'Build check');
    
    if (!buildResult.success) {
      this.results.failed++;
      this.results.errors.push('Build failed');
      this.log('Build failed', 'error');
      return false;
    }

    // Check bundle size
    const distPath = path.join(process.cwd(), 'dist', 'index.js');
    if (fs.existsSync(distPath)) {
      const stats = fs.statSync(distPath);
      const sizeInBytes = stats.size;
      const maxSize = config.performance.bundleSize.maxSize;
      
      if (sizeInBytes > maxSize) {
        this.results.failed++;
        this.results.errors.push(`Bundle size ${sizeInBytes} bytes exceeds limit ${maxSize} bytes`);
        this.log(`Bundle size exceeds limit: ${sizeInBytes} > ${maxSize} bytes`, 'error');
        return false;
      }
      
      const warningThreshold = maxSize * config.performance.bundleSize.warningThreshold;
      if (sizeInBytes > warningThreshold) {
        this.results.warnings++;
        this.log(`Bundle size approaching limit: ${sizeInBytes} bytes (${Math.round(sizeInBytes/maxSize*100)}% of limit)`, 'warning');
      }
      
      this.log(`Bundle size OK: ${sizeInBytes} bytes`, 'success');
    }
    
    this.results.passed++;
    this.log('Bundle size check passed', 'success');
    return true;
  }

  async checkLicenseCompliance() {
    this.log('Checking license compliance...', 'info');
    
    const allowedLicenses = config.security.dependencies.allowedLicenses.join(';');
    const result = await this.runCommand(
      `npx license-checker --onlyAllow '${allowedLicenses}'`,
      'License compliance check'
    );
    
    if (!result.success) {
      this.results.failed++;
      this.results.errors.push('License compliance check failed');
      this.log('License compliance check failed', 'error');
      return false;
    }
    
    this.results.passed++;
    this.log('License compliance check passed', 'success');
    return true;
  }

  async checkPerformanceBenchmarks() {
    if (this.environment === 'development') {
      this.log('Skipping performance benchmarks in development', 'info');
      return true;
    }

    this.log('Running performance benchmarks...', 'info');
    
    const result = await this.runCommand('npm run test:performance', 'Performance tests');
    
    if (!result.success) {
      this.results.failed++;
      this.results.errors.push('Performance benchmarks failed');
      this.log('Performance benchmarks failed', 'error');
      return false;
    }
    
    this.results.passed++;
    this.log('Performance benchmarks passed', 'success');
    return true;
  }

  async checkE2ETests() {
    if (this.environment === 'development') {
      this.log('Skipping E2E tests in development', 'info');
      return true;
    }

    this.log('Running E2E tests...', 'info');
    
    const result = await this.runCommand('npm run test:e2e', 'E2E tests');
    
    if (!result.success) {
      this.results.failed++;
      this.results.errors.push('E2E tests failed');
      this.log('E2E tests failed', 'error');
      return false;
    }
    
    this.results.passed++;
    this.log('E2E tests passed', 'success');
    return true;
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      environment: this.environment,
      summary: {
        passed: this.results.passed,
        failed: this.results.failed,
        warnings: this.results.warnings,
        total: this.results.passed + this.results.failed,
        success: this.results.failed === 0,
      },
      errors: this.results.errors,
      warnings: this.results.warnings,
    };

    // Write report to file
    const reportPath = path.join(process.cwd(), 'quality-gates-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    this.log(`Quality gates report written to ${reportPath}`, 'info');
    return report;
  }

  async run() {
    this.log('Starting quality gates validation...', 'info');
    this.log(`Environment: ${this.environment}`, 'info');
    this.log(`CI Mode: ${this.isCI}`, 'info');

    const checks = [
      { name: 'Linting', fn: () => this.checkLinting() },
      { name: 'TypeScript', fn: () => this.checkTypeScript() },
      { name: 'Formatting', fn: () => this.checkFormating() },
      { name: 'Unit Tests', fn: () => this.checkUnitTests() },
      { name: 'Integration Tests', fn: () => this.checkIntegrationTests() },
      { name: 'Security Tests', fn: () => this.checkSecurityTests() },
      { name: 'Test Coverage', fn: () => this.checkTestCoverage() },
      { name: 'Security Vulnerabilities', fn: () => this.checkSecurityVulnerabilities() },
      { name: 'Bundle Size', fn: () => this.checkBundleSize() },
      { name: 'License Compliance', fn: () => this.checkLicenseCompliance() },
      { name: 'Performance Benchmarks', fn: () => this.checkPerformanceBenchmarks() },
      { name: 'E2E Tests', fn: () => this.checkE2ETests() },
    ];

    this.log(`Running ${checks.length} quality gate checks...`, 'info');

    for (const check of checks) {
      try {
        await check.fn();
      } catch (error) {
        this.results.failed++;
        this.results.errors.push(`${check.name}: ${error.message}`);
        this.log(`${check.name} check failed: ${error.message}`, 'error');
      }
    }

    const report = await this.generateReport();
    
    this.log('\n=================== QUALITY GATES SUMMARY ===================', 'info');
    this.log(`Total Checks: ${report.summary.total}`, 'info');
    this.log(`Passed: ${report.summary.passed}`, 'success');
    this.log(`Failed: ${report.summary.failed}`, report.summary.failed > 0 ? 'error' : 'info');
    this.log(`Warnings: ${report.summary.warnings}`, report.summary.warnings > 0 ? 'warning' : 'info');

    if (report.summary.errors && report.summary.errors.length > 0) {
      this.log('\nERRORS:', 'error');
      report.summary.errors.forEach(error => this.log(`  • ${error}`, 'error'));
    }

    if (report.summary.warnings && report.summary.warnings.length > 0) {
      this.log('\nWARNINGS:', 'warning');
      report.summary.warnings.forEach(warning => this.log(`  • ${warning}`, 'warning'));
    }

    this.log('===========================================================\n', 'info');

    if (report.summary.success) {
      this.log('🎉 All quality gates passed!', 'success');
      process.exit(0);
    } else {
      this.log('💥 Quality gates failed!', 'error');
      process.exit(1);
    }
  }
}

// Run quality gates if this script is executed directly
if (require.main === module) {
  const checker = new QualityGatesChecker();
  checker.run().catch(error => {
    console.error('Fatal error running quality gates:', error);
    process.exit(1);
  });
}

module.exports = QualityGatesChecker;