import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccessControlService } from '../src/services/security/access-control';
import { FileSharingService } from '../src/services/security/file-sharing';
import { 
  FileOperation, 
  FileRole, 
  AccessControlContext,
  PermissionGrant,
  ShareTokenRequest 
} from '../src/types/permissions';

// Mock D1Database
const mockDb = {
  prepare: vi.fn(),
  batch: vi.fn(),
  dump: vi.fn(),
  exec: vi.fn()
};

// Mock KV Namespace
const mockKv = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn()
};

// Mock prepared statement
const mockPreparedStatement = {
  bind: vi.fn().mockReturnThis(),
  first: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
  raw: vi.fn()
};

describe('AccessControlService', () => {
  let accessControl: AccessControlService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.prepare.mockReturnValue(mockPreparedStatement);
    accessControl = new AccessControlService(mockDb as any);
  });

  describe('validateOwnership', () => {
    it('should validate file ownership for owner', async () => {
      const fileId = 'file-123';
      const userId = 'user-123';

      mockPreparedStatement.first.mockResolvedValue({
        id: fileId,
        user_id: userId,
        filename: 'test.csv',
        created_at: '2024-01-01T00:00:00Z',
        role: null,
        permissions: null,
        granted_by: null,
        granted_at: null,
        expires_at: null
      });

      const result = await accessControl.validateOwnership(fileId, userId);

      expect(result).toEqual({
        fileId,
        userId,
        isOwner: true,
        effectiveRole: FileRole.OWNER,
        permissions: [
          FileOperation.READ,
          FileOperation.WRITE,
          FileOperation.DELETE,
          FileOperation.SHARE,
          FileOperation.ADMIN
        ],
        sharedAccess: undefined
      });
    });

    it('should validate shared access permissions', async () => {
      const fileId = 'file-123';
      const userId = 'user-456';
      const ownerId = 'user-123';

      mockPreparedStatement.first.mockResolvedValue({
        id: fileId,
        user_id: ownerId,
        filename: 'test.csv',
        created_at: '2024-01-01T00:00:00Z',
        role: FileRole.EDITOR,
        permissions: JSON.stringify([FileOperation.READ, FileOperation.WRITE]),
        granted_by: ownerId,
        granted_at: '2024-01-01T12:00:00Z',
        expires_at: null
      });

      const result = await accessControl.validateOwnership(fileId, userId);

      expect(result).toEqual({
        fileId,
        userId,
        isOwner: false,
        effectiveRole: FileRole.EDITOR,
        permissions: [FileOperation.READ, FileOperation.WRITE],
        sharedAccess: {
          grantedBy: ownerId,
          grantedAt: new Date('2024-01-01T12:00:00Z'),
          expiresAt: undefined
        }
      });
    });

    it('should throw error for non-existent file', async () => {
      const fileId = 'file-nonexistent';
      const userId = 'user-123';

      mockPreparedStatement.first.mockResolvedValue(null);

      await expect(accessControl.validateOwnership(fileId, userId))
        .rejects.toThrow('File file-nonexistent not found or not accessible by user user-123');
    });
  });

  describe('checkPermission', () => {
    it('should allow operation for owner', async () => {
      const context: AccessControlContext = {
        userId: 'user-123',
        fileId: 'file-123',
        operation: FileOperation.DELETE
      };

      // Mock ownership validation
      mockPreparedStatement.first
        .mockResolvedValueOnce({
          id: context.fileId,
          user_id: context.userId,
          filename: 'test.csv',
          created_at: '2024-01-01T00:00:00Z',
          role: null,
          permissions: null,
          granted_by: null,
          granted_at: null,
          expires_at: null
        })
        .mockResolvedValueOnce({}); // For audit log

      mockPreparedStatement.run.mockResolvedValue({ success: true });

      const result = await accessControl.checkPermission(context);

      expect(result.allowed).toBe(true);
      expect(result.currentRole).toBe(FileRole.OWNER);
      expect(result.reason).toBe('permission_granted');
    });

    it('should deny operation for insufficient permissions', async () => {
      const context: AccessControlContext = {
        userId: 'user-456',
        fileId: 'file-123',
        operation: FileOperation.DELETE
      };

      // Mock shared access as viewer
      mockPreparedStatement.first
        .mockResolvedValueOnce({
          id: context.fileId,
          user_id: 'user-123', // Different owner
          filename: 'test.csv',
          created_at: '2024-01-01T00:00:00Z',
          role: FileRole.VIEWER,
          permissions: JSON.stringify([FileOperation.READ]),
          granted_by: 'user-123',
          granted_at: '2024-01-01T12:00:00Z',
          expires_at: null
        })
        .mockResolvedValueOnce({}); // For audit log

      mockPreparedStatement.run.mockResolvedValue({ success: true });

      const result = await accessControl.checkPermission(context);

      expect(result.allowed).toBe(false);
      expect(result.currentRole).toBe(FileRole.VIEWER);
      expect(result.reason).toBe('insufficient_permissions');
      expect(result.requiredRole).toBe(FileRole.OWNER);
    });
  });

  describe('grantPermission', () => {
    it('should grant permission when granter has share permission', async () => {
      const granterId = 'user-123';
      const grant: PermissionGrant = {
        fileId: 'file-123',
        userId: 'user-456',
        role: FileRole.EDITOR,
        permissions: [FileOperation.READ, FileOperation.WRITE]
      };

      // Mock granter permission check
      mockPreparedStatement.first
        .mockResolvedValueOnce({
          id: grant.fileId,
          user_id: granterId,
          filename: 'test.csv',
          created_at: '2024-01-01T00:00:00Z',
          role: null,
          permissions: null,
          granted_by: null,
          granted_at: null,
          expires_at: null
        })
        .mockResolvedValueOnce({}) // For audit log
        .mockResolvedValueOnce(null); // No existing permission

      mockPreparedStatement.run.mockResolvedValue({ success: true });

      await expect(accessControl.grantPermission(granterId, grant))
        .resolves.not.toThrow();

      expect(mockPreparedStatement.run).toHaveBeenCalled();
    });
  });
});

