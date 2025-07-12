import { Hono } from 'hono';
import { BlueGreenDeployment } from '../../services/deployment/blue-green-deployment.js';
import { ProductionMigrationService } from '../../services/deployment/production-migration.js';
import type { CloudflareEnv } from '../../types/env.js';
import type {
  DeploymentRequest,
  CutoverRequest,
  RollbackRequest,
  DeploymentConfiguration
} from '../../types/deployment.js';

const blueGreen = new Hono<{ Bindings: CloudflareEnv }>();

// Initialize deployment services
let deploymentService: BlueGreenDeployment | null = null;
let migrationService: ProductionMigrationService | null = null;

const initializeDeploymentService = (c: any): BlueGreenDeployment => {
  if (!deploymentService) {
    const config: Partial<DeploymentConfiguration> = {
      enableValidation: true,
      validationTimeout: 300000,
      monitoringDuration: 300000,
      enableAutoRollback: true,
      rollbackThresholds: {
        maxErrorRate: 5,
        maxResponseTime: 5000,
        minSuccessRate: 95
      },
      dnsConfig: {
        domain: c.env.CORS_ORIGIN?.replace('https://', '') || 'api.list-cutter.com',
        recordType: 'CNAME',
        ttl: 300
      }
    };
    
    deploymentService = new BlueGreenDeployment(c.env, config);
  }
  return deploymentService;
};

const initializeMigrationService = (c: any): ProductionMigrationService => {
  if (!migrationService) {
    migrationService = new ProductionMigrationService(c.env);
  }
  return migrationService;
};

/**
 * GET /deployment/status
 * Get current deployment status and state
 */
