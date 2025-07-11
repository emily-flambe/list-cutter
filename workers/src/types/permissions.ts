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