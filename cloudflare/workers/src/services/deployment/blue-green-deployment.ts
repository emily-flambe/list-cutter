import type { CloudflareEnv } from '../../types/env.js';
import type {
  DeploymentEnvironment,
  DeploymentStatus,
  DeploymentResult,
  CutoverResult,
  MonitoringResult,
  ValidationResult,
  BlueGreenState,
  DeploymentConfiguration,
  DeploymentRequest,
  CutoverRequest,
  RollbackRequest,
  ValidationContext,
  DeploymentHealthCheck,
  SmokeTest,
  PerformanceThresholds,
  DNSUpdateResult,
  MaintenanceMode,
  MigrationResult
} from '../../types/deployment.js';
import { MetricsService } from '../monitoring/metrics-service.js';

/**
 * Blue-Green Deployment Service for zero-downtime deployments
 * Manages the blue-green deployment architecture for Cloudflare Workers
 */
export class BlueGreenDeployment {
  private env: CloudflareEnv;
  private metricsService?: MetricsService;
  private config: DeploymentConfiguration;

  constructor(env: CloudflareEnv, config?: Partial<DeploymentConfiguration>) {
    this.env = env;
    
    if (env.ANALYTICS && env.DB) {
      this.metricsService = new MetricsService(env.ANALYTICS, env.DB);
    }

    this.config = this.mergeConfig(config);
  }

