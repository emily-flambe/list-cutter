import { 
  ExportResult, 
  SystemExportResult, 
  ExportFormatResult, 
  SystemExportMetadata, 
  ExportFormat, 
  FileExportInfo, 
  UserExportData, 
  UserDatabaseRecords, 
  UserExportMetadata 
} from '../types/backup';
import { CloudflareEnv } from '../types/env';
import { CompressionService } from './compression-service';

export class DataExportService {
  private readonly env: CloudflareEnv;
  private readonly compressionService: CompressionService;

  constructor(env: CloudflareEnv) {
    this.env = env;
    this.compressionService = new CompressionService();
  }

  async exportUserData(userId: string, format: ExportFormat = { type: 'json', compression: 'gzip', encrypted: true }): Promise<ExportResult> {
    const exportId = this.generateExportId();
    const startTime = Date.now();
    
    try {
      console.log(`Starting user data export: ${exportId} for user: ${userId}`);
      
      // 1. Export user database records
      const userData = await this.exportUserDatabaseRecords(userId);
      
      // 2. Export user files
      const userFiles = await this.exportUserFiles(userId);
      
      // 3. Export user metadata
      const userMetadata = await this.exportUserMetadata(userId);
      
      // 4. Create export package
      const exportPackage: UserExportData = {
        userId,
        timestamp: new Date().toISOString(),
        data: userData,
        files: userFiles,
        metadata: userMetadata
      };
      
      // 5. Format and compress export
      const formattedData = await this.formatExportData(exportPackage, format);
      const compressedData = await this.compressExportData(formattedData, format);
      
      // 6. Encrypt if required
      const finalData = format.encrypted ? 
        await this.encryptExportData(compressedData) : 
        compressedData;
      
      // 7. Store export
      const exportKey = `exports/user-${userId}-${exportId}.${this.getFileExtension(format)}`;
      await this.env.FILE_STORAGE.put(exportKey, finalData);
      
      // 8. Generate secure download link
      const downloadUrl = await this.generateSecureDownloadLink(exportKey);
      
      const result: ExportResult = {
        exportId,
        userId,
        duration: Date.now() - startTime,
        size: finalData.length,
        recordCount: userData.tables ? Object.values(userData.tables).reduce((sum, records) => sum + records.length, 0) : 0,
        fileCount: userFiles.length,
        downloadUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        format
      };
      
      // 9. Record export in database
      await this.recordExport(result);
      
      console.log(`User data export completed: ${exportId}, Duration: ${result.duration}ms`);
      
      return result;
      
    } catch (error) {
      console.error('User data export failed:', error);
      throw error;
    }
  }

  async exportSystemData(formats: ExportFormat[] = [
    { type: 'json', compression: 'gzip', encrypted: true },
    { type: 'csv', compression: 'gzip', encrypted: false },
    { type: 'sql', compression: 'gzip', encrypted: true }
  ]): Promise<SystemExportResult> {
    const exportId = this.generateExportId();
    const startTime = Date.now();
    
    try {
      console.log(`Starting system data export: ${exportId}`);
      
      // 1. Export complete database
      const databaseExport = await this.exportCompleteDatabase();
      
      // 2. Export all files
      const filesExport = await this.exportAllFiles();
      
      // 3. Export system configuration
      const configExport = await this.exportSystemConfiguration();
      
      // 4. Create system export package
      const systemExport = {
        timestamp: new Date().toISOString(),
        database: databaseExport,
        files: filesExport,
        configuration: configExport
      };
      
      // 5. Create multiple export formats
      const exportFormats: ExportFormatResult[] = [];
      
      for (const format of formats) {
        const formattedData = await this.formatExportData(systemExport, format);
        const compressedData = await this.compressExportData(formattedData, format);
        const finalData = format.encrypted ? 
          await this.encryptExportData(compressedData) : 
          compressedData;
        
        const exportKey = `exports/system-${exportId}-${format.type}.${this.getFileExtension(format)}`;
        await this.env.FILE_STORAGE.put(exportKey, finalData);
        
        const downloadUrl = await this.generateSecureDownloadLink(exportKey);
        const checksum = await this.calculateChecksum(finalData);
        
        exportFormats.push({
          format,
          size: finalData.length,
          downloadUrl,
          checksum
        });
      }
      
      const result: SystemExportResult = {
        exportId,
        timestamp: new Date().toISOString(),
        formats: exportFormats,
        totalSize: exportFormats.reduce((sum, format) => sum + format.size, 0),
        metadata: {
          databaseTables: databaseExport.tableCount,
          totalRecords: databaseExport.totalRecords,
          fileCount: filesExport.fileCount,
          configurationItems: configExport.configurationItems
        }
      };
      
      // 6. Record system export
      await this.recordSystemExport(result);
      
      console.log(`System data export completed: ${exportId}, Duration: ${Date.now() - startTime}ms`);
      
      return result;
      
    } catch (error) {
      console.error('System data export failed:', error);
      throw error;
    }
  }