blueGreen.get('/status', async (c) => {
  try {
    const service = initializeDeploymentService(c);
    const state = await service.getCurrentState();
    const currentVersion = await service.getCurrentVersion();

    return c.json({
      success: true,
      data: {
        currentState: state,
        activeEnvironment: currentVersion,
        inactiveEnvironment: state.currentInactive,
        lastCutover: state.lastCutover,
        isDeploymentInProgress: state.isDeploymentInProgress,
        isCutoverInProgress: state.isCutoverInProgress,
        deploymentHistory: state.deploymentHistory.slice(-10) // Last 10 deployments
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get deployment status',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * POST /deployment/deploy
 * Deploy new version to inactive environment
 */
blueGreen.post('/deploy', async (c) => {
  try {
    const body = await c.req.json();
    
    // Validate request
    const request: DeploymentRequest = {
      version: body.version,
      deploymentType: body.deploymentType || 'update',
      commitHash: body.commitHash,
      metadata: body.metadata,
      skipValidation: body.skipValidation || false,
      customValidation: body.customValidation
    };

    if (!request.version) {
      return c.json({
        success: false,
        error: 'Version is required'
      }, 400);
    }

    const service = initializeDeploymentService(c);
    const result = await service.deployToInactive(request);

    return c.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString()
    }, result.success ? 200 : 500);
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Deployment failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * POST /deployment/cutover
 * Cut over to new version (switch active environment)
 */
blueGreen.post('/cutover', async (c) => {
  try {
    const body = await c.req.json();
    
    const request: CutoverRequest = {
      targetVersion: body.targetVersion,
      skipValidation: body.skipValidation || false,
      monitoringDuration: body.monitoringDuration,
      customValidation: body.customValidation
    };

    if (!request.targetVersion) {
      return c.json({
        success: false,
        error: 'Target version is required'
      }, 400);
    }

    const service = initializeDeploymentService(c);
    const result = await service.cutoverToNewVersion(request);

    return c.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString()
    }, result.success ? 200 : 500);
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Cutover failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * POST /deployment/rollback
 * Rollback to previous version
 */
blueGreen.post('/rollback', async (c) => {
  try {
    const body = await c.req.json();
    
    const request: RollbackRequest = {
      reason: body.reason || 'Manual rollback',
      targetVersion: body.targetVersion,
      emergencyRollback: body.emergencyRollback || false
    };

    const service = initializeDeploymentService(c);
    const result = await service.rollback(request);

    return c.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString()
    }, result.success ? 200 : 500);
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Rollback failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * POST /deployment/validate
 * Validate specific environment
 */
blueGreen.post('/validate', async (c) => {
  try {
    const body = await c.req.json();
    
    const environment = body.environment;
    const version = body.version || 'current';

    if (!environment || !['blue', 'green'].includes(environment)) {
      return c.json({
        success: false,
        error: 'Valid environment (blue or green) is required'
      }, 400);
    }

    const service = initializeDeploymentService(c);
    const results = await service.validateDeployment(environment, version);

    const allPassed = results.every(r => r.success);

    return c.json({
      success: true,
      data: {
        environment,
        version,
        allValidationsPassed: allPassed,
        validationResults: results,
        summary: {
          total: results.length,
          passed: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          averageDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Validation failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * GET /deployment/history
 * Get deployment history
 */
blueGreen.get('/history', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    const service = initializeDeploymentService(c);
    const state = await service.getCurrentState();
    
    const history = state.deploymentHistory
      .sort((a, b) => new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime())
      .slice(offset, offset + limit);

    return c.json({
      success: true,
      data: {
        deployments: history,
        totalCount: state.deploymentHistory.length,
        pageSize: limit,
        currentPage: Math.floor(offset / limit) + 1,
        hasMore: offset + limit < state.deploymentHistory.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get deployment history',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * GET /deployment/health
 * Health check for deployment service
 */
blueGreen.get('/health', async (c) => {
  try {
    const service = initializeDeploymentService(c);
    const state = await service.getCurrentState();
    
    // Check if services are available
    const hasKV = !!c.env.DEPLOYMENT_KV;
    const hasAnalytics = !!c.env.ANALYTICS;
    const hasDB = !!c.env.DB;

    return c.json({
      status: 'healthy',
      services: {
        deploymentKV: hasKV,
        analytics: hasAnalytics,
        database: hasDB,
        deploymentService: !!service
      },
      currentState: {
        activeEnvironment: state.currentActive,
        deploymentInProgress: state.isDeploymentInProgress,
        cutoverInProgress: state.isCutoverInProgress
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * GET /deployment/environments/:environment/health
 * Check health of specific environment
 */
blueGreen.get('/environments/:environment/health', async (c) => {
  try {
    const environment = c.req.param('environment');
    
    if (!['blue', 'green'].includes(environment)) {
      return c.json({
        success: false,
        error: 'Invalid environment. Must be blue or green'
      }, 400);
    }

    const service = initializeDeploymentService(c);
    const results = await service.validateDeployment(environment as any, 'current');
    
    const healthCheckResults = results.filter(r => r.type === 'health_check');
    const allHealthy = healthCheckResults.every(r => r.success);

    return c.json({
      success: true,
      data: {
        environment,
        healthy: allHealthy,
        healthChecks: healthCheckResults,
        summary: {
          total: healthCheckResults.length,
          passed: healthCheckResults.filter(r => r.success).length,
          failed: healthCheckResults.filter(r => !r.success).length
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Environment health check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * POST /deployment/maintenance
 * Enable/disable maintenance mode
 */
blueGreen.post('/maintenance', async (c) => {
  try {
    const body = await c.req.json();
    
    const enabled = body.enabled;
    const reason = body.reason;
    const estimatedDuration = body.estimatedDuration;
    const customMessage = body.customMessage;

    if (typeof enabled !== 'boolean') {
      return c.json({
        success: false,
        error: 'enabled field is required and must be boolean'
      }, 400);
    }

    // In a real implementation, this would update maintenance mode state
    const maintenanceState = {
      enabled,
      enabledAt: enabled ? new Date().toISOString() : undefined,
      reason,
      estimatedDuration,
      customMessage
    };

    // Store maintenance state in KV if available
    if (c.env.DEPLOYMENT_KV) {
      await c.env.DEPLOYMENT_KV.put('maintenance_mode', JSON.stringify(maintenanceState));
    }

    return c.json({
      success: true,
      data: {
        maintenanceMode: maintenanceState,
        message: enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update maintenance mode',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * GET /deployment/maintenance
 * Get current maintenance mode status
 */
blueGreen.get('/maintenance', async (c) => {
  try {
    let maintenanceState = { enabled: false };

    if (c.env.DEPLOYMENT_KV) {
      const stateJson = await c.env.DEPLOYMENT_KV.get('maintenance_mode');
      if (stateJson) {
        maintenanceState = JSON.parse(stateJson);
      }
    }

    return c.json({
      success: true,
      data: maintenanceState,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get maintenance mode status',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * POST /deployment/migration/execute
 * Execute full production migration
 */
blueGreen.post('/migration/execute', async (c) => {
  try {
    const service = initializeMigrationService(c);
    const result = await service.executeFullMigration();

    return c.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString()
    }, result.success ? 200 : 500);
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration execution failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * GET /deployment/migration/status
 * Get migration status
 */
blueGreen.get('/migration/status', async (c) => {
  try {
    const service = initializeMigrationService(c);
    const status = await service.getMigrationStatus();

    return c.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get migration status',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * POST /deployment/migration/rollback
 * Rollback migration
 */
blueGreen.post('/migration/rollback', async (c) => {
  try {
    const service = initializeMigrationService(c);
    await service.rollbackMigration();

    return c.json({
      success: true,
      message: 'Migration rollback completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration rollback failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * POST /deployment/maintenance/enable
 * Enable maintenance mode
 */
blueGreen.post('/maintenance/enable', async (c) => {
  try {
    const body = await c.req.json();
    const reason = body.reason || 'Scheduled maintenance';

    const service = initializeMigrationService(c);
    await service.enableMaintenanceMode(reason);

    return c.json({
      success: true,
      message: 'Maintenance mode enabled',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to enable maintenance mode',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * POST /deployment/maintenance/disable
 * Disable maintenance mode
 */
blueGreen.post('/maintenance/disable', async (c) => {
  try {
    const service = initializeMigrationService(c);
    await service.disableMaintenanceMode();

    return c.json({
      success: true,
      message: 'Maintenance mode disabled',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to disable maintenance mode',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

export default blueGreen;