/**
 * Comprehensive Permissions and Access Control Types
 * Combines API permissions with file access control system
 */

// ===== API KEY PERMISSIONS =====

export enum APIPermission {
  // Authentication permissions
  AUTH_READ = 'auth:read',
  AUTH_WRITE = 'auth:write',
  
  // File operations
  FILES_READ = 'files:read',
  FILES_WRITE = 'files:write',
  FILES_DELETE = 'files:delete',
  
  // List cutting operations
  LIST_PROCESS = 'list:process',
  LIST_EXPORT = 'list:export',
  
  // Analytics (for future)
  ANALYTICS_READ = 'analytics:read',
  
  // Admin operations
  ADMIN_READ = 'admin:read',
  ADMIN_WRITE = 'admin:write'
}

export interface APIKeyPermissions {
  permissions: APIPermission[];
  rate_limit?: number;
  expires_at?: number;
  allowed_ips?: string[];
}

export const PERMISSION_DESCRIPTIONS = {
  [APIPermission.AUTH_READ]: 'Read authentication status and user info',
  [APIPermission.AUTH_WRITE]: 'Modify authentication settings',
  [APIPermission.FILES_READ]: 'Read file information and download files',
  [APIPermission.FILES_WRITE]: 'Upload and modify files',
  [APIPermission.FILES_DELETE]: 'Delete files',
  [APIPermission.LIST_PROCESS]: 'Process CSV files and perform list operations',
  [APIPermission.LIST_EXPORT]: 'Export processed lists',
  [APIPermission.ANALYTICS_READ]: 'Read analytics and usage statistics',
  [APIPermission.ADMIN_READ]: 'Read admin-level information',
  [APIPermission.ADMIN_WRITE]: 'Perform admin operations'
};

// Default permission sets for common use cases
export const PERMISSION_PRESETS = {
  READ_ONLY: [
    APIPermission.AUTH_READ,
    APIPermission.FILES_READ,
    APIPermission.ANALYTICS_READ
  ],
  LIST_PROCESSING: [
    APIPermission.AUTH_READ,
    APIPermission.FILES_READ,
    APIPermission.FILES_WRITE,
    APIPermission.LIST_PROCESS,
    APIPermission.LIST_EXPORT
  ],
  FULL_ACCESS: Object.values(APIPermission),
  BASIC_USER: [
    APIPermission.AUTH_READ,
    APIPermission.FILES_READ,
    APIPermission.FILES_WRITE,
    APIPermission.LIST_PROCESS,
    APIPermission.LIST_EXPORT
  ]
} as const;

// ===== FILE ACCESS CONTROL SYSTEM =====

