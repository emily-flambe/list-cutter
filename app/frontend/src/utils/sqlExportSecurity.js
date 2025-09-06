/**
 * SQL Export Security
 * Handles secure URL generation, file sanitization, and encryption for SQL exports
 */

import { compileFiltersToSQL } from './sqlPreviewCompiler'

// Simple encryption key - in production, use environment variable
let ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY

// In production, require the encryption key to be set
if (!ENCRYPTION_KEY) {
  if (import.meta.env.MODE === 'production') {
    throw new Error('VITE_ENCRYPTION_KEY must be set in production environments for SQL export security.')
  } else {
    // Allow fallback only in development/test
    ENCRYPTION_KEY = 'cutty-sql-export-2024'
  }
}

/**
 * Simple hash function for signatures
 */
function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * Encodes filter state to a shareable token
 * 
 * NOTE: This uses base64 encoding for URL-safe sharing, NOT for security.
 * The filter data is not sensitive - it's just UI state that users would
 * create themselves. The signature prevents tampering but doesn't hide data.
 * 
 * @param {Array} filters - Filter configurations
 * @param {Object} options - Encoding options
 * @returns {string} - Base64-encoded token with signature
 */
export function encryptFilterState(filters, options = {}) {
  const { expiresIn = 86400000 } = options // Default 24 hours
  
  const payload = {
    filters,
    timestamp: Date.now(),
    expires: expiresIn > 0 ? Date.now() + expiresIn : null
  }
  
  // Base64 encoding for URL sharing (not encryption)
  // The data is just filter configurations, not sensitive information
  const jsonStr = JSON.stringify(payload)
  const encoded = btoa(jsonStr)
  const signature = simpleHash(encoded + ENCRYPTION_KEY)
  
  return `${encoded}.${signature}`
}

/**
 * Decodes filter state from a token
 * @param {string} token - Base64-encoded token with signature
 * @returns {Array} - Decoded filter configurations
 */
export function decryptFilterState(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token')
  }
  
  const parts = token.split('.')
  if (parts.length !== 2) {
    throw new Error('Invalid token format')
  }
  
  const [encoded, signature] = parts
  
  // Verify signature
  const expectedSignature = simpleHash(encoded + ENCRYPTION_KEY)
  if (signature !== expectedSignature) {
    throw new Error('Invalid signature')
  }
  
  try {
    // Decode payload
    const jsonStr = atob(encoded)
    const payload = JSON.parse(jsonStr)
    
    // Check expiration
    if (payload.expires && Date.now() > payload.expires) {
      throw new Error('Token has expired')
    }
    
    return payload.filters
  } catch (error) {
    if (error.message === 'Token has expired') {
      throw error
    }
    throw new Error('Invalid token data')
  }
}

/**
 * Validates token signature without decrypting
 * @param {string} token - Token to validate
 * @returns {boolean} - True if signature is valid
 */
export function validateTokenSignature(token) {
  if (!token || typeof token !== 'string') {
    return false
  }
  
  const parts = token.split('.')
  if (parts.length !== 2) {
    return false
  }
  
  const [encoded, signature] = parts
  const expectedSignature = simpleHash(encoded + ENCRYPTION_KEY)
  
  return signature === expectedSignature
}

/**
 * Generates a shareable URL with encrypted filter state
 * @param {Array} filters - Filter configurations
 * @param {Object} options - URL generation options
 * @returns {string} - Shareable URL
 */
export function generateShareableURL(filters, options = {}) {
  const token = encryptFilterState(filters, options)
  const baseUrl = window.location.origin + window.location.pathname
  const url = new URL(baseUrl)
  url.searchParams.set('token', token)
  
  return url.toString()
}

/**
 * Parses filter state from a shareable URL
 * @param {string} urlString - URL containing encrypted token
 * @returns {Array} - Parsed filter configurations
 */
export function parseShareableURL(urlString) {
  const url = new URL(urlString)
  const token = url.searchParams.get('token')
  
  if (!token) {
    throw new Error('No token found in URL')
  }
  
  // First validate signature
  if (!validateTokenSignature(token)) {
    throw new Error('Invalid token signature')
  }
  
  return decryptFilterState(token)
}

/**
 * Sanitizes filename for safe file system operations
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
export function sanitizeFilename(filename) {
  if (!filename) return 'export.sql'
  
  // Remove path traversal attempts
  let sanitized = filename
    .replace(/\.\./g, '')
    .replace(/\\/g, '')
    .replace(/\//g, '_')
    
  // Remove control characters and null bytes
  sanitized = sanitized
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/\r/g, '')
    .replace(/\n/g, '')
  
  // Replace dangerous characters
  sanitized = sanitized
    .replace(/[<>:"|?*]/g, '_')
    .replace(/\|/g, '_')
  
  // Limit length
  const maxLength = 255
  if (sanitized.length > maxLength) {
    const extension = sanitized.match(/\.[^.]+$/)?.[0] || ''
    const nameLength = maxLength - extension.length
    sanitized = sanitized.substring(0, nameLength) + extension
  }
  
  // Remove leading dots and spaces
  sanitized = sanitized.replace(/^\.+/, '').trim()
  
  return sanitized || 'export.sql'
}

/**
 * Escapes SQL comments to prevent injection
 * @param {string} text - Text to escape for SQL comments
 * @returns {string} - Escaped text
 */
function escapeForSQLComment(text) {
  if (!text) return ''
  
  return String(text)
    .replace(/--/g, '\\--')
    .replace(/\*\//g, '*\\/')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\n-- ')
}

/**
 * Generates exportable SQL with metadata
 * @param {Array} filters - Filter configurations
 * @param {Object} metadata - Export metadata
 * @returns {string} - Complete SQL with comments
 */
export function generateExportSQL(filters, metadata = {}) {
  const lines = []
  
  // Add header comments
  lines.push('-- SQL Export from Cutty')
  lines.push('-- Generated: ' + new Date().toISOString())
  
  // Add metadata as comments
  if (metadata.exportDate) {
    lines.push(`-- Export Date: ${escapeForSQLComment(metadata.exportDate)}`)
  }
  
  if (metadata.recordCount !== undefined) {
    lines.push(`-- Record Count: ${metadata.recordCount}`)
  }
  
  if (metadata.description) {
    lines.push(`-- Description: ${escapeForSQLComment(metadata.description)}`)
  }
  
  if (metadata.exportName) {
    const safeName = sanitizeFilename(metadata.exportName)
    lines.push(`-- Export Name: ${escapeForSQLComment(safeName)}`)
  }
  
  if (metadata.user) {
    const safeUser = escapeForSQLComment(metadata.user).replace(/<[^>]*>/g, '')
    lines.push(`-- User: ${safeUser}`)
  }
  
  lines.push('-- ' + '='.repeat(50))
  lines.push('')
  
  // Add the actual SQL
  const sql = compileFiltersToSQL(filters)
  lines.push(sql)
  
  return lines.join('\n')
}