  async exportTableData(tableName: string, format: ExportFormat = { type: 'csv', compression: 'gzip', encrypted: false }): Promise<ExportResult> {
    const exportId = this.generateExportId();
    const startTime = Date.now();
    
    try {
      console.log(`Starting table data export: ${exportId} for table: ${tableName}`);
      
      // 1. Export table data
      const tableData = await this.exportTable(tableName);
      
      // 2. Format and compress export
      const formattedData = await this.formatExportData(tableData, format);
      const compressedData = await this.compressExportData(formattedData, format);
      
      // 3. Encrypt if required
      const finalData = format.encrypted ? 
        await this.encryptExportData(compressedData) : 
        compressedData;
      
      // 4. Store export
      const exportKey = `exports/table-${tableName}-${exportId}.${this.getFileExtension(format)}`;
      await this.env.FILE_STORAGE.put(exportKey, finalData);
      
      // 5. Generate secure download link
      const downloadUrl = await this.generateSecureDownloadLink(exportKey);
      
      const result: ExportResult = {
        exportId,
        userId: 'system',
        duration: Date.now() - startTime,
        size: finalData.length,
        recordCount: tableData.length,
        fileCount: 0,
        downloadUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        format
      };
      
      // 6. Record export in database
      await this.recordExport(result);
      
      console.log(`Table data export completed: ${exportId}, Duration: ${result.duration}ms`);
      
      return result;
      
    } catch (error) {
      console.error('Table data export failed:', error);
      throw error;
    }
  }

  async listExports(userId?: string): Promise<ExportResult[]> {
    try {
      let query = `
        SELECT * FROM data_exports 
        WHERE expires_at > ? 
      `;
      const params = [new Date().toISOString()];
      
      if (userId) {
        query += ` AND user_id = ?`;
        params.push(userId);
      }
      
      query += ` ORDER BY created_at DESC LIMIT 100`;
      
      const exports = await this.env.DB.prepare(query).bind(...params).all();
      
      return exports.results.map(exportRecord => ({
        exportId: String(exportRecord.export_id),
        userId: String(exportRecord.user_id),
        duration: Number(exportRecord.duration) || 0,
        size: Number(exportRecord.size) || 0,
        recordCount: Number(exportRecord.record_count) || 0,
        fileCount: Number(exportRecord.file_count) || 0,
        downloadUrl: String(exportRecord.download_url),
        expiresAt: new Date(String(exportRecord.expires_at)),
        format: JSON.parse(String(exportRecord.format) || '{}')
      }));
      
    } catch (error) {
      console.error('Failed to list exports:', error);
      throw error;
    }
  }

  async deleteExport(exportId: string): Promise<void> {
    try {
      console.log(`Deleting export: ${exportId}`);
      
      // 1. Get export record
      const exportRecord = await this.env.DB.prepare(`
        SELECT * FROM data_exports WHERE export_id = ?
      `).bind(exportId).all();
      
      if (exportRecord.results.length === 0) {
        throw new Error(`Export not found: ${exportId}`);
      }
      
      // 2. Delete export file from storage
      const exportKey = this.extractKeyFromUrl(String(exportRecord.results[0].download_url));
      await this.env.FILE_STORAGE.delete(exportKey);
      
      // 3. Delete export record from database
      await this.env.DB.prepare(`
        DELETE FROM data_exports WHERE export_id = ?
      `).bind(exportId).run();
      
      console.log(`Export deleted: ${exportId}`);
      
    } catch (error) {
      console.error('Failed to delete export:', error);
      throw error;
    }
  }