export interface FilePermission {
  fileId: string;
  userId: string;
  role: FileRole;
  permissions: FileOperation[];
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export enum FileRole {
  OWNER = 'owner',
  EDITOR = 'editor',
  VIEWER = 'viewer',
  NONE = 'none'
}

export enum FileOperation {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  SHARE = 'share',
  ADMIN = 'admin'
}

export interface AccessControlContext {
  userId: string;
  fileId: string;
  operation: FileOperation;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
}

export interface AccessControlResult {
  allowed: boolean;
  reason?: string;
  requiredRole?: FileRole;
  currentRole?: FileRole;
  auditId?: string;
}

export interface FileShareToken {
  id: string;
  fileId: string;
  sharedBy: string;
  token: string;
  tokenHash: string;
  permissions: FileOperation[];
  expiresAt: Date;
  maxUses?: number;
  usedCount: number;
  ipWhitelist?: string[];
  isActive: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface ShareTokenRequest {
  fileId: string;
  permissions: FileOperation[];
  expiresIn: number; // seconds
  maxUses?: number;
  ipWhitelist?: string[];
  description?: string;
}

export interface ShareTokenResponse {
  token: string;
  shareUrl: string;
  expiresAt: Date;
  permissions: FileOperation[];
  maxUses?: number;
}

export interface FileAccessAudit {
  id: string;
  fileId: string;
  userId?: string;
  shareToken?: string;
  operation: FileOperation;
  result: 'allowed' | 'denied';
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  bytesTransferred?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface FileOwnershipValidation {
  fileId: string;
  userId: string;
  isOwner: boolean;
  effectiveRole: FileRole;
  permissions: FileOperation[];
  sharedAccess?: {
    grantedBy: string;
    grantedAt: Date;
    expiresAt?: Date;
  };
}

export interface BulkPermissionCheck {
  fileId: string;
  operation: FileOperation;
  result: AccessControlResult;
}

export interface SecurityPolicy {
  maxTokenLifetime: number; // seconds
  maxSharesPerFile: number;
  allowPublicSharing: boolean;
  requireOwnershipForDelete: boolean;
  requireOwnershipForShare: boolean;
  auditAllOperations: boolean;
  ipWhitelistEnabled: boolean;
  rateLimitEnabled: boolean;
}

export interface FileVisibility {
  fileId: string;
  visibility: 'private' | 'internal' | 'public';
  allowedUsers?: string[];
  allowedRoles?: string[];
  publicAccessToken?: string;
  updatedAt: Date;
}

export interface PermissionGrant {
  fileId: string;
  userId: string;
  role: FileRole;
  permissions: FileOperation[];
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface PermissionRevoke {
  fileId: string;
  userId: string;
  revokeAll?: boolean;
  operations?: FileOperation[];
}

export interface AccessControlConfig {
  defaultFileRole: FileRole;
  ownerPermissions: FileOperation[];
  editorPermissions: FileOperation[];
  viewerPermissions: FileOperation[];
  publicPermissions: FileOperation[];
  securityPolicy: SecurityPolicy;
}

export interface RoleHierarchy {
  role: FileRole;
  permissions: FileOperation[];
  canDelegate: boolean;
  canRevoke: boolean;
}

export interface FileAccessSnapshot {
  fileId: string;
  fileName: string;
  ownerId: string;
  totalUsers: number;
  activeShares: number;
  publicAccess: boolean;
  lastAccessedAt?: Date;
  permissions: Array<{
    userId: string;
    role: FileRole;
    permissions: FileOperation[];
    grantedAt: Date;
    expiresAt?: Date;
  }>;
}

// Utility type for operation-specific permission checks
export type PermissionCheck<T extends FileOperation> = {
  operation: T;
  fileId: string;
  userId: string;
  context?: Partial<AccessControlContext>;
};

// Error types for access control
export class AccessControlError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly fileId?: string,
    public readonly userId?: string,
    public readonly operation?: FileOperation
  ) {
    super(message);
    this.name = 'AccessControlError';
  }
}

export class InsufficientPermissionsError extends AccessControlError {
  constructor(
    fileId: string,
    userId: string,
    operation: FileOperation,
    requiredRole: FileRole,
    currentRole: FileRole
  ) {
    super(
      `Insufficient permissions for ${operation} on file ${fileId}. Required: ${requiredRole}, Current: ${currentRole}`,
      'INSUFFICIENT_PERMISSIONS',
      fileId,
      userId,
      operation
    );
  }
}

export class FileNotFoundError extends AccessControlError {
  constructor(fileId: string, userId: string) {
    super(
      `File ${fileId} not found or not accessible by user ${userId}`,
      'FILE_NOT_FOUND',
      fileId,
      userId
    );
  }
}

export class InvalidShareTokenError extends AccessControlError {
  constructor(token: string) {
    super(
      `Invalid or expired share token: ${token}`,
      'INVALID_SHARE_TOKEN'
    );
  }
}

export class ShareTokenExpiredError extends AccessControlError {
  constructor(token: string) {
    super(
      `Share token has expired: ${token}`,
      'SHARE_TOKEN_EXPIRED'
    );
  }
}

export class MaxSharesExceededError extends AccessControlError {
  constructor(fileId: string, maxShares: number) {
    super(
      `Maximum number of shares (${maxShares}) exceeded for file ${fileId}`,
      'MAX_SHARES_EXCEEDED',
      fileId
    );
  }
}