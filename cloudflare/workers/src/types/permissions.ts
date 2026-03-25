/**
 * API Permission types and presets
 */

export enum APIPermission {
  // File operations
  FILES_READ = 'files:read',
  FILES_WRITE = 'files:write',
  FILES_DELETE = 'files:delete',

  // Analysis operations
  ANALYSIS_READ = 'analysis:read',
  ANALYSIS_WRITE = 'analysis:write',

  // User management
  USERS_READ = 'users:read',
  USERS_WRITE = 'users:write',

  // Admin operations
  ADMIN = 'admin',
}

export const PERMISSION_DESCRIPTIONS: Record<APIPermission, string> = {
  [APIPermission.FILES_READ]: 'Read files and file metadata',
  [APIPermission.FILES_WRITE]: 'Upload and modify files',
  [APIPermission.FILES_DELETE]: 'Delete files',
  [APIPermission.ANALYSIS_READ]: 'Read analysis results',
  [APIPermission.ANALYSIS_WRITE]: 'Create and modify analyses',
  [APIPermission.USERS_READ]: 'Read user information',
  [APIPermission.USERS_WRITE]: 'Modify user information',
  [APIPermission.ADMIN]: 'Full administrative access',
};

export const PERMISSION_PRESETS = {
  readonly: [APIPermission.FILES_READ, APIPermission.ANALYSIS_READ],
  standard: [
    APIPermission.FILES_READ,
    APIPermission.FILES_WRITE,
    APIPermission.ANALYSIS_READ,
    APIPermission.ANALYSIS_WRITE,
  ],
  admin: Object.values(APIPermission),
} as const;