  /**
   * Deploy to the inactive environment
   */
  async deployToInactive(request: DeploymentRequest): Promise<DeploymentResult> {
    const startTime = new Date().toISOString();
    const result: DeploymentResult = {
      success: false,
      version: request.version,
      environment: 'blue',
      startTime,
      endTime: '',
      duration: 0,
      errors: [],
      warnings: []
    };

    try {
      // Get current state
      const currentState = await this.getCurrentState();
      const inactiveEnvironment = currentState.currentInactive;
      result.environment = inactiveEnvironment;

      console.log(`🚀 Starting deployment of version ${request.version} to ${inactiveEnvironment} environment`);

      // Check if deployment is already in progress
      if (currentState.isDeploymentInProgress) {
        throw new Error('Another deployment is already in progress');
      }

      // Mark deployment as in progress
      await this.updateDeploymentState({
        ...currentState,
        isDeploymentInProgress: true
      });

      // Deploy the new version (this would integrate with Wrangler CLI)
      const deploymentSuccess = await this.performDeployment(inactiveEnvironment, request);
      
      if (!deploymentSuccess) {
        throw new Error('Deployment failed');
      }

      // Validate deployment if enabled
      if (this.config.enableValidation && !request.skipValidation) {
        console.log('🔍 Validating deployment...');
        const validationResults = await this.validateDeployment(inactiveEnvironment, request.version);
        
        if (!validationResults.every(v => v.success)) {
          result.warnings = validationResults
            .filter(v => !v.success)
            .map(v => `Validation failed: ${v.name} - ${v.error}`);
          
          console.warn('⚠️ Some validations failed, but deployment continues');
        }
      }

      // Update deployment version record
      await this.recordDeploymentVersion({
        id: `${inactiveEnvironment}-${request.version}-${Date.now()}`,
        version: request.version,
        environment: inactiveEnvironment,
        status: 'deployed',
        deploymentType: request.deploymentType,
        commitHash: request.commitHash,
        deployedAt: new Date().toISOString(),
        metadata: request.metadata
      });

      result.success = true;
      console.log(`✅ Deployment of version ${request.version} to ${inactiveEnvironment} completed successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown deployment error';
      result.errors = [errorMessage];
      console.error(`❌ Deployment failed: ${errorMessage}`);
    } finally {
      const endTime = new Date().toISOString();
      result.endTime = endTime;
      result.duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      // Clear deployment in progress flag
      const currentState = await this.getCurrentState();
      await this.updateDeploymentState({
        ...currentState,
        isDeploymentInProgress: false
      });

      // Record metrics
      await this.recordDeploymentMetrics('deployment', result.success, result.duration);
    }

    return result;
  }

  /**
   * Cut over to the new version (switch active environment)
   */
  async cutoverToNewVersion(request: CutoverRequest): Promise<CutoverResult> {
    const cutoverTime = new Date().toISOString();
    const result: CutoverResult = {
      success: false,
      fromEnvironment: 'blue',
      toEnvironment: 'green',
      cutoverTime,
      validationResults: []
    };

    try {
      const currentState = await this.getCurrentState();
      
      if (currentState.isCutoverInProgress) {
        throw new Error('Another cutover is already in progress');
      }

      const fromEnvironment = currentState.currentActive;
      const toEnvironment = currentState.currentInactive;
      
      result.fromEnvironment = fromEnvironment;
      result.toEnvironment = toEnvironment;

      console.log(`🔄 Starting cutover from ${fromEnvironment} to ${toEnvironment}`);

      // Mark cutover as in progress
      await this.updateDeploymentState({
        ...currentState,
        isCutoverInProgress: true
      });

      // Pre-cutover validation
      if (this.config.enableValidation && !request.skipValidation) {
        console.log('🔍 Running pre-cutover validation...');
        const validationResults = await this.validateDeployment(toEnvironment, request.targetVersion);
        result.validationResults = validationResults;

        if (!validationResults.every(v => v.success)) {
          throw new Error(`Pre-cutover validation failed: ${validationResults.filter(v => !v.success).map(v => v.name).join(', ')}`);
        }
      }

      // Update DNS records to point to new environment
      const dnsResult = await this.updateDNSRecords(toEnvironment);
      if (!dnsResult.success) {
        throw new Error(`DNS update failed: ${dnsResult.errors?.join(', ')}`);
      }

      // Monitor the cutover
      const monitoringDuration = request.monitoringDuration || this.config.monitoringDuration;
      const monitoringResult = await this.monitorCutover(toEnvironment, monitoringDuration);
      
      if (!monitoringResult.healthy) {
        result.rollbackTrigger = 'Monitoring detected issues during cutover';
        console.error('🚨 Cutover monitoring detected issues, initiating rollback');
        
        // Automatic rollback
        await this.rollback({ 
          reason: result.rollbackTrigger, 
          emergencyRollback: true 
        });
        
        throw new Error(result.rollbackTrigger);
      }

      // Update state to reflect new active environment
      await this.updateDeploymentState({
        currentActive: toEnvironment,
        currentInactive: fromEnvironment,
        lastCutover: cutoverTime,
        deploymentHistory: currentState.deploymentHistory,
        isDeploymentInProgress: false,
        isCutoverInProgress: false
      });

      result.success = true;
      console.log(`✅ Cutover from ${fromEnvironment} to ${toEnvironment} completed successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown cutover error';
      console.error(`❌ Cutover failed: ${errorMessage}`);
      
      // Clear cutover in progress flag
      const currentState = await this.getCurrentState();
      await this.updateDeploymentState({
        ...currentState,
        isCutoverInProgress: false
      });
    }

    // Record metrics
    await this.recordDeploymentMetrics('cutover', result.success, 
      new Date().getTime() - new Date(cutoverTime).getTime());

    return result;
  }

  /**
   * Rollback to previous version
   */
  async rollback(request: RollbackRequest): Promise<DeploymentResult> {
    const startTime = new Date().toISOString();
    const result: DeploymentResult = {
      success: false,
      version: 'rollback',
      environment: 'blue',
      startTime,
      endTime: '',
      duration: 0,
      errors: [],
      rollbackPerformed: true
    };

    try {
      console.log(`🔄 Starting rollback: ${request.reason}`);

      const currentState = await this.getCurrentState();
      const currentActive = currentState.currentActive;
      const targetEnvironment = currentActive === 'blue' ? 'green' : 'blue';

      result.environment = targetEnvironment;

      // Update DNS to point back to previous environment
      const dnsResult = await this.updateDNSRecords(targetEnvironment);
      if (!dnsResult.success) {
        throw new Error(`DNS rollback failed: ${dnsResult.errors?.join(', ')}`);
      }

      // Update state
      await this.updateDeploymentState({
        currentActive: targetEnvironment,
        currentInactive: currentActive,
        lastCutover: new Date().toISOString(),
        deploymentHistory: currentState.deploymentHistory,
        isDeploymentInProgress: false,
        isCutoverInProgress: false
      });

      // Validate rollback
      const validationResults = await this.validateDeployment(targetEnvironment, 'current');
      if (!validationResults.every(v => v.success)) {
        result.warnings = validationResults
          .filter(v => !v.success)
          .map(v => `Rollback validation warning: ${v.name} - ${v.error}`);
      }

      result.success = true;
      console.log(`✅ Rollback to ${targetEnvironment} completed successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown rollback error';
      result.errors = [errorMessage];
      console.error(`❌ Rollback failed: ${errorMessage}`);
    } finally {
      const endTime = new Date().toISOString();
      result.endTime = endTime;
      result.duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      // Record metrics
      await this.recordDeploymentMetrics('rollback', result.success, result.duration);
    }

    return result;
  }

  /**
   * Get current deployment state
   */
  async getCurrentState(): Promise<BlueGreenState> {
    try {
      if (!this.env.DEPLOYMENT_KV) {
        // Return default state if KV not available
        return this.getDefaultState();
      }

      const stateJson = await this.env.DEPLOYMENT_KV.get('blue_green_state');
      if (!stateJson) {
        return this.getDefaultState();
      }

      return JSON.parse(stateJson) as BlueGreenState;
    } catch (error) {
      console.error('Failed to get deployment state:', error);
      return this.getDefaultState();
    }
  }

  /**
   * Get current version
   */
  async getCurrentVersion(): Promise<DeploymentEnvironment> {
    const state = await this.getCurrentState();
    return state.currentActive;
  }

  /**
   * Validate deployment environment
   */
  async validateDeployment(environment: DeploymentEnvironment, version: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const context: ValidationContext = {
      environment,
      version,
      baseUrl: this.getEnvironmentUrl(environment),
      userAgent: 'BlueGreenDeployment/1.0',
      timeout: 30000,
      retries: 3
    };

    // Run health checks
    for (const healthCheck of this.config.customHealthChecks) {
      const result = await this.runHealthCheck(healthCheck, context);
      results.push(result);
    }

    // Run smoke tests
    for (const smokeTest of this.config.customSmokeTests) {
      const result = await this.runSmokeTest(smokeTest, context);
      results.push(result);
    }

    return results;
  }

  /**
   * Monitor cutover for specified duration
   */
  async monitorCutover(environment: DeploymentEnvironment, duration: number): Promise<MonitoringResult> {
    const startTime = new Date().toISOString();
    const endTime = new Date(Date.now() + duration).toISOString();
    
    const result: MonitoringResult = {
      healthy: true,
      errorRate: 0,
      avgResponseTime: 0,
      successfulChecks: 0,
      totalChecks: 0,
      startTime,
      endTime,
      issues: []
    };

    const checkInterval = 10000; // 10 seconds
    const checks = Math.floor(duration / checkInterval);
    
    for (let i = 0; i < checks; i++) {
      try {
        const checkResult = await this.performHealthCheck(environment);
        result.totalChecks++;
        
        if (checkResult.success) {
          result.successfulChecks++;
        } else {
          result.issues?.push({
            type: 'availability',
            severity: 'high',
            message: checkResult.error || 'Health check failed',
            value: 0,
            threshold: 1,
            timestamp: new Date().toISOString()
          });
        }

        // Check error rate threshold
        const currentErrorRate = ((result.totalChecks - result.successfulChecks) / result.totalChecks) * 100;
        if (currentErrorRate > this.config.rollbackThresholds.maxErrorRate) {
          result.healthy = false;
          result.issues?.push({
            type: 'error_rate',
            severity: 'critical',
            message: `Error rate ${currentErrorRate}% exceeds threshold ${this.config.rollbackThresholds.maxErrorRate}%`,
            value: currentErrorRate,
            threshold: this.config.rollbackThresholds.maxErrorRate,
            timestamp: new Date().toISOString()
          });
          break;
        }

        await new Promise(resolve => setTimeout(resolve, checkInterval));
      } catch (error) {
        console.error('Monitoring check failed:', error);
        result.totalChecks++;
      }
    }

    result.errorRate = result.totalChecks > 0 ? 
      ((result.totalChecks - result.successfulChecks) / result.totalChecks) * 100 : 0;

    return result;
  }

  /**
   * Perform actual deployment (integrates with Wrangler)
   */
  private async performDeployment(environment: DeploymentEnvironment, request: DeploymentRequest): Promise<boolean> {
    try {
      // In a real implementation, this would call Wrangler CLI or Cloudflare API
      // For now, we'll simulate the deployment
      console.log(`Deploying version ${request.version} to ${environment}...`);
      
      // Simulate deployment time
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      return true;
    } catch (error) {
      console.error('Deployment execution failed:', error);
      return false;
    }
  }

  /**
   * Update DNS records to point to target environment
   */
  private async updateDNSRecords(environment: DeploymentEnvironment): Promise<DNSUpdateResult> {
    try {
      // In a real implementation, this would update Cloudflare DNS records
      console.log(`Updating DNS records to point to ${environment} environment`);
      
      // Simulate DNS update
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return {
        success: true,
        recordsUpdated: [{
          name: this.config.dnsConfig.domain,
          type: this.config.dnsConfig.recordType,
          value: this.getEnvironmentUrl(environment),
          ttl: this.config.dnsConfig.ttl,
          updatedAt: new Date().toISOString()
        }]
      };
    } catch (error) {
      return {
        success: false,
        recordsUpdated: [],
        errors: [error instanceof Error ? error.message : 'DNS update failed']
      };
    }
  }

  /**
   * Run health check
   */
  private async runHealthCheck(healthCheck: DeploymentHealthCheck, context: ValidationContext): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      const url = `${context.baseUrl}${healthCheck.endpoint}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': context.userAgent }
      });

      const success = response.status === healthCheck.expectedStatus;
      
      return {
        name: `Health Check: ${healthCheck.endpoint}`,
        type: 'health_check',
        success,
        duration: Date.now() - startTime,
        details: {
          url,
          expectedStatus: healthCheck.expectedStatus,
          actualStatus: response.status
        },
        error: success ? undefined : `Expected status ${healthCheck.expectedStatus}, got ${response.status}`
      };
    } catch (error) {
      return {
        name: `Health Check: ${healthCheck.endpoint}`,
        type: 'health_check',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Run smoke test
   */
  private async runSmokeTest(smokeTest: SmokeTest, context: ValidationContext): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      const url = `${context.baseUrl}${smokeTest.endpoint}`;
      const response = await fetch(url, {
        method: smokeTest.method,
        headers: {
          'User-Agent': context.userAgent,
          'Content-Type': 'application/json',
          ...smokeTest.headers
        },
        body: smokeTest.body ? JSON.stringify(smokeTest.body) : undefined
      });

      const success = smokeTest.validator ? 
        smokeTest.validator(response) : 
        response.status === smokeTest.expectedStatus;
      
      return {
        name: `Smoke Test: ${smokeTest.name}`,
        type: 'smoke_test',
        success,
        duration: Date.now() - startTime,
        details: {
          url,
          method: smokeTest.method,
          expectedStatus: smokeTest.expectedStatus,
          actualStatus: response.status
        },
        error: success ? undefined : `Test failed: ${smokeTest.description}`
      };
    } catch (error) {
      return {
        name: `Smoke Test: ${smokeTest.name}`,
        type: 'smoke_test',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Perform basic health check
   */
  private async performHealthCheck(environment: DeploymentEnvironment): Promise<{ success: boolean; error?: string }> {
    try {
      const url = `${this.getEnvironmentUrl(environment)}/health`;
      const response = await fetch(url, { method: 'GET' });
      
      return {
        success: response.ok,
        error: response.ok ? undefined : `Health check failed with status ${response.status}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Health check request failed'
      };
    }
  }

  /**
   * Update deployment state in KV
   */
  private async updateDeploymentState(state: BlueGreenState): Promise<void> {
    try {
      if (this.env.DEPLOYMENT_KV) {
        await this.env.DEPLOYMENT_KV.put('blue_green_state', JSON.stringify(state));
      }
    } catch (error) {
      console.error('Failed to update deployment state:', error);
    }
  }

  /**
   * Record deployment version
   */
  private async recordDeploymentVersion(version: any): Promise<void> {
    try {
      const currentState = await this.getCurrentState();
      const updatedHistory = [...currentState.deploymentHistory, version];
      
      // Keep only last 50 deployments
      if (updatedHistory.length > 50) {
        updatedHistory.splice(0, updatedHistory.length - 50);
      }

      await this.updateDeploymentState({
        ...currentState,
        deploymentHistory: updatedHistory
      });
    } catch (error) {
      console.error('Failed to record deployment version:', error);
    }
  }

  /**
   * Record deployment metrics
   */
  private async recordDeploymentMetrics(operation: string, success: boolean, duration: number): Promise<void> {
    try {
      if (this.metricsService && this.env.ANALYTICS) {
        await this.env.ANALYTICS.writeDataPoint({
          blobs: [
            'deployment_operation',
            operation,
            success ? 'success' : 'failure',
            this.env.ENVIRONMENT || 'unknown'
          ],
          doubles: [duration, Date.now()],
          indexes: [operation, success ? 'success' : 'failure']
        });
      }
    } catch (error) {
      console.error('Failed to record deployment metrics:', error);
    }
  }

  /**
   * Get environment URL
   */
  private getEnvironmentUrl(environment: DeploymentEnvironment): string {
    // In a real implementation, these would be actual environment URLs
    const baseUrl = this.env.CORS_ORIGIN || 'https://api.list-cutter.com';
    return environment === 'blue' ? 
      baseUrl.replace('api.', 'blue.') : 
      baseUrl.replace('api.', 'green.');
  }

  /**
   * Get default deployment state
   */
  private getDefaultState(): BlueGreenState {
    return {
      currentActive: 'blue',
      currentInactive: 'green',
      lastCutover: new Date().toISOString(),
      deploymentHistory: [],
      isDeploymentInProgress: false,
      isCutoverInProgress: false
    };
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(config: Partial<DeploymentConfiguration> = {}): DeploymentConfiguration {
    return {
      enableValidation: config.enableValidation ?? true,
      validationTimeout: config.validationTimeout ?? 300000, // 5 minutes
      monitoringDuration: config.monitoringDuration ?? 300000, // 5 minutes
      enableAutoRollback: config.enableAutoRollback ?? true,
      rollbackThresholds: {
        maxErrorRate: 5,
        maxResponseTime: 5000,
        minSuccessRate: 95,
        ...config.rollbackThresholds
      },
      dnsConfig: {
        domain: 'api.list-cutter.com',
        recordType: 'CNAME',
        ttl: 300,
        ...config.dnsConfig
      },
      customHealthChecks: config.customHealthChecks ?? [
        {
          endpoint: '/health',
          expectedStatus: 200,
          timeout: 30000,
          retries: 3
        }
      ],
      customSmokeTests: config.customSmokeTests ?? [
        {
          name: 'API Health',
          description: 'Check API health endpoint',
          endpoint: '/health',
          method: 'GET',
          expectedStatus: 200
        }
      ]
    };
  }
}