import { 
  BackupManifest, 
  VerificationResult, 
  ComponentVerification, 
  DatabaseBackupResult, 
  FileBackupResult, 
  ConfigBackupResult 
} from '../types/backup';
import { CloudflareEnv } from '../types/env';

export class BackupVerificationService {
  private readonly env: CloudflareEnv;

  constructor(env: CloudflareEnv) {
    this.env = env;
  }

  async verifyBackupIntegrity(manifest: BackupManifest): Promise<VerificationResult> {
    if (!this.env.BACKUP_STORAGE) {
      throw new Error('Backup storage not configured - cannot verify backup integrity');
    }
    
    console.log(`Starting backup integrity verification for: ${manifest.backupId}`);
    
    const verificationResults: VerificationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      details: {
        database: null,
        files: null,
        config: null
      }
    };
    
    try {
      // 1. Verify database backup
      const dbVerification = await this.verifyDatabaseBackup(manifest.database);
      verificationResults.details.database = dbVerification;
      
      if (!dbVerification.isValid) {
        verificationResults.isValid = false;
        verificationResults.errors.push(...dbVerification.errors);
      }
      
      if (dbVerification.warnings) {
        verificationResults.warnings.push(...dbVerification.warnings);
      }
      
      // 2. Verify file backup
      const fileVerification = await this.verifyFileBackup(manifest.files);
      verificationResults.details.files = fileVerification;
      
      if (!fileVerification.isValid) {
        verificationResults.isValid = false;
        verificationResults.errors.push(...fileVerification.errors);
      }
      
      if (fileVerification.warnings) {
        verificationResults.warnings.push(...fileVerification.warnings);
      }
      
      // 3. Verify configuration backup
      const configVerification = await this.verifyConfigBackup(manifest.config);
      verificationResults.details.config = configVerification;
      
      if (!configVerification.isValid) {
        verificationResults.isValid = false;
        verificationResults.errors.push(...configVerification.errors);
      }
      
      if (configVerification.warnings) {
        verificationResults.warnings.push(...configVerification.warnings);
      }
      
      // 4. Verify backup manifest integrity
      const manifestVerification = await this.verifyManifestIntegrity(manifest);
      if (!manifestVerification.isValid) {
        verificationResults.isValid = false;
        verificationResults.errors.push(...manifestVerification.errors);
      }
      
      console.log(`Backup verification completed: ${manifest.backupId}, Valid: ${verificationResults.isValid}`);
      
      return verificationResults;
      
    } catch (error) {
      console.error('Backup verification failed:', error);
      verificationResults.isValid = false;
      verificationResults.errors.push(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return verificationResults;
    }
  }