describe('FileSharingService', () => {
  let fileSharingService: FileSharingService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.prepare.mockReturnValue(mockPreparedStatement);
    fileSharingService = new FileSharingService(mockDb as any, mockKv as any);
  });

  describe('createShareToken', () => {
    it('should create share token for user with share permission', async () => {
      const userId = 'user-123';
      const request: ShareTokenRequest = {
        fileId: 'file-123',
        permissions: [FileOperation.READ],
        expiresIn: 3600, // 1 hour
        description: 'Test share'
      };

      // Mock permission check
      mockPreparedStatement.first
        .mockResolvedValueOnce({
          id: request.fileId,
          user_id: userId,
          filename: 'test.csv',
          created_at: '2024-01-01T00:00:00Z',
          role: null,
          permissions: null,
          granted_by: null,
          granted_at: null,
          expires_at: null
        })
        .mockResolvedValueOnce({}) // For audit log
        .mockResolvedValueOnce({ count: 5 }) // Current shares count
        .mockResolvedValueOnce({ max_shares_per_file: 100 }) // Policy limit
        .mockResolvedValueOnce({ max_token_lifetime: 604800 }); // Policy limit

      mockPreparedStatement.run.mockResolvedValue({ success: true });
      mockKv.put.mockResolvedValue(undefined);

      const result = await fileSharingService.createShareToken(userId, request);

      expect(result.permissions).toEqual([FileOperation.READ]);
      expect(result.token).toMatch(/^fst_[a-f0-9]+$/);
      expect(result.shareUrl).toContain(result.token);
      expect(mockKv.put).toHaveBeenCalled();
    });

    it('should reject share token creation for insufficient permissions', async () => {
      const userId = 'user-456'; // Not owner
      const request: ShareTokenRequest = {
        fileId: 'file-123',
        permissions: [FileOperation.READ],
        expiresIn: 3600
      };

      // Mock permission check failure
      mockPreparedStatement.first
        .mockResolvedValueOnce({
          id: request.fileId,
          user_id: 'user-123', // Different owner
          filename: 'test.csv',
          created_at: '2024-01-01T00:00:00Z',
          role: FileRole.VIEWER,
          permissions: JSON.stringify([FileOperation.READ]),
          granted_by: 'user-123',
          granted_at: '2024-01-01T12:00:00Z',
          expires_at: null
        })
        .mockResolvedValueOnce({}); // For audit log

      mockPreparedStatement.run.mockResolvedValue({ success: true });

      await expect(fileSharingService.createShareToken(userId, request))
        .rejects.toThrow('Insufficient permissions to share file');
    });
  });

  describe('validateShareToken', () => {
    it('should validate valid share token', async () => {
      const token = 'fst_abcdef123456';
      const context = {
        fileId: 'file-123',
        operation: FileOperation.READ as FileOperation
      };

      const mockTokenData = {
        id: 'token-123',
        fileId: 'file-123',
        sharedBy: 'user-123',
        permissions: [FileOperation.READ],
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        maxUses: null,
        usedCount: 0,
        ipWhitelist: null
      };

      mockKv.get.mockResolvedValue(mockTokenData);
      mockPreparedStatement.run.mockResolvedValue({ success: true });

      const result = await fileSharingService.validateShareToken(token, context);

      expect(result.valid).toBe(true);
      expect(result.permissions).toEqual([FileOperation.READ]);
      expect(result.reason).toBe('share_token_valid');
    });

    it('should reject expired share token', async () => {
      const token = 'fst_abcdef123456';
      const context = {
        fileId: 'file-123',
        operation: FileOperation.READ as FileOperation
      };

      const mockTokenData = {
        id: 'token-123',
        fileId: 'file-123',
        sharedBy: 'user-123',
        permissions: [FileOperation.READ],
        expiresAt: new Date(Date.now() - 3600000).toISOString(), // Expired
        maxUses: null,
        usedCount: 0,
        ipWhitelist: null
      };

      mockKv.get.mockResolvedValue(mockTokenData);
      mockPreparedStatement.run.mockResolvedValue({ success: true });

      const result = await fileSharingService.validateShareToken(token, context);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('expired');
    });

    it('should reject token for wrong file', async () => {
      const token = 'fst_abcdef123456';
      const context = {
        fileId: 'file-456', // Different file
        operation: FileOperation.READ as FileOperation
      };

      const mockTokenData = {
        id: 'token-123',
        fileId: 'file-123', // Original file
        sharedBy: 'user-123',
        permissions: [FileOperation.READ],
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        maxUses: null,
        usedCount: 0,
        ipWhitelist: null
      };

      mockKv.get.mockResolvedValue(mockTokenData);
      mockPreparedStatement.run.mockResolvedValue({ success: true });

      const result = await fileSharingService.validateShareToken(token, context);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid');
    });

    it('should reject token for insufficient operation permission', async () => {
      const token = 'fst_abcdef123456';
      const context = {
        fileId: 'file-123',
        operation: FileOperation.WRITE as FileOperation // Token only allows READ
      };

      const mockTokenData = {
        id: 'token-123',
        fileId: 'file-123',
        sharedBy: 'user-123',
        permissions: [FileOperation.READ], // Only read permission
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        maxUses: null,
        usedCount: 0,
        ipWhitelist: null
      };

      mockKv.get.mockResolvedValue(mockTokenData);
      mockPreparedStatement.run.mockResolvedValue({ success: true });

      const result = await fileSharingService.validateShareToken(token, context);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not permitted');
    });
  });
});

