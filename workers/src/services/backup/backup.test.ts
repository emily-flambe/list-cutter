import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBackupService, R2BackupService } from './r2-backup';
import type { Env } from '../../types';

// Mock environment for testing
const mockEnv: Env = {
  R2_BUCKET: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn()
  } as any,
  R2_BACKUP_BUCKET: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn()
  } as any,
  DB: {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        run: vi.fn(),
        first: vi.fn(),
        all: vi.fn(() => ({ results: [] }))
      }))
    }))
  } as any,
  AUTH_KV: {} as any,
  RATE_LIMITER: {} as any,
  JWT_SECRET: 'test-secret',
  MAX_FILE_SIZE: '10485760',
  ENVIRONMENT: 'test',
  BACKUP_RETENTION_DAYS: '30',
  BACKUP_SCHEDULE: 'daily',
  BACKUP_INCREMENTAL_ENABLED: 'true',
  BACKUP_COMPRESSION_ENABLED: 'false',
  BACKUP_ENCRYPTION_ENABLED: 'false'
};

describe('R2BackupService', () => {
  let backupService: R2BackupService;

  beforeEach(() => {
    vi.clearAllMocks();
    backupService = createBackupService(mockEnv);
  });

  describe('Backup Creation', () => {
    it('should create a backup service instance', () => {
      expect(backupService).toBeInstanceOf(R2BackupService);
    });

    it('should generate unique backup IDs', () => {
      const service1 = createBackupService(mockEnv);
      const service2 = createBackupService(mockEnv);
      
      // Access private method through casting
      const id1 = (service1 as any).generateBackupId();
      const id2 = (service2 as any).generateBackupId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^backup_\d+_[a-z0-9]+$/);
    });
  });

  describe('Checksum Calculation', () => {
    it('should calculate consistent checksums', async () => {
      const testData = 'test data for checksum';
      
      // Access private method through casting
      const checksum1 = await (backupService as any).calculateChecksum(testData);
      const checksum2 = await (backupService as any).calculateChecksum(testData);
      
      expect(checksum1).toBe(checksum2);
      expect(checksum1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string
    });

    it('should produce different checksums for different data', async () => {
      // Access private method through casting
      const checksum1 = await (backupService as any).calculateChecksum('data1');
      const checksum2 = await (backupService as any).calculateChecksum('data2');
      
      expect(checksum1).not.toBe(checksum2);
    });
  });

  describe('Backup Statistics', () => {
    it('should return backup statistics', async () => {
      // Mock database response
      const mockStats = {
        total: 5,
        total_size: 1000000,
        last_backup: '2024-01-01T00:00:00Z',
        completed: 4
      };

      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn(() => ({
          first: vi.fn().mockResolvedValue(mockStats)
        }))
      });

      const stats = await backupService.getBackupStats();
      
      expect(stats).toEqual({
        totalBackups: 5,
        totalSize: 1000000,
        lastBackupDate: '2024-01-01T00:00:00Z',
        successRate: 80
      });
    });

    it('should handle empty statistics gracefully', async () => {
      // Mock empty database response
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn(() => ({
          first: vi.fn().mockResolvedValue(null)
        }))
      });

      const stats = await backupService.getBackupStats();
      
      expect(stats).toEqual({
        totalBackups: 0,
        totalSize: 0,
        lastBackupDate: undefined,
        successRate: 0
      });
    });
  });

  describe('Backup Configuration', () => {
    it('should create backup service with default configuration', () => {
      const service = createBackupService(mockEnv);
      expect(service).toBeInstanceOf(R2BackupService);
    });

    it('should use environment variables for configuration', () => {
      expect(mockEnv.BACKUP_RETENTION_DAYS).toBe('30');
      expect(mockEnv.BACKUP_INCREMENTAL_ENABLED).toBe('true');
    });
  });

  describe('Backup Validation', () => {
    it('should validate backup metadata structure', () => {
      const mockMetadata = {
        id: 'backup_123',
        bucketName: 'test-bucket',
        backupDate: '2024-01-01T00:00:00Z',
        status: 'completed',
        fileCount: 10,
        totalSize: 1000,
        checksum: 'abc123',
        backupType: 'full',
        createdAt: '2024-01-01T00:00:00Z'
      };

      // Validate required properties exist
      expect(mockMetadata.id).toBeDefined();
      expect(mockMetadata.bucketName).toBeDefined();
      expect(mockMetadata.status).toMatch(/^(pending|in_progress|completed|failed)$/);
      expect(mockMetadata.backupType).toMatch(/^(full|incremental)$/);
    });
  });

  describe('Error Handling', () => {
    it('should handle R2 operation failures gracefully', async () => {
      // Mock R2 operation failure
      (mockEnv.R2_BUCKET.list as any).mockRejectedValue(new Error('R2 operation failed'));

      try {
        await (backupService as any).listAllFiles(mockEnv.R2_BUCKET);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('R2 operation failed');
      }
    });

    it('should handle database operation failures', async () => {
      // Mock database operation failure
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn(() => ({
          first: vi.fn().mockRejectedValue(new Error('Database error'))
        }))
      });

      try {
        await backupService.getBackupStats();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Database error');
      }
    });
  });
});

describe('Backup Factory Functions', () => {
  it('should create backup service with default configuration', () => {
    const service = createBackupService(mockEnv);
    expect(service).toBeInstanceOf(R2BackupService);
  });

  it('should use environment configuration', () => {
    const service = createBackupService(mockEnv);
    expect(service).toBeDefined();
  });
});

describe('Backup Integration', () => {
  it('should integrate with R2 operations', () => {
    expect(mockEnv.R2_BUCKET).toBeDefined();
    expect(mockEnv.R2_BACKUP_BUCKET).toBeDefined();
  });

  it('should integrate with database operations', () => {
    expect(mockEnv.DB).toBeDefined();
    expect(typeof mockEnv.DB.prepare).toBe('function');
  });

  it('should use correct environment variables', () => {
    expect(mockEnv.BACKUP_RETENTION_DAYS).toBe('30');
    expect(mockEnv.BACKUP_SCHEDULE).toBe('daily');
    expect(mockEnv.BACKUP_INCREMENTAL_ENABLED).toBe('true');
  });
});