  private async verifyDatabaseBackup(dbBackup: DatabaseBackupResult): Promise<ComponentVerification> {
    console.log(`Verifying database backup: ${dbBackup.backupKey}`);
    
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // 1. Verify backup file exists
      const backupObject = await this.env.BACKUP_STORAGE.get(dbBackup.backupKey);
      if (!backupObject) {
        return {
          isValid: false,
          errors: ['Database backup file not found'],
          warnings
        };
      }
      
      // 2. Verify file size matches expected size
      if (backupObject.size !== dbBackup.size) {
        errors.push(`Database backup size mismatch: expected ${dbBackup.size}, got ${backupObject.size}`);
      }
      
      // 3. Verify checksum
      const backupData = await backupObject.arrayBuffer();
      const actualChecksum = await this.calculateChecksum(new Uint8Array(backupData));
      if (actualChecksum !== dbBackup.checksum) {
        errors.push('Database backup checksum mismatch - data may be corrupted');
      }
      
      // 4. Verify backup can be decrypted and decompressed
      try {
        const decryptedData = await this.decryptBackup(new Uint8Array(backupData));
        const decompressedData = await this.decompressBackup(decryptedData);
        const backupContent = JSON.parse(new TextDecoder().decode(decompressedData));
        
        if (!backupContent.tables || !Array.isArray(backupContent.tables)) {
          errors.push('Invalid database backup format - missing tables array');
        }
        
        // 5. Verify table checksums
        let totalRows = 0;
        for (const table of dbBackup.tables) {
          const tableFound = backupContent.tables.find((t: any) => t.name === table.name);
          if (!tableFound) {
            warnings.push(`Table ${table.name} not found in backup content`);
            continue;
          }
          
          if (tableFound.rowCount !== table.rowCount) {
            errors.push(`Table ${table.name} row count mismatch: expected ${table.rowCount}, got ${tableFound.rowCount}`);
          }
          
          totalRows += table.rowCount;
        }
        
        // 6. Verify total item count
        if (totalRows !== dbBackup.itemCount) {
          warnings.push(`Total item count mismatch: expected ${dbBackup.itemCount}, calculated ${totalRows}`);
        }
        
        return {
          isValid: errors.length === 0,
          errors,
          warnings,
          metadata: {
            tableCount: backupContent.tables.length,
            totalRows,
            backupSize: backupObject.size,
            compressionRatio: backupContent.compressionRatio || 0
          }
        };
        
      } catch (decryptError) {
        errors.push(`Database backup decryption/decompression failed: ${decryptError instanceof Error ? decryptError.message : 'Unknown error'}`);
        return {
          isValid: false,
          errors,
          warnings
        };
      }
      
    } catch (error) {
      console.error('Database backup verification failed:', error);
      return {
        isValid: false,
        errors: [`Database backup verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings
      };
    }
  }

  private async verifyFileBackup(fileBackup: FileBackupResult): Promise<ComponentVerification> {
    console.log(`Verifying file backup: ${fileBackup.manifestKey}`);
    
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // 1. Verify manifest exists
      const manifestObject = await this.env.BACKUP_STORAGE.get(fileBackup.manifestKey);
      if (!manifestObject) {
        return {
          isValid: false,
          errors: ['File backup manifest not found'],
          warnings
        };
      }
      
      // 2. Parse manifest
      const manifest = JSON.parse(await manifestObject.text());
      
      if (!manifest.files || !Array.isArray(manifest.files)) {
        errors.push('Invalid file backup manifest format');
        return {
          isValid: false,
          errors,
          warnings
        };
      }
      
      // 3. Verify manifest file count matches backup result
      if (manifest.files.length !== fileBackup.fileCount) {
        warnings.push(`File count mismatch: manifest ${manifest.files.length}, backup result ${fileBackup.fileCount}`);
      }
      
      // 4. Verify random sample of files
      const sampleSize = Math.min(10, manifest.files.length);
      const sampleFiles = this.getRandomSample(manifest.files, sampleSize);
      
      let sampledFiles = 0;
      let sampledSize = 0;
      
      for (const file of sampleFiles) {
        const backupKey = `file-backups/${file.key}`;
        const backupObject = await this.env.BACKUP_STORAGE.get(backupKey);
        
        if (!backupObject) {
          errors.push(`File backup not found: ${file.key}`);
          continue;
        }
        
        if (backupObject.size !== file.size) {
          errors.push(`File size mismatch for ${file.key}: expected ${file.size}, got ${backupObject.size}`);
          continue;
        }
        
        // Verify checksum for sample files
        if (file.checksum) {
          const fileData = await backupObject.arrayBuffer();
          const actualChecksum = await this.calculateChecksum(new Uint8Array(fileData));
          if (actualChecksum !== file.checksum) {
            errors.push(`File checksum mismatch for ${file.key}`);
            continue;
          }
        }
        
        sampledFiles++;
        sampledSize += backupObject.size;
      }
      
      // 5. Verify total size estimate
      const estimatedTotalSize = (sampledSize / sampledFiles) * manifest.files.length;
      const sizeDifference = Math.abs(estimatedTotalSize - fileBackup.totalSize);
      const sizeTolerancePercent = 0.05; // 5% tolerance
      
      if (sizeDifference > fileBackup.totalSize * sizeTolerancePercent) {
        warnings.push(`Total size estimate differs significantly from backup result`);
      }
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata: {
          manifestFileCount: manifest.files.length,
          backupResultFileCount: fileBackup.fileCount,
          sampleVerified: sampledFiles,
          sampleErrors: sampleSize - sampledFiles,
          estimatedTotalSize,
          actualTotalSize: fileBackup.totalSize
        }
      };
      
    } catch (error) {
      console.error('File backup verification failed:', error);
      return {
        isValid: false,
        errors: [`File backup verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings
      };
    }
  }