  async cleanupExpiredExports(): Promise<void> {
    try {
      console.log('Starting export cleanup');
      
      // 1. Get expired exports
      const expiredExports = await this.env.DB.prepare(`
        SELECT * FROM data_exports 
        WHERE expires_at < ?
      `).bind(new Date().toISOString()).all();
      
      // 2. Delete expired exports
      for (const exportRecord of expiredExports.results) {
        try {
          const exportKey = this.extractKeyFromUrl(String(exportRecord.download_url));
          await this.env.FILE_STORAGE.delete(exportKey);
        } catch (error) {
          console.error(`Failed to delete expired export file: ${exportRecord.export_id}`, error);
        }
      }
      
      // 3. Delete expired export records
      await this.env.DB.prepare(`
        DELETE FROM data_exports WHERE expires_at < ?
      `).bind(new Date().toISOString()).run();
      
      console.log(`Export cleanup completed: ${expiredExports.results.length} expired exports deleted`);
      
    } catch (error) {
      console.error('Failed to cleanup expired exports:', error);
      throw error;
    }
  }

  // Private methods
  private async exportUserDatabaseRecords(userId: string): Promise<UserDatabaseRecords> {
    const tables = ['files', 'saved_filters', 'api_keys', 'user_quotas', 'file_access_logs'];
    const exportData: UserDatabaseRecords = { tables: {} };
    
    for (const table of tables) {
      try {
        const records = await this.env.DB.prepare(`
          SELECT * FROM ${table} WHERE user_id = ?
        `).bind(userId).all();
        
        exportData.tables[table] = records.results;
      } catch (error) {
        console.error(`Failed to export table ${table} for user ${userId}:`, error);
        exportData.tables[table] = [];
      }
    }
    
    return exportData;
  }

  private async exportUserFiles(userId: string): Promise<FileExportInfo[]> {
    try {
      // Get user's files from database
      const userFiles = await this.env.DB.prepare(`
        SELECT * FROM files WHERE user_id = ?
      `).bind(userId).all();
      
      const exportInfo: FileExportInfo[] = [];
      
      for (const file of userFiles.results) {
        try {
          const fileObject = await this.env.FILE_STORAGE.get(String(file.r2_key));
          
          if (fileObject) {
            const content = await fileObject.arrayBuffer();
            const checksum = await this.calculateChecksum(new Uint8Array(content));
            
            exportInfo.push({
              filename: String(file.filename),
              r2_key: String(file.r2_key),
              size: Number(file.file_size) || 0,
              mime_type: String(file.mime_type),
              created_at: String(file.created_at),
              content,
              checksum
            });
          }
        } catch (error) {
          console.error(`Failed to export file ${file.filename}:`, error);
        }
      }
      
      return exportInfo;
      
    } catch (error) {
      console.error('Failed to export user files:', error);
      return [];
    }
  }

  private async exportUserMetadata(userId: string): Promise<UserExportMetadata> {
    try {
      // Get user statistics
      const fileStats = await this.env.DB.prepare(`
        SELECT COUNT(*) as count, SUM(file_size) as total_size
        FROM files WHERE user_id = ?
      `).bind(userId).all();
      
      const recordStats = await this.env.DB.prepare(`
        SELECT 
          (SELECT COUNT(*) FROM saved_filters WHERE user_id = ?) as saved_filters,
          (SELECT COUNT(*) FROM api_keys WHERE user_id = ?) as api_keys,
          (SELECT COUNT(*) FROM file_access_logs WHERE user_id = ?) as access_logs
      `).bind(userId, userId, userId).all();
      
      const fileCount = Number(fileStats.results[0]?.count) || 0;
      const totalSize = Number(fileStats.results[0]?.total_size) || 0;
      const totalRecords = Object.values(recordStats.results[0] || {}).reduce((sum, count) => sum + Number(count), 0);
      
      return {
        totalRecords,
        totalFiles: fileCount,
        totalSize,
        exportReason: 'user_request',
        requestedBy: userId
      };
      
    } catch (error) {
      console.error('Failed to export user metadata:', error);
      return {
        totalRecords: 0,
        totalFiles: 0,
        totalSize: 0,
        exportReason: 'user_request',
        requestedBy: userId
      };
    }
  }

