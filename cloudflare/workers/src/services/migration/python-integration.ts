import type { CloudflareEnv } from '../../types/env.js';

/**
 * Python migration orchestrator integration types
 */
export interface PythonMigrationConfig {
  postgres_dsn: string;
  d1_api_endpoint: string;
  d1_api_token: string;
  r2_api_endpoint: string;
  r2_api_token: string;
  django_media_root: string;
  workers_api_endpoint: string;
  workers_api_token: string;
  batch_size?: number;
  max_workers?: number;
  dry_run?: boolean;
}

export interface PythonMigrationStats {
  total_files: number;
  processed_files: number;
  successful_files: number;
  failed_files: number;
  skipped_files: number;
  total_size: number;
  processed_size: number;
  transferred_size: number;
  start_time?: string;
  end_time?: string;
  avg_file_size: number;
  avg_transfer_rate: number;
  estimated_completion?: string;
  error_count: number;
  retry_count: number;
}

export interface PythonMigrationStatus {
  migration_id: string;
  phase: string;
  status: string;
  stats: PythonMigrationStats;
  checkpoints: Array<{
    checkpoint_id: string;
    phase: string;
    timestamp: string;
    progress_percentage: number;
  }>;
  errors: Array<{
    error_type: string;
    error_message: string;
    timestamp: string;
    file_id?: string;
  }>;
}

export interface PythonOrchestrationRequest {
  command: 'migrate' | 'rollback' | 'status' | 'pause' | 'resume';
  config?: PythonMigrationConfig;
  migration_id?: string;
  target_phase?: string;
  parameters?: Record<string, any>;
}

export interface PythonOrchestrationResponse {
  success: boolean;
  data?: any;
  error?: string;
  migration_id?: string;
  status?: PythonMigrationStatus;
}

/**
 * Integration service for Python migration orchestrator
 * Provides coordination between Workers migration services and Python tools
 */
export class PythonMigrationIntegration {
  private env: CloudflareEnv;
  private pythonEndpoint: string;
  private authToken?: string;

  constructor(env: CloudflareEnv) {
    this.env = env;
    this.pythonEndpoint = process.env.PYTHON_ORCHESTRATOR_ENDPOINT || 'http://localhost:8080';
    this.authToken = process.env.PYTHON_ORCHESTRATOR_TOKEN;
  }