  private async verifyConfigBackup(configBackup: ConfigBackupResult): Promise<ComponentVerification> {
    console.log(`Verifying configuration backup: ${configBackup.configKey}`);
    
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // 1. Verify backup file exists
      const backupObject = await this.env.BACKUP_STORAGE.get(configBackup.configKey);
      if (!backupObject) {
        return {
          isValid: false,
          errors: ['Configuration backup file not found'],
          warnings
        };
      }
      
      // 2. Verify file size matches expected size
      if (backupObject.size !== configBackup.size) {
        errors.push(`Configuration backup size mismatch: expected ${configBackup.size}, got ${backupObject.size}`);
      }
      
      // 3. Verify checksum
      const backupData = await backupObject.arrayBuffer();
      const actualChecksum = await this.calculateChecksum(new Uint8Array(backupData));
      if (actualChecksum !== configBackup.checksum) {
        errors.push('Configuration backup checksum mismatch');
      }
      
      // 4. Verify backup can be decrypted and decompressed
      try {
        const decryptedData = await this.decryptBackup(new Uint8Array(backupData));
        const decompressedData = await this.decompressBackup(decryptedData);
        const configContent = JSON.parse(new TextDecoder().decode(decompressedData));
        
        // 5. Verify configuration structure
        if (!configContent.settings) {
          errors.push('Invalid configuration backup format - missing settings');
        }
        
        const requiredSections = ['environment', 'bindings', 'secrets', 'crons'];
        for (const section of requiredSections) {
          if (!configContent.settings[section]) {
            warnings.push(`Configuration section missing: ${section}`);
          }
        }
        
        // 6. Verify critical environment variables
        const criticalEnvVars = ['ENVIRONMENT', 'API_VERSION', 'CORS_ORIGIN'];
        for (const envVar of criticalEnvVars) {
          if (!configContent.settings.environment[envVar]) {
            warnings.push(`Critical environment variable missing: ${envVar}`);
          }
        }
        
        // 7. Verify secrets are listed (but not values)
        const expectedSecrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DB_ENCRYPTION_KEY'];
        for (const secret of expectedSecrets) {
          if (!configContent.settings.secrets.includes(secret)) {
            warnings.push(`Expected secret not listed: ${secret}`);
          }
        }
        
        return {
          isValid: errors.length === 0,
          errors,
          warnings,
          metadata: {
            environmentVars: Object.keys(configContent.settings.environment || {}).length,
            bindings: Object.keys(configContent.settings.bindings || {}).length,
            secrets: (configContent.settings.secrets || []).length,
            crons: (configContent.settings.crons || []).length,
            backupSize: backupObject.size
          }
        };
        
      } catch (decryptError) {
        errors.push(`Configuration backup decryption/decompression failed: ${decryptError instanceof Error ? decryptError.message : 'Unknown error'}`);
        return {
          isValid: false,
          errors,
          warnings
        };
      }
      
    } catch (error) {
      console.error('Configuration backup verification failed:', error);
      return {
        isValid: false,
        errors: [`Configuration backup verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings
      };
    }
  }

  private async verifyManifestIntegrity(manifest: BackupManifest): Promise<ComponentVerification> {
    console.log(`Verifying manifest integrity: ${manifest.backupId}`);
    
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // 1. Verify required fields
      const requiredFields = ['backupId', 'timestamp', 'type', 'database', 'files', 'config', 'metadata'];
      for (const field of requiredFields) {
        if (!manifest[field as keyof BackupManifest]) {
          errors.push(`Required manifest field missing: ${field}`);
        }
      }
      
      // 2. Verify timestamp is valid
      const timestamp = new Date(manifest.timestamp);
      if (isNaN(timestamp.getTime())) {
        errors.push('Invalid timestamp in manifest');
      }
      
      // 3. Verify backup type is valid
      if (!['full', 'incremental', 'differential'].includes(manifest.type)) {
        errors.push(`Invalid backup type: ${manifest.type}`);
      }
      
      // 4. Verify metadata consistency
      if (manifest.metadata.timestamp !== manifest.timestamp) {
        warnings.push('Timestamp mismatch between manifest and metadata');
      }
      
      // 5. Verify backup components are present
      if (!manifest.database.backupKey) {
        errors.push('Database backup key missing in manifest');
      }
      
      if (!manifest.files.manifestKey) {
        errors.push('File manifest key missing in manifest');
      }
      
      if (!manifest.config.configKey) {
        errors.push('Configuration backup key missing in manifest');
      }
      
      // 6. Verify checksums are present
      if (!manifest.database.checksum) {
        warnings.push('Database backup checksum missing');
      }
      
      if (!manifest.config.checksum) {
        warnings.push('Configuration backup checksum missing');
      }
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata: {
          backupAge: Date.now() - timestamp.getTime(),
          databaseSize: manifest.database.size,
          fileCount: manifest.files.fileCount,
          configSize: manifest.config.size,
          totalSize: manifest.database.size + manifest.files.totalSize + manifest.config.size
        }
      };
      
    } catch (error) {
      console.error('Manifest integrity verification failed:', error);
      return {
        isValid: false,
        errors: [`Manifest integrity verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings
      };
    }
  }