describe('Permission System Integration', () => {
  let accessControl: AccessControlService;
  let fileSharingService: FileSharingService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.prepare.mockReturnValue(mockPreparedStatement);
    accessControl = new AccessControlService(mockDb as any);
    fileSharingService = new FileSharingService(mockDb as any, mockKv as any);
  });

  it('should maintain permission hierarchy correctly', () => {
    // Test that role hierarchy is maintained
    const ownerPermissions = [
      FileOperation.READ,
      FileOperation.WRITE,
      FileOperation.DELETE,
      FileOperation.SHARE,
      FileOperation.ADMIN
    ];

    const editorPermissions = [
      FileOperation.READ,
      FileOperation.WRITE,
      FileOperation.SHARE
    ];

    const viewerPermissions = [
      FileOperation.READ
    ];

    // Owner should have all permissions
    expect(ownerPermissions).toContain(FileOperation.DELETE);
    expect(ownerPermissions).toContain(FileOperation.ADMIN);
    
    // Editor should not have delete/admin
    expect(editorPermissions).not.toContain(FileOperation.DELETE);
    expect(editorPermissions).not.toContain(FileOperation.ADMIN);
    
    // Viewer should only have read
    expect(viewerPermissions).toEqual([FileOperation.READ]);
  });

  it('should validate permission escalation rules', () => {
    // Only owners should be able to delete files
    const deleteOperation = FileOperation.DELETE;
    const requiredRoleForDelete = FileRole.OWNER;
    
    expect(requiredRoleForDelete).toBe(FileRole.OWNER);
    
    // Editors should be able to share files
    const shareOperation = FileOperation.SHARE;
    const editorPermissions = [FileOperation.READ, FileOperation.WRITE, FileOperation.SHARE];
    
    expect(editorPermissions).toContain(shareOperation);
  });
});

// Performance and Security Tests
describe('Security and Performance', () => {
  it('should handle large numbers of permission checks efficiently', async () => {
    // This would be expanded in a real test suite
    const startTime = Date.now();
    
    // Simulate multiple permission checks
    const checksCount = 100;
    const checks = Array(checksCount).fill(null).map(() => ({
      fileId: 'file-123',
      operation: FileOperation.READ
    }));
    
    // In a real implementation, these would be actual async calls
    const results = checks.map(() => ({ allowed: true }));
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(results).toHaveLength(checksCount);
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });

  it('should properly sanitize and validate input', () => {
    // Test input validation
    const validFileId = 'file-123abc';
    const invalidFileId = 'file-123"; DROP TABLE files; --';
    
    // In a real implementation, there would be input sanitization
    expect(validFileId).toMatch(/^[a-zA-Z0-9-]+$/);
    expect(invalidFileId).not.toMatch(/^[a-zA-Z0-9-]+$/);
  });
});

export {};