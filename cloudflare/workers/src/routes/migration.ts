import { Hono } from 'hono';
import { FileMigrationService } from '../services/migration/file-migration.js';
import { ProductionCutoverOrchestrator, CutoverPhase } from '../services/migration/production-cutover-orchestrator.js';
import { ProductionMigrationService } from '../services/deployment/production-migration.js';
import { PythonMigrationIntegration } from '../services/migration/python-integration.js';
import { RollbackDataSyncService } from '../services/migration/rollback-sync.js';
import { R2StorageService } from '../services/storage/r2-service.js';
import type { CloudflareEnv } from '../types/env.js';

const migrationRoutes = new Hono<{ Bindings: CloudflareEnv }>();

/**
 * POST /api/migration/batch
 * Create a new migration batch
 */
migrationRoutes.post('/batch', async (c): Promise<Response> => {
  try {
    const { files, metadata } = await c.req.json();
    
    if (!files || !Array.isArray(files)) {
      return c.json({ error: 'Invalid files array' }, 400);
    }
    
    const r2Service = new R2StorageService(c.env.FILE_STORAGE, c.env.DB);
    const migrationService = new FileMigrationService(r2Service, c.env.DB);
    
    const batchId = await migrationService.createMigrationBatch(files, metadata || {});
    
    return c.json({
      success: true,
      batchId,
      message: `Created migration batch with ${files.length} files`
    });
  } catch (error) {
    console.error('Migration batch creation failed:', error);
    return c.json({
      error: 'Failed to create migration batch',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/migration/process
 * Process a migration batch
 */
migrationRoutes.post('/process', async (c): Promise<Response> => {
  try {
    const { batchId } = await c.req.json();
    
    if (!batchId) {
      return c.json({ error: 'Batch ID is required' }, 400);
    }
    
    const r2Service = new R2StorageService(c.env.FILE_STORAGE, c.env.DB);
    const migrationService = new FileMigrationService(r2Service, c.env.DB);
    
    const result = await migrationService.processMigrationBatch(batchId);
    
    return c.json({
      success: true,
      result,
      message: 'Migration batch processed successfully'
    });
  } catch (error) {
    console.error('Migration batch processing failed:', error);
    return c.json({
      error: 'Failed to process migration batch',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/migration/progress/:batchId
 * Get migration batch progress
 */
migrationRoutes.get('/progress/:batchId', async (c): Promise<Response> => {
  try {
    const batchId = c.req.param('batchId');
    
    if (!batchId) {
      return c.json({ error: 'Batch ID is required' }, 400);
    }
    
    const r2Service = new R2StorageService(c.env.FILE_STORAGE, c.env.DB);
    const migrationService = new FileMigrationService(r2Service, c.env.DB);
    
    const progress = await migrationService.getBatchProgress(batchId);
    
    return c.json({
      success: true,
      progress,
      message: 'Migration progress retrieved successfully'
    });
  } catch (error) {
    console.error('Migration progress retrieval failed:', error);
    return c.json({
      error: 'Failed to retrieve migration progress',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/migration/rollback
 * Rollback a migration batch
 */
migrationRoutes.post('/rollback', async (c): Promise<Response> => {
  try {
    const { batchId } = await c.req.json();
    
    if (!batchId) {
      return c.json({ error: 'Batch ID is required' }, 400);
    }
    
    const r2Service = new R2StorageService(c.env.FILE_STORAGE, c.env.DB);
    const migrationService = new FileMigrationService(r2Service, c.env.DB);
    
    await migrationService.rollbackMigrationBatch(batchId);
    
    return c.json({
      success: true,
      message: 'Migration batch rolled back successfully'
    });
  } catch (error) {
    console.error('Migration rollback failed:', error);
    return c.json({
      error: 'Failed to rollback migration batch',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/migration/batches
 * List all migration batches
 */
migrationRoutes.get('/batches', async (c): Promise<Response> => {
  try {
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    
    const results = await c.env.DB.prepare(`
      SELECT batch_id, total_files, completed_files, failed_files, verified_files,
             status, started_at, completed_at, created_at
      FROM migration_batches
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();
    
    return c.json({
      success: true,
      batches: results.results,
      pagination: {
        limit,
        offset,
        total: results.results.length
      }
    });
  } catch (error) {
    console.error('Migration batches listing failed:', error);
    return c.json({
      error: 'Failed to list migration batches',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/migration/batch/:batchId/files
 * Get files in a migration batch
 */
migrationRoutes.get('/batch/:batchId/files', async (c): Promise<Response> => {
  try {
    const batchId = c.req.param('batchId');
    const status = c.req.query('status'); // Optional status filter
    
    if (!batchId) {
      return c.json({ error: 'Batch ID is required' }, 400);
    }
    
    let query = `
      SELECT file_id, source_path, target_r2_key, original_checksum, 
             migrated_checksum, file_size, status, error_message,
             started_at, completed_at, attempts
      FROM file_migrations
      WHERE batch_id = ?
    `;
    
    const params = [batchId];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at ASC';
    
    const results = await c.env.DB.prepare(query).bind(...params).all();
    
    return c.json({
      success: true,
      files: results.results,
      batchId,
      filtered: status ? { status } : null
    });
  } catch (error) {
    console.error('Migration batch files retrieval failed:', error);
    return c.json({
      error: 'Failed to retrieve batch files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/migration/verify
 * Verify integrity of migrated files
 */
migrationRoutes.post('/verify', async (c): Promise<Response> => {
  try {
    const { batchId, fileIds } = await c.req.json();
    
    if (!batchId && !fileIds) {
      return c.json({ error: 'Either batchId or fileIds is required' }, 400);
    }
    
    const r2Service = new R2StorageService(c.env.FILE_STORAGE, c.env.DB);
    const migrationService = new FileMigrationService(r2Service, c.env.DB);
    
    let filesToVerify: string[] = [];
    
    if (batchId) {
      // Get all completed files from batch
      const batchFiles = await c.env.DB.prepare(`
        SELECT file_id FROM file_migrations 
        WHERE batch_id = ? AND status = 'completed'
      `).bind(batchId).all();
      
      filesToVerify = batchFiles.results.map(row => row.file_id as string);
    } else {
      filesToVerify = fileIds;
    }
    
    const verificationResults = [];
    
    for (const fileId of filesToVerify) {
      try {
        // Get file info
        const fileInfo = await c.env.DB.prepare(`
          SELECT fm.original_checksum, fm.target_r2_key, f.user_id
          FROM file_migrations fm
          JOIN files f ON fm.file_id = f.id
          WHERE fm.file_id = ?
        `).bind(fileId).first();
        
        if (!fileInfo) {
          verificationResults.push({
            fileId,
            success: false,
            error: 'File not found in migration records'
          });
          continue;
        }
        
        // Verify file integrity
        const verification = await migrationService.verifyMigration(
          fileId,
          fileInfo.user_id as string,
          fileInfo.original_checksum as string
        );
        
        verificationResults.push({
          fileId,
          success: verification.success,
          error: verification.error,
          checksum: verification.checksum
        });
        
        // Update migration status if verification successful
        if (verification.success) {
          await c.env.DB.prepare(`
            UPDATE file_migrations 
            SET status = 'verified', migrated_checksum = ?
            WHERE file_id = ?
          `).bind(verification.checksum, fileId).run();
        }
        
      } catch (error) {
        verificationResults.push({
          fileId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    const successful = verificationResults.filter(r => r.success).length;
    const failed = verificationResults.filter(r => !r.success).length;
    
    return c.json({
      success: true,
      results: verificationResults,
      summary: {
        total: verificationResults.length,
        successful,
        failed
      }
    });
  } catch (error) {
    console.error('Migration verification failed:', error);
    return c.json({
      error: 'Failed to verify migrations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/migration/production/cutover
 * Execute complete production cutover
 */
migrationRoutes.post('/production/cutover', async (c): Promise<Response> => {
  try {
    const { config } = await c.req.json();
    
    if (!config) {
      return c.json({ error: 'Cutover configuration is required' }, 400);
    }
    
    // Create cutover orchestrator
    const orchestrator = new ProductionCutoverOrchestrator(c.env, config);
    
    // Execute cutover asynchronously (would typically use Durable Objects or queues)
    const result = await orchestrator.executeCutover();
    
    return c.json({
      success: result.success,
      result,
      message: result.success ? 'Production cutover completed successfully' : 'Production cutover failed'
    });
  } catch (error) {
    console.error('Production cutover failed:', error);
    return c.json({
      error: 'Failed to execute production cutover',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/migration/production/status
 * Get production cutover status
 */
migrationRoutes.get('/production/status', async (c): Promise<Response> => {
  try {
    // This would typically fetch from a persistent store
    // For now, return a mock status
    const status = {
      isActive: false,
      currentPhase: CutoverPhase.COMPLETED,
      progress: {
        phase: CutoverPhase.COMPLETED,
        step: 'Cutover completed',
        percentage: 100,
        startTime: new Date().toISOString(),
        currentStepStartTime: new Date().toISOString(),
        errors: [],
        warnings: []
      }
    };
    
    return c.json({
      success: true,
      status,
      message: 'Cutover status retrieved successfully'
    });
  } catch (error) {
    console.error('Failed to get cutover status:', error);
    return c.json({
      error: 'Failed to retrieve cutover status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/migration/production/full
 * Execute full production data migration (without cutover)
 */
migrationRoutes.post('/production/full', async (c): Promise<Response> => {
  try {
    const migrationService = new ProductionMigrationService(c.env);
    const result = await migrationService.executeFullMigration();
    
    return c.json({
      success: result.success,
      result,
      message: result.success ? 'Production migration completed successfully' : 'Production migration failed'
    });
  } catch (error) {
    console.error('Production migration failed:', error);
    return c.json({
      error: 'Failed to execute production migration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/migration/production/migration-status
 * Get production migration status
 */
migrationRoutes.get('/production/migration-status', async (c): Promise<Response> => {
  try {
    const migrationService = new ProductionMigrationService(c.env);
    const status = await migrationService.getMigrationStatus();
    
    return c.json({
      success: true,
      status,
      message: 'Migration status retrieved successfully'
    });
  } catch (error) {
    console.error('Failed to get migration status:', error);
    return c.json({
      error: 'Failed to retrieve migration status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/migration/production/maintenance
 * Enable/disable maintenance mode
 */
migrationRoutes.post('/production/maintenance', async (c): Promise<Response> => {
  try {
    const { action, reason } = await c.req.json();
    
    if (!action || !['enable', 'disable'].includes(action)) {
      return c.json({ error: 'Valid action (enable/disable) is required' }, 400);
    }
    
    const migrationService = new ProductionMigrationService(c.env);
    
    if (action === 'enable') {
      await migrationService.enableMaintenanceMode(reason || 'Maintenance in progress');
    } else {
      await migrationService.disableMaintenanceMode();
    }
    
    return c.json({
      success: true,
      message: `Maintenance mode ${action}d successfully`
    });
  } catch (error) {
    console.error('Maintenance mode operation failed:', error);
    return c.json({
      error: 'Failed to update maintenance mode',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/migration/production/rollback
 * Execute production migration rollback
 */
migrationRoutes.post('/production/rollback', async (c): Promise<Response> => {
  try {
    const migrationService = new ProductionMigrationService(c.env);
    await migrationService.rollbackMigration();
    
    return c.json({
      success: true,
      message: 'Production migration rollback completed successfully'
    });
  } catch (error) {
    console.error('Production rollback failed:', error);
    return c.json({
      error: 'Failed to execute production rollback',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/migration/integration/python-status
 * Check Python migration orchestrator integration status
 */
migrationRoutes.get('/integration/python-status', async (c): Promise<Response> => {
  try {
    const pythonIntegration = new PythonMigrationIntegration(c.env);
    const isAvailable = await pythonIntegration.isAvailable();
    
    return c.json({
      success: true,
      status: isAvailable ? 'active' : 'unreachable',
      endpoint: process.env.PYTHON_ORCHESTRATOR_ENDPOINT || 'not configured',
      message: `Python orchestrator is ${isAvailable ? 'active' : 'unreachable'}`
    });
  } catch (error) {
    console.error('Python integration status check failed:', error);
    return c.json({
      error: 'Failed to check Python integration status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/migration/integration/python-start
 * Start Python migration orchestration
 */
migrationRoutes.post('/integration/python-start', async (c): Promise<Response> => {
  try {
    const { config } = await c.req.json();
    
    if (!config) {
      return c.json({ error: 'Python migration configuration is required' }, 400);
    }
    
    const pythonIntegration = new PythonMigrationIntegration(c.env);
    const result = await pythonIntegration.startMigration(config);
    
    return c.json({
      success: result.success,
      result,
      message: result.success ? 'Python migration started successfully' : 'Python migration failed to start'
    });
  } catch (error) {
    console.error('Python migration start failed:', error);
    return c.json({
      error: 'Failed to start Python migration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/migration/integration/python-status/:migrationId
 * Get Python migration status
 */
migrationRoutes.get('/integration/python-status/:migrationId', async (c): Promise<Response> => {
  try {
    const migrationId = c.req.param('migrationId');
    
    if (!migrationId) {
      return c.json({ error: 'Migration ID is required' }, 400);
    }
    
    const pythonIntegration = new PythonMigrationIntegration(c.env);
    const result = await pythonIntegration.getMigrationStatus(migrationId);
    
    return c.json({
      success: result.success,
      status: result.status,
      message: result.success ? 'Python migration status retrieved' : 'Failed to get status'
    });
  } catch (error) {
    console.error('Python migration status check failed:', error);
    return c.json({
      error: 'Failed to get Python migration status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/migration/integration/python-rollback
 * Execute Python migration rollback
 */
migrationRoutes.post('/integration/python-rollback', async (c): Promise<Response> => {
  try {
    const { migrationId, targetPhase } = await c.req.json();
    
    if (!migrationId) {
      return c.json({ error: 'Migration ID is required' }, 400);
    }
    
    const pythonIntegration = new PythonMigrationIntegration(c.env);
    const result = await pythonIntegration.rollbackMigration(migrationId, targetPhase);
    
    return c.json({
      success: result.success,
      result,
      message: result.success ? 'Python migration rollback completed' : 'Python migration rollback failed'
    });
  } catch (error) {
    console.error('Python migration rollback failed:', error);
    return c.json({
      error: 'Failed to execute Python migration rollback',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/migration/rollback/sync
 * Execute rollback data synchronization
 */
migrationRoutes.post('/rollback/sync', async (c): Promise<Response> => {
  try {
    const { config } = await c.req.json();
    
    if (!config) {
      return c.json({ error: 'Rollback sync configuration is required' }, 400);
    }
    
    const rollbackSync = new RollbackDataSyncService(c.env);
    const result = await rollbackSync.executeRollbackSync(config);
    
    return c.json({
      success: result.success,
      result,
      message: result.success ? 'Rollback data synchronization completed' : 'Rollback data synchronization failed'
    });
  } catch (error) {
    console.error('Rollback data synchronization failed:', error);
    return c.json({
      error: 'Failed to execute rollback data synchronization',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/migration/integration/coordinate-sync
 * Coordinate data sync with Python orchestrator
 */
migrationRoutes.post('/integration/coordinate-sync', async (c): Promise<Response> => {
  try {
    const { syncType } = await c.req.json();
    
    if (!syncType || !['users', 'files', 'filters'].includes(syncType)) {
      return c.json({ error: 'Valid sync type (users, files, filters) is required' }, 400);
    }
    
    const pythonIntegration = new PythonMigrationIntegration(c.env);
    const result = await pythonIntegration.coordinateDataSync(syncType);
    
    return c.json({
      success: result.success,
      result,
      message: result.success ? `${syncType} data sync completed` : `${syncType} data sync failed`
    });
  } catch (error) {
    console.error('Data sync coordination failed:', error);
    return c.json({
      error: 'Failed to coordinate data sync',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default migrationRoutes;