  private async exportCompleteDatabase(): Promise<{
    tableCount: number;
    totalRecords: number;
    tables: Array<{ name: string; recordCount: number; data: unknown[] }>;
  }> {
    try {
      // Get all tables
      const tables = await this.env.DB.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%' 
        ORDER BY name
      `).all();
      
      const exportedTables = [];
      let totalRecords = 0;
      
      for (const table of tables.results) {
        const tableName = String(table.name);
        const tableData = await this.exportTable(tableName);
        
        exportedTables.push({
          name: tableName,
          recordCount: tableData.length,
          data: tableData
        });
        
        totalRecords += tableData.length;
      }
      
      return {
        tableCount: exportedTables.length,
        totalRecords,
        tables: exportedTables
      };
      
    } catch (error) {
      console.error('Failed to export complete database:', error);
      return {
        tableCount: 0,
        totalRecords: 0,
        tables: []
      };
    }
  }

  private async exportAllFiles(): Promise<{
    fileCount: number;
    totalSize: number;
    files: Array<{ key: string; size: number; metadata: unknown }>;
  }> {
    try {
      // Get all files from database
      const files = await this.env.DB.prepare(`
        SELECT r2_key, file_size, filename, mime_type, created_at
        FROM files 
        WHERE r2_key IS NOT NULL
      `).all();
      
      const exportedFiles = [];
      let totalSize = 0;
      
      for (const file of files.results) {
        const fileSize = Number(file.file_size) || 0;
        
        exportedFiles.push({
          key: String(file.r2_key),
          size: fileSize,
          metadata: {
            filename: String(file.filename),
            mime_type: String(file.mime_type),
            created_at: String(file.created_at)
          }
        });
        
        totalSize += fileSize;
      }
      
      return {
        fileCount: exportedFiles.length,
        totalSize,
        files: exportedFiles
      };
      
    } catch (error) {
      console.error('Failed to export all files:', error);
      return {
        fileCount: 0,
        totalSize: 0,
        files: []
      };
    }
  }

  private async exportSystemConfiguration(): Promise<{
    configurationItems: number;
    configuration: Record<string, unknown>;
  }> {
    try {
      // Get system configuration
      const config = await this.env.DB.prepare(`
        SELECT key, value FROM system_configuration
      `).all();
      
      const configuration: Record<string, unknown> = {};
      
      for (const item of config.results) {
        configuration[String(item.key)] = String(item.value);
      }
      
      // Add environment information (non-sensitive only)
      configuration.environment = {
        ENVIRONMENT: this.env.ENVIRONMENT,
        API_VERSION: this.env.API_VERSION,
        CORS_ORIGIN: this.env.CORS_ORIGIN
      };
      
      return {
        configurationItems: Object.keys(configuration).length,
        configuration
      };
      
    } catch (error) {
      console.error('Failed to export system configuration:', error);
      return {
        configurationItems: 0,
        configuration: {}
      };
    }
  }

  private async exportTable(tableName: string): Promise<unknown[]> {
    try {
      const result = await this.env.DB.prepare(`SELECT * FROM ${tableName}`).all();
      return result.results;
    } catch (error) {
      console.error(`Failed to export table ${tableName}:`, error);
      return [];
    }
  }

  private async formatExportData(data: unknown, format: ExportFormat): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    
    switch (format.type) {
      case 'json':
        return encoder.encode(JSON.stringify(data, null, 2));
      
      case 'csv':
        if (Array.isArray(data)) {
          return encoder.encode(this.convertToCSV(data));
        }
        return encoder.encode(JSON.stringify(data));
      
      case 'sql':
        if (Array.isArray(data)) {
          return encoder.encode(this.convertToSQL(data));
        }
        return encoder.encode(JSON.stringify(data));
      
      default:
        return encoder.encode(JSON.stringify(data));
    }
  }

  private convertToCSV(data: unknown[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0] as Record<string, unknown>);
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = (row as Record<string, unknown>)[header];
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  private convertToSQL(data: unknown[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0] as Record<string, unknown>);
    const tableName = 'exported_data';
    
    const createTable = `CREATE TABLE ${tableName} (${headers.map(h => `${h} TEXT`).join(', ')});`;
    
    const insertStatements = data.map(row => {
      const values = headers.map(header => {
        const value = (row as Record<string, unknown>)[header];
        return `'${String(value).replace(/'/g, "''")}'`;
      });
      return `INSERT INTO ${tableName} (${headers.join(', ')}) VALUES (${values.join(', ')});`;
    });
    
    return [createTable, ...insertStatements].join('\n');
  }

  private async compressExportData(data: Uint8Array, format: ExportFormat): Promise<Uint8Array> {
    if (format.compression === 'none') {
      return data;
    }
    
    try {
      const compressionResult = await this.compressionService.compressFile(
        data.buffer,
        { contentType: 'application/octet-stream' }
      );
      
      if (compressionResult.success && compressionResult.data) {
        console.log(`Export data compressed: ${compressionResult.algorithm}, ratio: ${compressionResult.compressionRatio}`);
        return new Uint8Array(compressionResult.data);
      } else {
        console.warn('Compression failed or not beneficial, using original data');
        return data;
      }
    } catch (error) {
      console.error('Compression failed:', error);
      return data;
    }
  }

  private async encryptExportData(data: Uint8Array): Promise<Uint8Array> {
    try {
      // Generate encryption key using Web Crypto API
      const key = await crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt', 'decrypt']
      );
      
      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt the data
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        data
      );
      
      // Export the key for storage
      const exportedKey = await crypto.subtle.exportKey('raw', key);
      
      // Combine IV + encrypted data
      const result = new Uint8Array(iv.length + encryptedData.byteLength);
      result.set(iv);
      result.set(new Uint8Array(encryptedData), iv.length);
      
      // Store encryption key securely (in production, use proper key management)
      await this.storeExportEncryptionKey(exportedKey);
      
      console.log('Export data encrypted with AES-256-GCM');
      return result;
    } catch (error) {
      console.error('Encryption failed, using unencrypted data:', error);
      return data;
    }
  }

  private async storeExportEncryptionKey(key: ArrayBuffer): Promise<void> {
    try {
      // Store encryption key securely
      const keyId = `export-key-${Date.now()}`;
      const keyData = new Uint8Array(key);
      
      // Store key in file storage (in production, use dedicated key management)
      await this.env.FILE_STORAGE.put(`export-keys/${keyId}`, keyData);
      
      console.log(`Export encryption key stored: ${keyId}`);
    } catch (error) {
      console.error('Failed to store export encryption key:', error);
    }
  }

  private getFileExtension(format: ExportFormat): string {
    const extensions = {
      'json': 'json',
      'csv': 'csv',
      'sql': 'sql',
      'xml': 'xml',
      'parquet': 'parquet'
    };
    
    let extension = extensions[format.type] || 'txt';
    
    if (format.compression !== 'none') {
      extension += `.${format.compression}`;
    }
    
    if (format.encrypted) {
      extension += '.enc';
    }
    
    return extension;
  }

  private async generateSecureDownloadLink(exportKey: string): Promise<string> {
    // In production, generate signed URL with expiration
    return `https://cutty.emilycogsdill.com/api/exports/download/${exportKey}`;
  }

  private extractKeyFromUrl(url: string): string {
    // Extract key from download URL
    const parts = url.split('/');
    return parts[parts.length - 1];
  }

  private async calculateChecksum(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private generateExportId(): string {
    return `export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async recordExport(result: ExportResult): Promise<void> {
    try {
      await this.env.DB.prepare(`
        INSERT INTO data_exports (
          export_id, user_id, duration, size, record_count, file_count,
          download_url, expires_at, format, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        result.exportId,
        result.userId,
        result.duration,
        result.size,
        result.recordCount,
        result.fileCount,
        result.downloadUrl,
        result.expiresAt.toISOString(),
        JSON.stringify(result.format),
        new Date().toISOString()
      ).run();
    } catch (error) {
      console.error('Failed to record export:', error);
    }
  }

  private async recordSystemExport(result: SystemExportResult): Promise<void> {
    try {
      await this.env.DB.prepare(`
        INSERT INTO system_exports (
          export_id, formats, total_size, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        result.exportId,
        JSON.stringify(result.formats),
        result.totalSize,
        JSON.stringify(result.metadata),
        new Date().toISOString()
      ).run();
    } catch (error) {
      console.error('Failed to record system export:', error);
    }
  }
}