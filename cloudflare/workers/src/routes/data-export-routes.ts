import { Hono } from 'hono';
import { CloudflareEnv } from '../types/env';
import { DataExportService } from '../services/data-export-service';
import { ExportFormat } from '../types/backup';

const app = new Hono<{ Bindings: CloudflareEnv }>();

// User Data Export routes
app.post('/user/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const body = await c.req.json().catch(() => ({}));
    
    const format: ExportFormat = {
      type: body.format?.type || 'json',
      compression: body.format?.compression || 'gzip',
      encrypted: body.format?.encrypted ?? true
    };
    
    const dataExportService = new DataExportService(c.env);
    const result = await dataExportService.exportUserData(userId, format);
    
    return c.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('User data export failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/system', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    
    const formats: ExportFormat[] = body.formats || [
      { type: 'json', compression: 'gzip', encrypted: true },
      { type: 'csv', compression: 'gzip', encrypted: false },
      { type: 'sql', compression: 'gzip', encrypted: true }
    ];
    
    const dataExportService = new DataExportService(c.env);
    const result = await dataExportService.exportSystemData(formats);
    
    return c.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('System data export failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/table/:tableName', async (c) => {
  try {
    const tableName = c.req.param('tableName');
    const body = await c.req.json().catch(() => ({}));
    
    const format: ExportFormat = {
      type: body.format?.type || 'csv',
      compression: body.format?.compression || 'gzip',
      encrypted: body.format?.encrypted ?? false
    };
    
    const dataExportService = new DataExportService(c.env);
    const result = await dataExportService.exportTableData(tableName, format);
    
    return c.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Table data export failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/list', async (c) => {
  try {
    const userId = c.req.query('userId');
    
    const dataExportService = new DataExportService(c.env);
    const exports = await dataExportService.listExports(userId);
    
    return c.json({
      success: true,
      data: exports
    });
  } catch (error) {
    console.error('Failed to list exports:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/download/:exportId', async (c) => {
  try {
    const exportId = c.req.param('exportId');
    
    // Get export record
    const exportRecord = await c.env.DB.prepare(`
      SELECT * FROM data_exports WHERE export_id = ?
    `).bind(exportId).all();
    
    if (exportRecord.results.length === 0) {
      return c.json({
        success: false,
        error: 'Export not found'
      }, 404);
    }
    
    const record = exportRecord.results[0];
    
    // Check if export has expired
    const expiresAt = new Date(String(record.expires_at));
    if (expiresAt < new Date()) {
      return c.json({
        success: false,
        error: 'Export has expired'
      }, 410);
    }
    
    // Extract key from download URL
    const downloadUrl = String(record.download_url);
    const exportKey = downloadUrl.split('/').pop();
    
    if (!exportKey) {
      return c.json({
        success: false,
        error: 'Invalid export key'
      }, 400);
    }
    
    // Get export file from storage
    const exportFile = await c.env.FILE_STORAGE.get(exportKey);
    
    if (!exportFile) {
      return c.json({
        success: false,
        error: 'Export file not found'
      }, 404);
    }
    
    // Return file with appropriate headers
    const format = JSON.parse(String(record.format) || '{}');
    const contentType = format.type === 'json' ? 'application/json' :
                       format.type === 'csv' ? 'text/csv' :
                       format.type === 'sql' ? 'text/sql' :
                       'application/octet-stream';
    
    return new Response(exportFile.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${exportKey}"`,
        'Content-Length': String(exportFile.size)
      }
    });
  } catch (error) {
    console.error('Export download failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.delete('/:exportId', async (c) => {
  try {
    const exportId = c.req.param('exportId');
    
    const dataExportService = new DataExportService(c.env);
    await dataExportService.deleteExport(exportId);
    
    return c.json({
      success: true,
      message: `Export ${exportId} deleted successfully`
    });
  } catch (error) {
    console.error('Failed to delete export:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/cleanup', async (c) => {
  try {
    const dataExportService = new DataExportService(c.env);
    await dataExportService.cleanupExpiredExports();
    
    return c.json({
      success: true,
      message: 'Expired exports cleaned up successfully'
    });
  } catch (error) {
    console.error('Failed to cleanup expired exports:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Export format validation
app.get('/formats', async (c) => {
  try {
    const supportedFormats = [
      {
        type: 'json',
        description: 'JavaScript Object Notation',
        supportsCompression: true,
        supportsEncryption: true,
        defaultCompression: 'gzip'
      },
      {
        type: 'csv',
        description: 'Comma Separated Values',
        supportsCompression: true,
        supportsEncryption: false,
        defaultCompression: 'gzip'
      },
      {
        type: 'sql',
        description: 'SQL Insert Statements',
        supportsCompression: true,
        supportsEncryption: true,
        defaultCompression: 'gzip'
      },
      {
        type: 'xml',
        description: 'Extensible Markup Language',
        supportsCompression: true,
        supportsEncryption: true,
        defaultCompression: 'gzip'
      },
      {
        type: 'parquet',
        description: 'Apache Parquet',
        supportsCompression: true,
        supportsEncryption: true,
        defaultCompression: 'zstd'
      }
    ];
    
    const compressionTypes = [
      { type: 'none', description: 'No compression' },
      { type: 'gzip', description: 'GZIP compression' },
      { type: 'brotli', description: 'Brotli compression' },
      { type: 'zstd', description: 'Zstandard compression' }
    ];
    
    return c.json({
      success: true,
      data: {
        formats: supportedFormats,
        compression: compressionTypes
      }
    });
  } catch (error) {
    console.error('Failed to get export formats:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Export statistics
app.get('/stats', async (c) => {
  try {
    const userId = c.req.query('userId');
    
    let userFilter = '';
    const params = [];
    
    if (userId) {
      userFilter = 'WHERE user_id = ?';
      params.push(userId);
    }
    
    const stats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_exports,
        SUM(size) as total_size,
        AVG(size) as avg_size,
        SUM(record_count) as total_records,
        SUM(file_count) as total_files,
        AVG(duration) as avg_duration,
        COUNT(CASE WHEN expires_at > ? THEN 1 END) as active_exports,
        COUNT(CASE WHEN expires_at <= ? THEN 1 END) as expired_exports
      FROM data_exports ${userFilter}
    `).bind(...[new Date().toISOString(), new Date().toISOString(), ...params]).all();
    
    const formatStats = await c.env.DB.prepare(`
      SELECT 
        JSON_EXTRACT(format, '$.type') as format_type,
        COUNT(*) as count,
        SUM(size) as total_size
      FROM data_exports ${userFilter}
      GROUP BY JSON_EXTRACT(format, '$.type')
    `).bind(...params).all();
    
    return c.json({
      success: true,
      data: {
        overall: stats.results[0],
        byFormat: formatStats.results,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to get export statistics:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Scheduled export cleanup (called by cron)
app.post('/scheduled-cleanup', async (c) => {
  try {
    console.log('Scheduled export cleanup job triggered');
    
    const dataExportService = new DataExportService(c.env);
    await dataExportService.cleanupExpiredExports();
    
    return c.json({
      success: true,
      message: 'Scheduled export cleanup completed'
    });
  } catch (error) {
    console.error('Scheduled export cleanup failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;