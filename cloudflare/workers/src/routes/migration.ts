import { Hono } from 'hono';
import { FileMigrationService } from '../services/migration/file-migration';
import { R2StorageService } from '../services/storage/r2-service';
import type { CloudflareEnv } from '../types/env';

const migrationRoutes = new Hono<{ Bindings: CloudflareEnv }>();

/**
 * POST /api/migration/batch
 * Create a new migration batch
 */
migrationRoutes.post('/batch', async (c) => {
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
migrationRoutes.post('/process', async (c) => {
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
migrationRoutes.get('/progress/:batchId', async (c) => {
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
migrationRoutes.post('/rollback', async (c) => {
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
migrationRoutes.get('/batches', async (c) => {
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
migrationRoutes.get('/batch/:batchId/files', async (c) => {
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
migrationRoutes.post('/verify', async (c) => {
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

export default migrationRoutes;