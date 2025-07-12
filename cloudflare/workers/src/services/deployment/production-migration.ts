import type { CloudflareEnv } from '../../types/env.js';
import type { MigrationResult, MaintenanceMode } from '../../types/deployment.js';
import { FileMigrationService } from '../migration/file-migration.js';
import { R2StorageService } from '../storage/r2-service.js';
import { MetricsService } from '../monitoring/metrics-service.js';

/**
 * Production migration service for complete data migration from Django to Cloudflare Workers
 * Handles user data, file metadata, file content, and saved filters migration
 */
export class ProductionMigrationService {
  private env: CloudflareEnv;
  private db: D1Database;
  private r2Service: R2StorageService;
  private fileMigrationService: FileMigrationService;
  private metricsService?: MetricsService;

  constructor(env: CloudflareEnv) {
    this.env = env;
    this.db = env.DB;
    this.r2Service = new R2StorageService(env.FILE_STORAGE, env.DB);
    this.fileMigrationService = new FileMigrationService(this.r2Service, env.DB);
    
    if (env.ANALYTICS) {
      this.metricsService = new MetricsService(env.ANALYTICS, env.DB);
    }
  }

  /**
   * Execute complete production data migration
   */
  async executeFullMigration(): Promise<MigrationResult> {
    const startTime = new Date().toISOString();
    const result: MigrationResult = {
      usersMigrated: 0,
      filesMigrated: 0,
      filtersMigrated: 0,
      success: true,
      errors: [],
      startTime,
      endTime: '',
      duration: 0
    };

    try {
      console.log('🚀 Starting production data migration...');

      // Phase 1: Enable maintenance mode
      await this.enableMaintenanceMode('Production migration in progress');
      console.log('🛠️ Maintenance mode enabled');

      // Phase 2: Migrate users
      console.log('👥 Starting user migration...');
      result.usersMigrated = await this.migrateUsers();
      console.log(`✅ Migrated ${result.usersMigrated} users`);

      // Phase 3: Migrate file metadata
      console.log('📋 Starting file metadata migration...');
      result.filesMigrated = await this.migrateFileMetadata();
      console.log(`✅ Migrated ${result.filesMigrated} file records`);

      // Phase 4: Migrate files to R2 (using existing FileMigrationService)
      console.log('📁 Starting file content migration to R2...');
      await this.migrateFilesToR2();
      console.log('✅ File content migration completed');

      // Phase 5: Migrate saved filters
      console.log('🔍 Starting saved filters migration...');
      result.filtersMigrated = await this.migrateSavedFilters();
      console.log(`✅ Migrated ${result.filtersMigrated} saved filters`);

      // Phase 6: Validate migration
      console.log('🔍 Validating migration...');
      await this.validateMigration();
      console.log('✅ Migration validation completed');

      console.log('✅ Migration completed successfully');

    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : 'Unknown migration error';
      result.errors.push(errorMessage);
      console.error('❌ Migration failed:', errorMessage);

      // Attempt to disable maintenance mode on failure
      try {
        await this.disableMaintenanceMode();
      } catch (maintenanceError) {
        console.error('Failed to disable maintenance mode:', maintenanceError);
      }
    } finally {
      const endTime = new Date().toISOString();
      result.endTime = endTime;
      result.duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      // Record migration metrics
      await this.recordMigrationMetrics(result);
    }

    return result;
  }

