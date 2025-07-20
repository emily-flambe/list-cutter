/**
 * Simplified Security Services Index
 * 
 * Only exports essential security functionality:
 * - File validation
 * - Core security utilities from parent security.ts
 */

export { validateFile as validateFileUpload } from './file-validator';

// Note: JWT auth, rate limiting, and other core security features
// are now exported from /services/security.ts