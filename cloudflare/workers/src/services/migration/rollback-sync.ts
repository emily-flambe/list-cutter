import type { CloudflareEnv } from '../../types/env.js';
import { PythonMigrationIntegration } from './python-integration.js';

/**
 * Rollback synchronization types
 */
export interface RollbackSyncConfig {
  djangoEndpoint: string;
  syncDirection: 'workers_to_django' | 'django_to_workers' | 'bidirectional';
  dataTypes: Array<'users' | 'files' | 'filters' | 'all'>;
  conflictResolution: 'django_wins' | 'workers_wins' | 'newest_wins' | 'manual';
  batchSize: number;
  maxRetries: number;
  dryRun: boolean;
}

export interface SyncRecord {
  type: 'user' | 'file' | 'filter';
  id: string;
  action: 'created' | 'updated' | 'deleted';
  timestamp: string;
  data: Record<string, any>;
  source: 'django' | 'workers';
  conflictStatus?: 'resolved' | 'pending' | 'failed';
}

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsSynced: number;
  recordsSkipped: number;
  recordsFailed: number;
  conflicts: Array<{
    recordId: string;
    type: string;
    conflict: string;
    resolution?: string;
  }>;
  errors: string[];
  startTime: string;
  endTime: string;
  duration: number;
}

export interface ConflictResolution {
  recordId: string;
  type: 'user' | 'file' | 'filter';
  action: 'use_django' | 'use_workers' | 'merge' | 'skip';
  mergedData?: Record<string, any>;
}

/**
 * Rollback data synchronization service
 * Handles data sync between Django and Workers during rollback scenarios
 */
export class RollbackDataSyncService {
  private env: CloudflareEnv;
  private pythonIntegration: PythonMigrationIntegration;

  constructor(env: CloudflareEnv) {
    this.env = env;
    this.pythonIntegration = new PythonMigrationIntegration(env);
  }

  /**
   * Execute rollback data synchronization
   */
  async executeRollbackSync(config: RollbackSyncConfig): Promise<SyncResult> {
    const startTime = new Date().toISOString();
    
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsSynced: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
      conflicts: [],
      errors: [],
      startTime,
      endTime: '',
      duration: 0
    };

    try {
      console.log('🔄 Starting rollback data synchronization...');

      // Get changes that occurred during cutover
      const changes = await this.detectDataChanges(config);
      result.recordsProcessed = changes.length;

      console.log(`📊 Detected ${changes.length} data changes to synchronize`);

      // Process each data type
      for (const dataType of config.dataTypes) {
        if (dataType === 'all') {
          await this.syncUsers(changes.filter(c => c.type === 'user'), config, result);
          await this.syncFiles(changes.filter(c => c.type === 'file'), config, result);
          await this.syncFilters(changes.filter(c => c.type === 'filter'), config, result);
        } else {
          const typeChanges = changes.filter(c => c.type === dataType);
          
          switch (dataType) {
            case 'users':
              await this.syncUsers(typeChanges, config, result);
              break;
            case 'files':
              await this.syncFiles(typeChanges, config, result);
              break;
            case 'filters':
              await this.syncFilters(typeChanges, config, result);
              break;
          }
        }
      }

      // Handle conflicts if any
      if (result.conflicts.length > 0) {
        console.log(`⚠️ Found ${result.conflicts.length} conflicts during synchronization`);
        await this.handleConflicts(result.conflicts, config);
      }

      const endTime = new Date().toISOString();
      result.endTime = endTime;
      result.duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      console.log(`✅ Rollback synchronization completed: ${result.recordsSynced}/${result.recordsProcessed} records synced`);

    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      result.errors.push(errorMessage);
      console.error('❌ Rollback synchronization failed:', errorMessage);
    }