  // Testing and validation methods
  async performBackupTest(): Promise<ComponentVerification> {
    console.log('Performing backup system test');
    
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // 1. Test backup storage accessibility
      const testKey = `test-backup-${Date.now()}.txt`;
      const testData = 'Backup system test data';
      
      await this.env.BACKUP_STORAGE.put(testKey, testData);
      const retrievedData = await this.env.BACKUP_STORAGE.get(testKey);
      
      if (!retrievedData) {
        errors.push('Backup storage write/read test failed');
      } else {
        const retrievedText = await retrievedData.text();
        if (retrievedText !== testData) {
          errors.push('Backup storage data integrity test failed');
        }
      }
      
      // Clean up test data
      await this.env.BACKUP_STORAGE.delete(testKey);
      
      // 2. Test backup database accessibility
      try {
        await this.env.BACKUP_DATABASE.prepare('SELECT 1 as test').all();
      } catch (dbError) {
        errors.push(`Backup database connectivity test failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
      }
      
      // 3. Test encryption/decryption
      try {
        const testEncryptData = new TextEncoder().encode('encryption test');
        const encrypted = await this.encryptBackup(testEncryptData);
        const decrypted = await this.decryptBackup(encrypted);
        
        if (new TextDecoder().decode(decrypted) !== 'encryption test') {
          errors.push('Encryption/decryption test failed');
        }
      } catch (encryptError) {
        errors.push(`Encryption test failed: ${encryptError instanceof Error ? encryptError.message : 'Unknown error'}`);
      }
      
      // 4. Test compression/decompression
      try {
        const testCompressData = new TextEncoder().encode('compression test data');
        const compressed = await this.compressBackup(testCompressData);
        const decompressed = await this.decompressBackup(compressed);
        
        if (new TextDecoder().decode(decompressed) !== 'compression test data') {
          errors.push('Compression/decompression test failed');
        }
      } catch (compressError) {
        errors.push(`Compression test failed: ${compressError instanceof Error ? compressError.message : 'Unknown error'}`);
      }
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata: {
          testsRun: 4,
          testsPassed: 4 - errors.length,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('Backup system test failed:', error);
      return {
        isValid: false,
        errors: [`Backup system test failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings,
        metadata: {
          testsRun: 4,
          testsPassed: 0,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // Helper methods
  private getRandomSample<T>(array: T[], sampleSize: number): T[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, sampleSize);
  }

  private async calculateChecksum(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async encryptBackup(data: Uint8Array): Promise<Uint8Array> {
    // Placeholder for encryption - in production use proper encryption
    return data;
  }

  private async decryptBackup(data: Uint8Array): Promise<Uint8Array> {
    // Placeholder for decryption - in production use proper decryption
    return data;
  }

  private async compressBackup(data: Uint8Array): Promise<Uint8Array> {
    // Placeholder for compression - in production use proper compression
    return data;
  }

  private async decompressBackup(data: Uint8Array): Promise<Uint8Array> {
    // Placeholder for decompression - in production use proper decompression
    return data;
  }
}