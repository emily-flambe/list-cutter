import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProductionCutoverOrchestrator, CutoverPhase } from '../services/migration/production-cutover-orchestrator.js';
import { ProductionMigrationService } from '../services/deployment/production-migration.js';
import { PythonMigrationIntegration } from '../services/migration/python-integration.js';
import { RollbackDataSyncService } from '../services/migration/rollback-sync.js';
import { FileMigrationService } from '../services/migration/file-migration.js';
import type { CloudflareEnv } from '../types/env.js';

// Mock environment for testing
const mockEnv: CloudflareEnv = {
  DB: {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue({ success: true }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null)
      })
    })
  } as any,
  FILE_STORAGE: {} as any,
  ANALYTICS: {
    writeDataPoint: vi.fn().mockResolvedValue(undefined)
  } as any,
  DEPLOYMENT_KV: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined)
  } as any,
  API_KEY: 'test-api-key',
  WORKERS_URL: 'https://test.list-cutter.com'
};

describe('Migration Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock global fetch
    global.fetch = vi.fn();
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ProductionMigrationService', () => {
    it('should create and execute full migration successfully', async () => {
      const migrationService = new ProductionMigrationService(mockEnv);

      // Mock Django API responses
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ users: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ files: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ filters: [] })
        });

      const result = await migrationService.executeFullMigration();

      expect(result.success).toBe(true);
      expect(result.usersMigrated).toBe(0);
      expect(result.filesMigrated).toBe(0);
      expect(result.filtersMigrated).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle Django API failures gracefully', async () => {
      const migrationService = new ProductionMigrationService(mockEnv);

      // Mock Django API failure
      global.fetch = vi.fn().mockRejectedValue(new Error('Django API unavailable'));

      const result = await migrationService.executeFullMigration();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should enable and disable maintenance mode', async () => {
      const migrationService = new ProductionMigrationService(mockEnv);

      await migrationService.enableMaintenanceMode('Test maintenance');
      expect(mockEnv.DEPLOYMENT_KV.put).toHaveBeenCalledWith(
        'maintenance_mode',
        expect.stringContaining('"enabled":true')
      );

      await migrationService.disableMaintenanceMode();
      expect(mockEnv.DEPLOYMENT_KV.put).toHaveBeenCalledWith(
        'maintenance_mode',
        expect.stringContaining('"enabled":false')
      );
    });
  });

  describe('ProductionCutoverOrchestrator', () => {
    it('should execute complete cutover successfully', async () => {
      const cutoverConfig = {
        enableDataMigration: true,
        migrationBatchSize: 50,
        migrationTimeout: 300000,
        enableBlueGreenDeployment: false,
        deploymentValidationTime: 60000,
        updateDNS: false,
        dnsRecords: [],
        monitoringDuration: 300000,
        alertThresholds: {
          maxErrorRate: 5,
          maxResponseTime: 1000,
          minSuccessRate: 95
        },
        enableAutoRollback: true,
        rollbackTimeout: 1800000,
        djangoApiEndpoint: 'http://localhost:8000',
        enablePythonIntegration: false
      };

      const orchestrator = new ProductionCutoverOrchestrator(mockEnv, cutoverConfig);

      // Mock Django API responses
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ users: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ files: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ filters: [] })
        });

      const result = await orchestrator.executeCutover();

      expect(result.success).toBe(true);
      expect(result.finalPhase).toBe(CutoverPhase.COMPLETED);
      expect(result.rollbackPerformed).toBe(false);
    });

    it('should handle cutover failures and attempt rollback', async () => {
      const cutoverConfig = {
        enableDataMigration: true,
        migrationBatchSize: 50,
        migrationTimeout: 300000,
        enableBlueGreenDeployment: false,
        deploymentValidationTime: 60000,
        updateDNS: false,
        dnsRecords: [],
        monitoringDuration: 300000,
        alertThresholds: {
          maxErrorRate: 5,
          maxResponseTime: 1000,
          minSuccessRate: 95
        },
        enableAutoRollback: true,
        rollbackTimeout: 1800000,
        djangoApiEndpoint: 'http://localhost:8000',
        enablePythonIntegration: false
      };

      const orchestrator = new ProductionCutoverOrchestrator(mockEnv, cutoverConfig);

      // Mock Django API failure
      global.fetch = vi.fn().mockRejectedValue(new Error('Migration failed'));

      const result = await orchestrator.executeCutover();

      expect(result.success).toBe(false);
      expect(result.rollbackPerformed).toBe(true);
      expect(result.finalPhase).toBe(CutoverPhase.ROLLED_BACK);
    });

    it('should track progress correctly', async () => {
      const cutoverConfig = {
        enableDataMigration: false,
        migrationBatchSize: 50,
        migrationTimeout: 300000,
        enableBlueGreenDeployment: false,
        deploymentValidationTime: 60000,
        updateDNS: false,
        dnsRecords: [],
        monitoringDuration: 10,
        alertThresholds: {
          maxErrorRate: 5,
          maxResponseTime: 1000,
          minSuccessRate: 95
        },
        enableAutoRollback: false,
        rollbackTimeout: 1800000,
        djangoApiEndpoint: 'http://localhost:8000',
        enablePythonIntegration: false
      };

      const orchestrator = new ProductionCutoverOrchestrator(mockEnv, cutoverConfig);

      const initialProgress = await orchestrator.getCutoverProgress();
      expect(initialProgress.phase).toBe(CutoverPhase.PREPARATION);
      expect(initialProgress.percentage).toBe(0);
    });
  });

  describe('PythonMigrationIntegration', () => {
    it('should check Python orchestrator availability', async () => {
      const pythonIntegration = new PythonMigrationIntegration(mockEnv);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' })
      });

      const isAvailable = await pythonIntegration.isAvailable();
      expect(isAvailable).toBe(true);
    });

    it('should handle Python orchestrator unavailability', async () => {
      const pythonIntegration = new PythonMigrationIntegration(mockEnv);

      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const isAvailable = await pythonIntegration.isAvailable();
      expect(isAvailable).toBe(false);
    });

    it('should start Python migration successfully', async () => {
      const pythonIntegration = new PythonMigrationIntegration(mockEnv);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          migration_id: 'test-migration-123'
        })
      });

      const config = pythonIntegration.createPythonConfig({
        djangoEndpoint: 'http://localhost:8000',
        batchSize: 25,
        maxWorkers: 5,
        dryRun: true
      });

      const result = await pythonIntegration.startMigration(config);

      expect(result.success).toBe(true);
      expect(result.migration_id).toBe('test-migration-123');
    });

    it('should coordinate data sync successfully', async () => {
      const pythonIntegration = new PythonMigrationIntegration(mockEnv);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          records_processed: 100,
          errors: []
        })
      });

      const result = await pythonIntegration.coordinateDataSync('users');

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(100);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('RollbackDataSyncService', () => {
    it('should execute rollback sync successfully', async () => {
      const rollbackSync = new RollbackDataSyncService(mockEnv);

      // Mock database responses for change detection
      mockEnv.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] })
        })
      });

      const syncConfig = {
        djangoEndpoint: 'http://localhost:8000',
        syncDirection: 'bidirectional' as const,
        dataTypes: ['users', 'files'] as const,
        conflictResolution: 'newest_wins' as const,
        batchSize: 50,
        maxRetries: 3,
        dryRun: true
      };

      const result = await rollbackSync.executeRollbackSync(syncConfig);

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(0);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should handle sync conflicts properly', async () => {
      const rollbackSync = new RollbackDataSyncService(mockEnv);

      // Mock database with conflicting records
      mockEnv.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: '1',
                type: 'user',
                created_at: '2023-01-01T00:00:00Z',
                updated_at: '2023-01-02T00:00:00Z'
              }
            ]
          }),
          run: vi.fn().mockResolvedValue({ success: true })
        })
      });

      const syncConfig = {
        djangoEndpoint: 'http://localhost:8000',
        syncDirection: 'bidirectional' as const,
        dataTypes: ['users'] as const,
        conflictResolution: 'manual' as const,
        batchSize: 50,
        maxRetries: 3,
        dryRun: false
      };

      const result = await rollbackSync.executeRollbackSync(syncConfig);

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBeGreaterThan(0);
    });
  });

  describe('FileMigrationService Integration', () => {
    it('should integrate with production migration service', async () => {
      const fileMigrationService = new FileMigrationService({} as any, mockEnv.DB);

      const migrationBatch = {
        batchId: 'test-batch-123',
        files: [
          {
            fileId: 'file-1',
            sourcePath: '/media/test.csv',
            fileName: 'test.csv',
            fileSize: 1024,
            userId: 'user-1',
            checksum: 'abc123'
          }
        ],
        status: 'pending' as const,
        metadata: { type: 'production' }
      };

      // Mock file migration process
      const result = await fileMigrationService.processBatch(migrationBatch);

      expect(result).toBeDefined();
      expect(result.batchId).toBeDefined();
      expect(result.totalFiles).toBe(1);
    });
  });

  describe('End-to-End Migration Flow', () => {
    it('should coordinate full migration with all components', async () => {
      // Test the complete integration flow
      const migrationService = new ProductionMigrationService(mockEnv);
      const pythonIntegration = new PythonMigrationIntegration(mockEnv);

      // Mock all external API calls
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ users: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ files: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ filters: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 'healthy' })
        });

      // Execute migration
      const migrationResult = await migrationService.executeFullMigration();
      expect(migrationResult.success).toBe(true);

      // Check Python integration status
      const pythonAvailable = await pythonIntegration.isAvailable();
      expect(pythonAvailable).toBe(true);

      // Verify maintenance mode was handled
      expect(mockEnv.DEPLOYMENT_KV.put).toHaveBeenCalledWith(
        'maintenance_mode',
        expect.stringContaining('"enabled":true')
      );
    });

    it('should handle complete system rollback scenario', async () => {
      const rollbackSync = new RollbackDataSyncService(mockEnv);
      const migrationService = new ProductionMigrationService(mockEnv);

      // Mock rollback scenario
      mockEnv.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ success: true })
        })
      });

      // Execute rollback
      await migrationService.rollbackMigration();

      const syncConfig = {
        djangoEndpoint: 'http://localhost:8000',
        syncDirection: 'django_to_workers' as const,
        dataTypes: ['all'] as const,
        conflictResolution: 'django_wins' as const,
        batchSize: 50,
        maxRetries: 3,
        dryRun: false
      };

      const syncResult = await rollbackSync.executeRollbackSync(syncConfig);

      expect(syncResult.success).toBe(true);
      expect(mockEnv.DEPLOYMENT_KV.put).toHaveBeenCalledWith(
        'maintenance_mode',
        expect.stringContaining('"enabled":false')
      );
    });
  });
});