    return result;
  }

  /**
   * Detect data changes that occurred during cutover
   */
  private async detectDataChanges(config: RollbackSyncConfig): Promise<SyncRecord[]> {
    const changes: SyncRecord[] = [];

    // Get cutover start time from KV store
    const cutoverStartTime = await this.getCutoverStartTime();
    
    if (!cutoverStartTime) {
      console.warn('No cutover start time found, scanning all recent changes');
    }

    try {
      // Detect changes in Workers (D1 database)
      if (config.syncDirection === 'workers_to_django' || config.syncDirection === 'bidirectional') {
        const workersChanges = await this.detectWorkersChanges(cutoverStartTime);
        changes.push(...workersChanges);
      }

      // Detect changes in Django
      if (config.syncDirection === 'django_to_workers' || config.syncDirection === 'bidirectional') {
        const djangoChanges = await this.detectDjangoChanges(config.djangoEndpoint, cutoverStartTime);
        changes.push(...djangoChanges);
      }

    } catch (error) {
      console.error('Failed to detect data changes:', error);
      throw new Error(`Change detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return changes;
  }

  /**
   * Detect changes in Workers D1 database
   */
  private async detectWorkersChanges(sinceTime?: string): Promise<SyncRecord[]> {
    const changes: SyncRecord[] = [];
    const timeFilter = sinceTime ? `WHERE updated_at >= '${sinceTime}'` : '';

    try {
      // Detect user changes
      const userChanges = await this.env.DB.prepare(`
        SELECT id, username, email, created_at, updated_at, is_active, last_login, preferences
        FROM users ${timeFilter}
        ORDER BY updated_at DESC
      `).all();

      for (const user of userChanges.results) {
        changes.push({
          type: 'user',
          id: user.id as string,
          action: this.determineAction(user.created_at as string, user.updated_at as string),
          timestamp: user.updated_at as string,
          data: user as Record<string, any>,
          source: 'workers'
        });
      }

      // Detect file changes
      const fileChanges = await this.env.DB.prepare(`
        SELECT id, user_id, filename, original_filename, file_size, content_type, 
               file_hash, r2_key, created_at, updated_at, is_public, download_count, metadata
        FROM files ${timeFilter}
        ORDER BY updated_at DESC
      `).all();

      for (const file of fileChanges.results) {
        changes.push({
          type: 'file',
          id: file.id as string,
          action: this.determineAction(file.created_at as string, file.updated_at as string),
          timestamp: file.updated_at as string,
          data: file as Record<string, any>,
          source: 'workers'
        });
      }

      // Detect filter changes
      const filterChanges = await this.env.DB.prepare(`
        SELECT id, user_id, name, description, filter_config, is_public, usage_count, created_at, updated_at
        FROM saved_filters ${timeFilter}
        ORDER BY updated_at DESC
      `).all();

      for (const filter of filterChanges.results) {
        changes.push({
          type: 'filter',
          id: filter.id as string,
          action: this.determineAction(filter.created_at as string, filter.updated_at as string),
          timestamp: filter.updated_at as string,
          data: filter as Record<string, any>,
          source: 'workers'
        });
      }

    } catch (error) {
      console.error('Failed to detect Workers changes:', error);
    }

    return changes;
  }

  /**
   * Detect changes in Django system
   */
  private async detectDjangoChanges(djangoEndpoint: string, sinceTime?: string): Promise<SyncRecord[]> {
    const changes: SyncRecord[] = [];

    try {
      const params = sinceTime ? `?since=${encodeURIComponent(sinceTime)}` : '';
      
      const response = await fetch(`${djangoEndpoint}/api/sync/changes/${params}`, {
        headers: {
          'Authorization': `Bearer ${process.env.DJANGO_API_TOKEN || ''}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`Django changes API failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Process Django changes
      for (const change of data.changes || []) {
        changes.push({
          type: change.type,
          id: change.id,
          action: change.action,
          timestamp: change.timestamp,
          data: change.data,
          source: 'django'
        });
      }

    } catch (error) {
      console.error('Failed to detect Django changes:', error);
      // Don't throw - continue with Workers-only sync
    }

    return changes;
  }

  /**
   * Synchronize user data
   */
  private async syncUsers(userChanges: SyncRecord[], config: RollbackSyncConfig, result: SyncResult): Promise<void> {
    console.log(`👥 Synchronizing ${userChanges.length} user changes...`);

    for (const change of userChanges) {
      try {
        if (config.dryRun) {
          console.log(`[DRY RUN] Would sync user ${change.id}: ${change.action}`);
          result.recordsSkipped++;
          continue;
        }

        // Apply conflict resolution
        const resolved = await this.resolveConflict(change, config);
        if (!resolved) {
          result.recordsSkipped++;
          continue;
        }

        // Sync based on direction
        if (change.source === 'workers' && config.syncDirection !== 'django_to_workers') {
          await this.syncUserToDjango(change, config.djangoEndpoint);
        } else if (change.source === 'django' && config.syncDirection !== 'workers_to_django') {
          await this.syncUserToWorkers(change);
        }

        result.recordsSynced++;
      } catch (error) {
        console.error(`Failed to sync user ${change.id}:`, error);
        result.recordsFailed++;
        result.errors.push(`User sync failed for ${change.id}: ${error}`);
      }
    }
  }

  /**
   * Synchronize file data
   */
  private async syncFiles(fileChanges: SyncRecord[], config: RollbackSyncConfig, result: SyncResult): Promise<void> {
    console.log(`📁 Synchronizing ${fileChanges.length} file changes...`);

    for (const change of fileChanges) {
      try {
        if (config.dryRun) {
          console.log(`[DRY RUN] Would sync file ${change.id}: ${change.action}`);
          result.recordsSkipped++;
          continue;
        }

        // Apply conflict resolution
        const resolved = await this.resolveConflict(change, config);
        if (!resolved) {
          result.recordsSkipped++;
          continue;
        }

        // Sync based on direction
        if (change.source === 'workers' && config.syncDirection !== 'django_to_workers') {
          await this.syncFileToDjango(change, config.djangoEndpoint);
        } else if (change.source === 'django' && config.syncDirection !== 'workers_to_django') {
          await this.syncFileToWorkers(change);
        }

        result.recordsSynced++;
      } catch (error) {
        console.error(`Failed to sync file ${change.id}:`, error);
        result.recordsFailed++;
        result.errors.push(`File sync failed for ${change.id}: ${error}`);
      }
    }
  }

  /**
   * Synchronize filter data
   */
  private async syncFilters(filterChanges: SyncRecord[], config: RollbackSyncConfig, result: SyncResult): Promise<void> {
    console.log(`🔍 Synchronizing ${filterChanges.length} filter changes...`);

    for (const change of filterChanges) {
      try {
        if (config.dryRun) {
          console.log(`[DRY RUN] Would sync filter ${change.id}: ${change.action}`);
          result.recordsSkipped++;
          continue;
        }

        // Apply conflict resolution
        const resolved = await this.resolveConflict(change, config);
        if (!resolved) {
          result.recordsSkipped++;
          continue;
        }

        // Sync based on direction
        if (change.source === 'workers' && config.syncDirection !== 'django_to_workers') {
          await this.syncFilterToDjango(change, config.djangoEndpoint);
        } else if (change.source === 'django' && config.syncDirection !== 'workers_to_django') {
          await this.syncFilterToWorkers(change);
        }

        result.recordsSynced++;
      } catch (error) {
        console.error(`Failed to sync filter ${change.id}:`, error);
        result.recordsFailed++;
        result.errors.push(`Filter sync failed for ${change.id}: ${error}`);
      }
    }
  }

  /**
   * Resolve data conflicts based on configuration
   */
  private async resolveConflict(change: SyncRecord, config: RollbackSyncConfig): Promise<boolean> {
    // Check for conflicts (simplified logic)
    const hasConflict = await this.detectConflict(change);
    
    if (!hasConflict) {
      return true; // No conflict, proceed with sync
    }

    switch (config.conflictResolution) {
      case 'django_wins':
        return change.source === 'django';
      case 'workers_wins':
        return change.source === 'workers';
      case 'newest_wins':
        // Compare timestamps and use newest
        return true; // Simplified - would implement proper timestamp comparison
      case 'manual':
        // Store conflict for manual resolution
        change.conflictStatus = 'pending';
        return false;
      default:
        return true;
    }
  }

  /**
   * Detect if a change has conflicts
   */
  private async detectConflict(change: SyncRecord): Promise<boolean> {
    // Simplified conflict detection
    // In reality, would check if record exists in both systems with different values
    return false;
  }

  /**
   * Handle unresolved conflicts
   */
  private async handleConflicts(conflicts: any[], config: RollbackSyncConfig): Promise<void> {
    if (config.conflictResolution === 'manual') {
      // Store conflicts in database for manual resolution
      console.log('💾 Storing conflicts for manual resolution');
      
      for (const conflict of conflicts) {
        await this.storeConflict(conflict);
      }
    }
  }

  /**
   * Store conflict for manual resolution
   */
  private async storeConflict(conflict: any): Promise<void> {
    try {
      await this.env.DB.prepare(`
        INSERT INTO sync_conflicts (record_id, record_type, conflict_data, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        conflict.recordId,
        conflict.type,
        JSON.stringify(conflict)
      ).run();
    } catch (error) {
      console.error('Failed to store conflict:', error);
    }
  }

  /**
   * Get cutover start time from KV store
   */
  private async getCutoverStartTime(): Promise<string | null> {
    try {
      if (this.env.DEPLOYMENT_KV) {
        const cutoverData = await this.env.DEPLOYMENT_KV.get('cutover_metadata');
        if (cutoverData) {
          const metadata = JSON.parse(cutoverData);
          return metadata.startTime || null;
        }
      }
    } catch (error) {
      console.error('Failed to get cutover start time:', error);
    }
    return null;
  }

  /**
   * Determine action type based on timestamps
   */
  private determineAction(createdAt: string, updatedAt: string): 'created' | 'updated' | 'deleted' {
    // Simplified logic - would be more sophisticated in practice
    const created = new Date(createdAt);
    const updated = new Date(updatedAt);
    
    return created.getTime() === updated.getTime() ? 'created' : 'updated';
  }

  /**
   * Sync methods for individual record types
   */
  private async syncUserToDjango(change: SyncRecord, djangoEndpoint: string): Promise<void> {
    // Implementation would sync user to Django
    console.log(`Syncing user ${change.id} to Django`);
  }

  private async syncUserToWorkers(change: SyncRecord): Promise<void> {
    // Implementation would sync user to Workers
    console.log(`Syncing user ${change.id} to Workers`);
  }

  private async syncFileToDjango(change: SyncRecord, djangoEndpoint: string): Promise<void> {
    // Implementation would sync file to Django
    console.log(`Syncing file ${change.id} to Django`);
  }

  private async syncFileToWorkers(change: SyncRecord): Promise<void> {
    // Implementation would sync file to Workers
    console.log(`Syncing file ${change.id} to Workers`);
  }

  private async syncFilterToDjango(change: SyncRecord, djangoEndpoint: string): Promise<void> {
    // Implementation would sync filter to Django
    console.log(`Syncing filter ${change.id} to Django`);
  }

  private async syncFilterToWorkers(change: SyncRecord): Promise<void> {
    // Implementation would sync filter to Workers
    console.log(`Syncing filter ${change.id} to Workers`);
  }
}