  /**
   * Check if Python orchestrator is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.pythonEndpoint}/health`, {
        method: 'GET',
        headers: this.getHeaders(),
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      console.warn('Python orchestrator not available:', error);
      return false;
    }
  }

  /**
   * Start Python migration orchestration
   */
  async startMigration(config: PythonMigrationConfig): Promise<PythonOrchestrationResponse> {
    try {
      const request: PythonOrchestrationRequest = {
        command: 'migrate',
        config: {
          ...config,
          d1_api_endpoint: `${this.env.WORKERS_URL || 'https://api.list-cutter.com'}/api`,
          d1_api_token: this.env.API_KEY || '',
          r2_api_endpoint: `${this.env.WORKERS_URL || 'https://api.list-cutter.com'}/api/files`,
          r2_api_token: this.env.API_KEY || '',
          workers_api_endpoint: this.env.WORKERS_URL || 'https://api.list-cutter.com',
          workers_api_token: this.env.API_KEY || ''
        }
      };

      const response = await fetch(`${this.pythonEndpoint}/orchestrate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`Python orchestrator API failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to start Python migration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get Python migration status
   */
  async getMigrationStatus(migrationId: string): Promise<PythonOrchestrationResponse> {
    try {
      const request: PythonOrchestrationRequest = {
        command: 'status',
        migration_id: migrationId
      };

      const response = await fetch(`${this.pythonEndpoint}/orchestrate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`Python orchestrator status API failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get Python migration status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute Python migration rollback
   */
  async rollbackMigration(migrationId: string, targetPhase?: string): Promise<PythonOrchestrationResponse> {
    try {
      const request: PythonOrchestrationRequest = {
        command: 'rollback',
        migration_id: migrationId,
        target_phase: targetPhase
      };

      const response = await fetch(`${this.pythonEndpoint}/orchestrate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`Python orchestrator rollback API failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to rollback Python migration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Pause Python migration
   */
  async pauseMigration(migrationId: string): Promise<PythonOrchestrationResponse> {
    try {
      const request: PythonOrchestrationRequest = {
        command: 'pause',
        migration_id: migrationId
      };

      const response = await fetch(`${this.pythonEndpoint}/orchestrate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`Python orchestrator pause API failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to pause Python migration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Resume Python migration
   */
  async resumeMigration(migrationId: string): Promise<PythonOrchestrationResponse> {
    try {
      const request: PythonOrchestrationRequest = {
        command: 'resume',
        migration_id: migrationId
      };

      const response = await fetch(`${this.pythonEndpoint}/orchestrate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`Python orchestrator resume API failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to resume Python migration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Coordinate with Python migration for data synchronization
   */
  async coordinateDataSync(syncType: 'users' | 'files' | 'filters'): Promise<{
    success: boolean;
    recordsProcessed: number;
    errors: string[];
  }> {
    try {
      const request: PythonOrchestrationRequest = {
        command: 'migrate',
        parameters: {
          sync_type: syncType,
          target_workers_endpoint: this.env.WORKERS_URL || 'https://api.list-cutter.com',
          api_token: this.env.API_KEY || ''
        }
      };

      const response = await fetch(`${this.pythonEndpoint}/sync`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
        timeout: 60000 // Longer timeout for data sync
      });

      if (!response.ok) {
        throw new Error(`Python data sync API failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: result.success || false,
        recordsProcessed: result.records_processed || 0,
        errors: result.errors || []
      };
    } catch (error) {
      console.error('Failed to coordinate data sync with Python:', error);
      return {
        success: false,
        recordsProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Validate Python migration integrity
   */
  async validateMigrationIntegrity(migrationId: string): Promise<{
    success: boolean;
    validation_results: Record<string, any>;
    issues: string[];
  }> {
    try {
      const response = await fetch(`${this.pythonEndpoint}/validate/${migrationId}`, {
        method: 'GET',
        headers: this.getHeaders(),
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`Python validation API failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: result.success || false,
        validation_results: result.validation_results || {},
        issues: result.issues || []
      };
    } catch (error) {
      console.error('Failed to validate Python migration integrity:', error);
      return {
        success: false,
        validation_results: {},
        issues: [error instanceof Error ? error.message : 'Validation failed']
      };
    }
  }

  /**
   * Get migration logs from Python orchestrator
   */
  async getMigrationLogs(migrationId: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info'): Promise<{
    success: boolean;
    logs: Array<{
      timestamp: string;
      level: string;
      message: string;
      phase?: string;
      file_id?: string;
    }>;
  }> {
    try {
      const response = await fetch(`${this.pythonEndpoint}/logs/${migrationId}?level=${level}`, {
        method: 'GET',
        headers: this.getHeaders(),
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`Python logs API failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        logs: result.logs || []
      };
    } catch (error) {
      console.error('Failed to get Python migration logs:', error);
      return {
        success: false,
        logs: []
      };
    }
  }

  /**
   * Create migration configuration for Python orchestrator
   */
  createPythonConfig(options: {
    djangoEndpoint: string;
    batchSize?: number;
    maxWorkers?: number;
    dryRun?: boolean;
  }): PythonMigrationConfig {
    return {
      postgres_dsn: process.env.POSTGRES_DSN || '',
      django_media_root: process.env.DJANGO_MEDIA_ROOT || '/app/media',
      d1_api_endpoint: '', // Will be filled by startMigration
      d1_api_token: '',
      r2_api_endpoint: '',
      r2_api_token: '',
      workers_api_endpoint: '',
      workers_api_token: '',
      batch_size: options.batchSize || 50,
      max_workers: options.maxWorkers || 10,
      dry_run: options.dryRun || false
    };
  }

  /**
   * Monitor Python migration progress
   */
  async *monitorMigrationProgress(migrationId: string, interval: number = 10000): AsyncGenerator<PythonMigrationStatus | null> {
    while (true) {
      try {
        const response = await this.getMigrationStatus(migrationId);
        
        if (response.success && response.status) {
          yield response.status;
          
          // Stop monitoring if migration is completed or failed
          if (['completed', 'failed', 'rolled_back'].includes(response.status.status)) {
            break;
          }
        } else {
          yield null;
        }
        
        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, interval));
      } catch (error) {
        console.error('Error monitoring Python migration:', error);
        yield null;
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  }

  /**
   * Get request headers for Python orchestrator API
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'List-Cutter-Workers/1.0'
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }
}