import { Hono } from 'hono';
import { CloudflareEnv } from '../types/env';
import { DisasterRecoveryService } from '../services/disaster-recovery-service';
import { ComprehensiveBackupService } from '../services/backup-service';
import { BackupVerificationService } from '../services/backup-verification-service';
import { DegradedModeService } from '../services/degraded-mode-service';
import { BusinessContinuityService } from '../services/business-continuity-service';
import { DataExportService } from '../services/data-export-service';
import { DisasterScenario } from '../types/backup';

const app = new Hono<{ Bindings: CloudflareEnv }>();

// Disaster Recovery routes
app.post('/initiate', async (c) => {
  try {
    const scenario: DisasterScenario = await c.req.json();
    
    // Validate scenario
    if (!scenario.type || !scenario.severity || !scenario.description) {
      return c.json({
        success: false,
        error: 'Invalid disaster scenario. Required fields: type, severity, description'
      }, 400);
    }
    
    const backupService = new ComprehensiveBackupService(c.env);
    const verificationService = new BackupVerificationService(c.env);
    const degradedModeService = new DegradedModeService(c.env);
    const disasterRecoveryService = new DisasterRecoveryService(c.env, backupService, verificationService, degradedModeService);
    
    const result = await disasterRecoveryService.initiateDisasterRecovery(scenario);
    
    return c.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Disaster recovery initiation failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/auto-recovery', async (c) => {
  try {
    const backupService = new ComprehensiveBackupService(c.env);
    const verificationService = new BackupVerificationService(c.env);
    const degradedModeService = new DegradedModeService(c.env);
    const disasterRecoveryService = new DisasterRecoveryService(c.env, backupService, verificationService, degradedModeService);
    
    const result = await disasterRecoveryService.initiateAutomatedDisasterRecovery();
    
    return c.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Automated disaster recovery failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/status', async (c) => {
  try {
    // Get current system health and recovery status
    const degradedModeService = new DegradedModeService(c.env);
    
    const currentMode = await degradedModeService.getCurrentMode();
    const healthCheck = await degradedModeService.performHealthCheck();
    const systemLoad = await degradedModeService.checkSystemLoad();
    
    return c.json({
      success: true,
      data: {
        currentMode,
        healthCheck,
        systemLoad,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to get recovery status:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/scenarios', async (c) => {
  try {
    // Get predefined disaster scenarios
    const scenarios = [
      {
        type: 'database_corruption',
        severity: 'high',
        description: 'Primary database corruption requiring restoration from backup',
        estimatedDowntime: 2 * 60 * 60 * 1000, // 2 hours
        affectedServices: ['database', 'api_gateway']
      },
      {
        type: 'file_storage_failure',
        severity: 'high',
        description: 'File storage system failure requiring restoration from backup',
        estimatedDowntime: 3 * 60 * 60 * 1000, // 3 hours
        affectedServices: ['file_storage', 'api_gateway']
      },
      {
        type: 'complete_system_failure',
        severity: 'critical',
        description: 'Complete system failure requiring full recovery',
        estimatedDowntime: 4 * 60 * 60 * 1000, // 4 hours
        affectedServices: ['database', 'file_storage', 'api_gateway', 'monitoring', 'authentication']
      },
      {
        type: 'partial_outage',
        severity: 'medium',
        description: 'Partial service outage affecting specific components',
        estimatedDowntime: 1 * 60 * 60 * 1000, // 1 hour
        affectedServices: []
      }
    ];
    
    return c.json({
      success: true,
      data: scenarios
    });
  } catch (error) {
    console.error('Failed to get disaster scenarios:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/history', async (c) => {
  try {
    // Get disaster recovery operation history
    const recoveryHistory = await c.env.DB.prepare(`
      SELECT * FROM disaster_recovery_operations 
      ORDER BY created_at DESC 
      LIMIT 50
    `).all();
    
    const history = recoveryHistory.results.map(record => ({
      recoveryId: String(record.recovery_id),
      scenarioType: String(record.scenario_type),
      strategyType: String(record.strategy_type),
      status: String(record.status),
      duration: Number(record.duration),
      dataRecovered: Number(record.data_recovered),
      servicesRestored: JSON.parse(String(record.services_restored) || '[]'),
      degradedServices: JSON.parse(String(record.degraded_services) || '[]'),
      createdAt: String(record.created_at),
      error: record.error ? String(record.error) : null
    }));
    
    return c.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Failed to get recovery history:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Degraded Mode routes
app.post('/degraded-mode/enable', async (c) => {
  try {
    const { reason } = await c.req.json();
    
    if (!reason) {
      return c.json({
        success: false,
        error: 'Reason is required to enable degraded mode'
      }, 400);
    }
    
    const degradedModeService = new DegradedModeService(c.env);
    await degradedModeService.enableDegradedMode(reason);
    
    return c.json({
      success: true,
      message: 'Degraded mode enabled successfully',
      reason
    });
  } catch (error) {
    console.error('Failed to enable degraded mode:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/degraded-mode/disable', async (c) => {
  try {
    const degradedModeService = new DegradedModeService(c.env);
    await degradedModeService.disableDegradedMode();
    
    return c.json({
      success: true,
      message: 'Degraded mode disabled successfully'
    });
  } catch (error) {
    console.error('Failed to disable degraded mode:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/degraded-mode/status', async (c) => {
  try {
    const degradedModeService = new DegradedModeService(c.env);
    
    const currentMode = await degradedModeService.getCurrentMode();
    const isReadOnly = await degradedModeService.isReadOnlyMode();
    const healthCheck = await degradedModeService.performHealthCheck();
    
    return c.json({
      success: true,
      data: {
        currentMode,
        isReadOnly,
        healthCheck,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to get degraded mode status:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/degraded-mode/features/:featureName', async (c) => {
  try {
    const featureName = c.req.param('featureName');
    
    const degradedModeService = new DegradedModeService(c.env);
    const isEnabled = await degradedModeService.isFeatureEnabled(featureName);
    
    return c.json({
      success: true,
      data: {
        featureName,
        enabled: isEnabled
      }
    });
  } catch (error) {
    console.error('Failed to check feature status:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/health-check', async (c) => {
  try {
    const degradedModeService = new DegradedModeService(c.env);
    const healthCheck = await degradedModeService.performHealthCheck();
    
    return c.json({
      success: true,
      data: healthCheck
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/auto-recovery-check', async (c) => {
  try {
    const degradedModeService = new DegradedModeService(c.env);
    
    // Check if system should enter degraded mode
    const shouldEnterDegraded = await degradedModeService.shouldEnterDegradedMode();
    const currentMode = await degradedModeService.getCurrentMode();
    
    if (shouldEnterDegraded && currentMode === 'operational') {
      await degradedModeService.enableDegradedMode('automatic_degradation_due_to_performance_issues');
      
      return c.json({
        success: true,
        message: 'Automatic degraded mode enabled due to performance issues',
        action: 'degraded_mode_enabled'
      });
    }
    
    if (!shouldEnterDegraded && currentMode === 'degraded') {
      // Check if system can exit degraded mode
      const healthCheck = await degradedModeService.performHealthCheck();
      
      if (healthCheck.isHealthy && healthCheck.overallScore > 90) {
        await degradedModeService.disableDegradedMode();
        
        return c.json({
          success: true,
          message: 'Automatic recovery from degraded mode',
          action: 'degraded_mode_disabled'
        });
      }
    }
    
    return c.json({
      success: true,
      message: 'No automatic recovery action needed',
      action: 'no_action',
      currentMode,
      shouldEnterDegraded
    });
  } catch (error) {
    console.error('Auto recovery check failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Business Continuity routes
app.get('/business-continuity/plan', async (c) => {
  try {
    const backupService = new ComprehensiveBackupService(c.env);
    const verificationService = new BackupVerificationService(c.env);
    const degradedModeService = new DegradedModeService(c.env);
    const disasterRecoveryService = new DisasterRecoveryService(c.env, backupService, verificationService, degradedModeService);
    const degradedModeService = new DegradedModeService(c.env);
    const dataExportService = new DataExportService(c.env);
    const businessContinuityService = new BusinessContinuityService(
      c.env, 
      disasterRecoveryService, 
      degradedModeService, 
      dataExportService, 
      backupService
    );
    
    const plan = await businessContinuityService.getCurrentPlan();
    
    return c.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Failed to get business continuity plan:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/business-continuity/test', async (c) => {
  try {
    const backupService = new ComprehensiveBackupService(c.env);
    const verificationService = new BackupVerificationService(c.env);
    const degradedModeService = new DegradedModeService(c.env);
    const disasterRecoveryService = new DisasterRecoveryService(c.env, backupService, verificationService, degradedModeService);
    const degradedModeService = new DegradedModeService(c.env);
    const dataExportService = new DataExportService(c.env);
    const businessContinuityService = new BusinessContinuityService(
      c.env, 
      disasterRecoveryService, 
      degradedModeService, 
      dataExportService, 
      backupService
    );
    
    const testResult = await businessContinuityService.testBusinessContinuityPlan();
    
    return c.json({
      success: true,
      data: testResult
    });
  } catch (error) {
    console.error('Business continuity test failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/business-continuity/test-history', async (c) => {
  try {
    const testHistory = await c.env.DB.prepare(`
      SELECT * FROM bc_test_results 
      ORDER BY timestamp DESC 
      LIMIT 20
    `).all();
    
    const history = testHistory.results.map(record => ({
      testId: String(record.test_id),
      timestamp: String(record.timestamp),
      overallStatus: String(record.overall_status),
      results: JSON.parse(String(record.results) || '[]'),
      error: record.error ? String(record.error) : null,
      createdAt: String(record.created_at)
    }));
    
    return c.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Failed to get test history:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;