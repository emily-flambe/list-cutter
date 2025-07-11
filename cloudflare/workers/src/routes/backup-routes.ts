import { Hono } from 'hono';
import { CloudflareEnv } from '../types/env';
import { ComprehensiveBackupService } from '../services/backup-service';
import { BackupVerificationService } from '../services/backup-verification-service';
import { DisasterRecoveryService } from '../services/disaster-recovery-service';
import { DegradedModeService } from '../services/degraded-mode-service';
import { DataExportService } from '../services/data-export-service';
import { BusinessContinuityService } from '../services/business-continuity-service';

const app = new Hono<{ Bindings: CloudflareEnv }>();

// Backup routes
app.post('/create', async (c) => {
  try {
    const backupService = new ComprehensiveBackupService(c.env);
    const result = await backupService.createFullBackup();
    
    return c.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Backup creation failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/incremental', async (c) => {
  try {
    const { lastBackupId } = await c.req.json();
    
    if (!lastBackupId) {
      return c.json({
        success: false,
        error: 'Last backup ID is required'
      }, 400);
    }
    
    const backupService = new ComprehensiveBackupService(c.env);
    const result = await backupService.createIncrementalBackup(lastBackupId);
    
    return c.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Incremental backup creation failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/verify', async (c) => {
  try {
    const { backupId } = await c.req.json();
    
    if (!backupId) {
      return c.json({
        success: false,
        error: 'Backup ID is required'
      }, 400);
    }
    
    const verificationService = new BackupVerificationService(c.env);
    const backupService = new ComprehensiveBackupService(c.env);
    
    // Get backup manifest
    const backups = await backupService.listBackups();
    const backup = backups.find(b => b.backupId === backupId);
    
    if (!backup) {
      return c.json({
        success: false,
        error: 'Backup not found'
      }, 404);
    }
    
    // Create manifest from backup result for verification
    const manifest = {
      backupId: backup.backupId,
      timestamp: backup.metadata.timestamp,
      type: backup.type,
      database: {
        backupKey: `database-backups/${backup.backupId}-database-backup.enc`,
        size: backup.size,
        itemCount: backup.itemCount,
        checksum: 'placeholder-checksum',
        tables: []
      },
      files: {
        manifestKey: `file-backups/${backup.backupId}-manifest.json`,
        fileCount: 0,
        totalSize: backup.size,
        copiedFiles: []
      },
      config: {
        configKey: `config-backups/${backup.backupId}-config-backup.enc`,
        size: 0,
        checksum: 'placeholder-checksum',
        settings: {
          environment: {},
          bindings: {},
          secrets: [],
          crons: []
        }
      },
      metadata: backup.metadata
    };
    
    const verification = await verificationService.verifyBackupIntegrity(manifest);
    
    return c.json({
      success: true,
      data: verification
    });
  } catch (error) {
    console.error('Backup verification failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/restore', async (c) => {
  try {
    const { backupId } = await c.req.json();
    
    if (!backupId) {
      return c.json({
        success: false,
        error: 'Backup ID is required'
      }, 400);
    }
    
    const backupService = new ComprehensiveBackupService(c.env);
    const result = await backupService.restoreFromBackup(backupId);
    
    return c.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Backup restore failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/list', async (c) => {
  try {
    const backupService = new ComprehensiveBackupService(c.env);
    const backups = await backupService.listBackups();
    
    return c.json({
      success: true,
      data: backups
    });
  } catch (error) {
    console.error('Failed to list backups:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.delete('/:backupId', async (c) => {
  try {
    const backupId = c.req.param('backupId');
    
    const backupService = new ComprehensiveBackupService(c.env);
    await backupService.deleteBackup(backupId);
    
    return c.json({
      success: true,
      message: `Backup ${backupId} deleted successfully`
    });
  } catch (error) {
    console.error('Failed to delete backup:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/cleanup', async (c) => {
  try {
    const backupService = new ComprehensiveBackupService(c.env);
    await backupService.cleanupExpiredBackups();
    
    return c.json({
      success: true,
      message: 'Expired backups cleaned up successfully'
    });
  } catch (error) {
    console.error('Failed to cleanup expired backups:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/test', async (c) => {
  try {
    const verificationService = new BackupVerificationService(c.env);
    const result = await verificationService.performBackupTest();
    
    return c.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Backup test failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Scheduled backup routes (called by cron)
app.post('/daily', async (c) => {
  try {
    console.log('Daily backup scheduled job triggered');
    
    const backupService = new ComprehensiveBackupService(c.env);
    const result = await backupService.createFullBackup();
    
    // Cleanup old backups after successful backup
    if (result.status === 'completed') {
      await backupService.cleanupExpiredBackups();
    }
    
    return c.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Daily backup failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/weekly', async (c) => {
  try {
    console.log('Weekly backup scheduled job triggered');
    
    const backupService = new ComprehensiveBackupService(c.env);
    
    // Get the latest backup for incremental backup
    const backups = await backupService.listBackups();
    const latestBackup = backups.find(backup => backup.status === 'completed');
    
    let result;
    if (latestBackup) {
      result = await backupService.createIncrementalBackup(latestBackup.backupId);
    } else {
      result = await backupService.createFullBackup();
    }
    
    return c.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Weekly backup failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/monthly', async (c) => {
  try {
    console.log('Monthly backup scheduled job triggered');
    
    const backupService = new ComprehensiveBackupService(c.env);
    const result = await backupService.createFullBackup();
    
    // Run comprehensive verification for monthly backup
    if (result.status === 'completed') {
      const verificationService = new BackupVerificationService(c.env);
      const testResult = await verificationService.performBackupTest();
      
      if (!testResult.isValid) {
        console.error('Monthly backup verification failed:', testResult.errors);
      }
    }
    
    return c.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Monthly backup failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;