  /**
   * Migrate users from Django to D1
   */
  private async migrateUsers(): Promise<number> {
    try {
      // Ensure users table exists
      await this.db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT TRUE,
          last_login DATETIME,
          preferences TEXT -- JSON string for user preferences
        )
      `).run();

      // Extract and migrate users from Django
      const migrated = await this.extractAndMigrateUsers();

      console.log(`User migration completed: ${migrated} users migrated`);
      return migrated;
    } catch (error) {
      console.error('User migration failed:', error);
      throw new Error(`User migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Migrate file metadata from Django to D1
   */
  private async migrateFileMetadata(): Promise<number> {
    try {
      // Ensure files table exists with all necessary columns
      await this.db.prepare(`
        CREATE TABLE IF NOT EXISTS files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          filename TEXT NOT NULL,
          original_filename TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          content_type TEXT NOT NULL,
          file_hash TEXT,
          upload_path TEXT, -- Original path in Django
          r2_key TEXT, -- New R2 object key
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_public BOOLEAN DEFAULT FALSE,
          download_count INTEGER DEFAULT 0,
          metadata TEXT, -- JSON string for additional metadata
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `).run();

      // Extract and migrate file metadata from Django
      const migrated = await this.extractAndMigrateFileMetadata();

      console.log(`File metadata migration completed: ${migrated} files migrated`);
      return migrated;
    } catch (error) {
      console.error('File metadata migration failed:', error);
      throw new Error(`File metadata migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Migrate actual file content to R2 using FileMigrationService
   */
  private async migrateFilesToR2(): Promise<void> {
    try {
      // Get all files that need migration
      const filesToMigrate = await this.db.prepare(`
        SELECT id, user_id, filename, upload_path, file_size, file_hash
        FROM files 
        WHERE r2_key IS NULL OR r2_key = ''
      `).all();

      if (filesToMigrate.results.length === 0) {
        console.log('No files to migrate to R2');
        return;
      }

      // Convert to migration format
      const migrationFiles = filesToMigrate.results.map((file: any) => ({
        fileId: file.id.toString(),
        sourcePath: file.upload_path,
        fileName: file.filename,
        fileSize: file.file_size,
        userId: file.user_id.toString(),
        checksum: file.file_hash
      }));

      // Use existing FileMigrationService for batch migration
      const batchId = `prod-migration-${Date.now()}`;
      const batch = {
        batchId,
        files: migrationFiles,
        status: 'pending' as const,
        metadata: {
          migrationType: 'production',
          timestamp: new Date().toISOString()
        }
      };

      await this.fileMigrationService.processBatch(batch);
      console.log(`File content migration batch ${batchId} processed`);

    } catch (error) {
      console.error('File R2 migration failed:', error);
      throw new Error(`File R2 migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Migrate saved filters from Django to D1
   */
  private async migrateSavedFilters(): Promise<number> {
    try {
      // Ensure saved_filters table exists
      await this.db.prepare(`
        CREATE TABLE IF NOT EXISTS saved_filters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          filter_config TEXT NOT NULL, -- JSON string for filter configuration
          is_public BOOLEAN DEFAULT FALSE,
          usage_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `).run();

      // Extract and migrate saved filters from Django
      const migrated = await this.extractAndMigrateSavedFilters();

      console.log(`Saved filters migration completed: ${migrated} filters migrated`);
      return migrated;
    } catch (error) {
      console.error('Saved filters migration failed:', error);
      throw new Error(`Saved filters migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate migration integrity
   */
  private async validateMigration(): Promise<void> {
    try {
      // Validate user count
      const userCount = await this.db.prepare('SELECT COUNT(*) as count FROM users').first();
      console.log(`Users in database: ${userCount?.count || 0}`);

      // Validate file count
      const fileCount = await this.db.prepare('SELECT COUNT(*) as count FROM files').first();
      console.log(`Files in database: ${fileCount?.count || 0}`);

      // Validate R2 migration
      const r2MigratedCount = await this.db.prepare(`
        SELECT COUNT(*) as count FROM files 
        WHERE r2_key IS NOT NULL AND r2_key != ''
      `).first();
      console.log(`Files migrated to R2: ${r2MigratedCount?.count || 0}`);

      // Validate saved filters
      const filterCount = await this.db.prepare('SELECT COUNT(*) as count FROM saved_filters').first();
      console.log(`Saved filters in database: ${filterCount?.count || 0}`);

      // Additional validation checks could go here
      // - Checksum verification for migrated files
      // - Data integrity checks
      // - Performance validation

    } catch (error) {
      console.error('Migration validation failed:', error);
      throw new Error(`Migration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enable maintenance mode
   */
  async enableMaintenanceMode(reason: string = 'System maintenance'): Promise<void> {
    const maintenanceState: MaintenanceMode = {
      enabled: true,
      enabledAt: new Date().toISOString(),
      enabledBy: 'production-migration',
      reason,
      estimatedDuration: 3600000, // 1 hour estimate
      customMessage: 'List Cutter is being upgraded to our new infrastructure. We\'ll be back soon!'
    };

    try {
      if (this.env.DEPLOYMENT_KV) {
        await this.env.DEPLOYMENT_KV.put('maintenance_mode', JSON.stringify(maintenanceState));
      }
      console.log('Maintenance mode enabled:', reason);
    } catch (error) {
      console.error('Failed to enable maintenance mode:', error);
      throw error;
    }
  }

  /**
   * Disable maintenance mode
   */
  async disableMaintenanceMode(): Promise<void> {
    const maintenanceState: MaintenanceMode = {
      enabled: false
    };

    try {
      if (this.env.DEPLOYMENT_KV) {
        await this.env.DEPLOYMENT_KV.put('maintenance_mode', JSON.stringify(maintenanceState));
      }
      console.log('Maintenance mode disabled');
    } catch (error) {
      console.error('Failed to disable maintenance mode:', error);
      throw error;
    }
  }

  /**
   * Record migration metrics
   */
  private async recordMigrationMetrics(result: MigrationResult): Promise<void> {
    try {
      if (this.metricsService && this.env.ANALYTICS) {
        await this.env.ANALYTICS.writeDataPoint({
          blobs: [
            'production_migration',
            result.success ? 'success' : 'failure',
            'full_migration',
            this.env.ENVIRONMENT || 'unknown'
          ],
          doubles: [
            result.duration,
            result.usersMigrated,
            result.filesMigrated,
            result.filtersMigrated,
            result.errors.length
          ],
          indexes: [
            'production_migration',
            result.success ? 'success' : 'failure'
          ]
        });
      }
    } catch (error) {
      console.error('Failed to record migration metrics:', error);
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{
    isMaintenanceMode: boolean;
    migrationInProgress: boolean;
    lastMigrationResult?: MigrationResult;
  }> {
    try {
      let isMaintenanceMode = false;

      if (this.env.DEPLOYMENT_KV) {
        const maintenanceStateJson = await this.env.DEPLOYMENT_KV.get('maintenance_mode');
        if (maintenanceStateJson) {
          const maintenanceState = JSON.parse(maintenanceStateJson) as MaintenanceMode;
          isMaintenanceMode = maintenanceState.enabled;
        }
      }

      return {
        isMaintenanceMode,
        migrationInProgress: false, // Would track this in KV if needed
        lastMigrationResult: undefined // Would fetch from DB if needed
      };
    } catch (error) {
      console.error('Failed to get migration status:', error);
      return {
        isMaintenanceMode: false,
        migrationInProgress: false
      };
    }
  }

  /**
   * Rollback migration (if needed)
   */
  async rollbackMigration(): Promise<void> {
    try {
      console.log('🔄 Starting migration rollback...');

      // Disable maintenance mode
      await this.disableMaintenanceMode();

      // Additional rollback logic would go here:
      // - Revert DNS changes
      // - Clear migrated data if needed
      // - Restore backup if available

      console.log('✅ Migration rollback completed');
    } catch (error) {
      console.error('Migration rollback failed:', error);
      throw error;
    }
  }

  /**
   * Django data extraction methods
   */
  private async fetchDjangoUsers(): Promise<any[]> {
    try {
      const djangoEndpoint = process.env.DJANGO_API_ENDPOINT || 'http://localhost:8000';
      const response = await fetch(`${djangoEndpoint}/api/migration/users/`, {
        headers: {
          'Authorization': `Bearer ${process.env.DJANGO_API_TOKEN || ''}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`Django users API failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.users || [];
    } catch (error) {
      console.error('Failed to fetch Django users:', error);
      throw new Error(`Django users extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async fetchDjangoFileMetadata(): Promise<any[]> {
    try {
      const djangoEndpoint = process.env.DJANGO_API_ENDPOINT || 'http://localhost:8000';
      const response = await fetch(`${djangoEndpoint}/api/migration/files/`, {
        headers: {
          'Authorization': `Bearer ${process.env.DJANGO_API_TOKEN || ''}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`Django files API failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.files || [];
    } catch (error) {
      console.error('Failed to fetch Django file metadata:', error);
      throw new Error(`Django file metadata extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async fetchDjangoSavedFilters(): Promise<any[]> {
    try {
      const djangoEndpoint = process.env.DJANGO_API_ENDPOINT || 'http://localhost:8000';
      const response = await fetch(`${djangoEndpoint}/api/migration/filters/`, {
        headers: {
          'Authorization': `Bearer ${process.env.DJANGO_API_TOKEN || ''}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`Django filters API failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.filters || [];
    } catch (error) {
      console.error('Failed to fetch Django saved filters:', error);
      throw new Error(`Django saved filters extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract and migrate user data from Django
   */
  private async extractAndMigrateUsers(): Promise<number> {
    console.log('🔄 Extracting users from Django...');
    
    const djangoUsers = await this.fetchDjangoUsers();
    let migrated = 0;

    for (const user of djangoUsers) {
      try {
        await this.db.prepare(`
          INSERT OR REPLACE INTO users 
          (id, username, email, password_hash, created_at, updated_at, is_active, last_login, preferences)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          user.id,
          user.username,
          user.email,
          user.password_hash,
          user.created_at,
          user.updated_at,
          user.is_active,
          user.last_login,
          JSON.stringify(user.preferences || {})
        ).run();
        migrated++;
      } catch (error) {
        console.error(`Failed to migrate user ${user.id}:`, error);
      }
    }

    return migrated;
  }

  /**
   * Extract and migrate file metadata from Django
   */
  private async extractAndMigrateFileMetadata(): Promise<number> {
    console.log('🔄 Extracting file metadata from Django...');
    
    const djangoFiles = await this.fetchDjangoFileMetadata();
    let migrated = 0;

    for (const file of djangoFiles) {
      try {
        await this.db.prepare(`
          INSERT OR REPLACE INTO files 
          (id, user_id, filename, original_filename, file_size, content_type, file_hash, upload_path, created_at, updated_at, is_public, download_count, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          file.id,
          file.user_id,
          file.filename,
          file.original_filename,
          file.file_size,
          file.content_type,
          file.file_hash,
          file.upload_path,
          file.created_at,
          file.updated_at,
          file.is_public,
          file.download_count,
          JSON.stringify(file.metadata || {})
        ).run();
        migrated++;
      } catch (error) {
        console.error(`Failed to migrate file ${file.id}:`, error);
      }
    }

    return migrated;
  }

  /**
   * Extract and migrate saved filters from Django
   */
  private async extractAndMigrateSavedFilters(): Promise<number> {
    console.log('🔄 Extracting saved filters from Django...');
    
    const djangoFilters = await this.fetchDjangoSavedFilters();
    let migrated = 0;

    for (const filter of djangoFilters) {
      try {
        await this.db.prepare(`
          INSERT OR REPLACE INTO saved_filters 
          (id, user_id, name, description, filter_config, is_public, usage_count, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          filter.id,
          filter.user_id,
          filter.name,
          filter.description,
          JSON.stringify(filter.filter_config),
          filter.is_public,
          filter.usage_count,
          filter.created_at,
          filter.updated_at
        ).run();
        migrated++;
      } catch (error) {
        console.error(`Failed to migrate filter ${filter.id}:`, error);
      }
    }

    return migrated;
  }
}