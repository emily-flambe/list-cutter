import { describe, it, expect, vi } from 'vitest'
import {
  generateShareableURL,
  parseShareableURL,
  sanitizeFilename,
  generateExportSQL,
  encryptFilterState,
  decryptFilterState,
  validateTokenSignature
} from '../sqlExportSecurity'

describe('SQL Export Security [phase-1]', () => {
  describe('Shareable URL generation', () => {
    it('does not expose sensitive column names in URLs', () => {
      const filters = [
        { column: 'ssn', operator: 'equals', value: '123-45-6789', dataType: 'TEXT' }
      ]
      const url = generateShareableURL(filters)
      expect(url).not.toContain('ssn')
      expect(url).not.toContain('123-45-6789')
    })

    it('does not expose sensitive values in URLs', () => {
      const filters = [
        { column: 'salary', operator: 'greater_than', value: 100000, dataType: 'NUMBER' },
        { column: 'password', operator: 'equals', value: 'secret123', dataType: 'TEXT' }
      ]
      const url = generateShareableURL(filters)
      expect(url).not.toContain('100000')
      expect(url).not.toContain('salary')
      expect(url).not.toContain('password')
      expect(url).not.toContain('secret123')
    })

    it('uses encrypted tokens for filter state', () => {
      const filters = [
        { column: 'salary', operator: 'greater_than', value: 100000, dataType: 'NUMBER' }
      ]
      const url = generateShareableURL(filters)
      const urlObj = new URL(url)
      const token = urlObj.searchParams.get('token')
      
      expect(token).toBeTruthy()
      expect(token).toMatch(/^[A-Za-z0-9+/]+=*$/) // Base64 pattern
      expect(token.length).toBeGreaterThan(20) // Should be encrypted
    })

    it('validates token signatures to prevent tampering', () => {
      const filters = [
        { column: 'status', operator: 'equals', value: 'active', dataType: 'TEXT' }
      ]
      const url = generateShareableURL(filters)
      const tamperedUrl = url.replace(/.$/, 'X') // Tamper with last character
      
      expect(() => parseShareableURL(tamperedUrl)).toThrow('Invalid token signature')
    })

    it('includes signature in encrypted token', () => {
      const filters = [
        { column: 'age', operator: 'greater_than', value: 18, dataType: 'NUMBER' }
      ]
      const url = generateShareableURL(filters)
      const urlObj = new URL(url)
      const token = urlObj.searchParams.get('token')
      
      // Token should have signature component
      const parts = token.split('.')
      expect(parts.length).toBeGreaterThanOrEqual(2) // Data + Signature
    })

    it('can round-trip filters through URL', () => {
      const originalFilters = [
        { column: 'status', operator: 'equals', value: 'active', dataType: 'TEXT' },
        { column: 'count', operator: 'greater_than', value: 10, dataType: 'NUMBER' }
      ]
      
      const url = generateShareableURL(originalFilters)
      const restoredFilters = parseShareableURL(url)
      
      expect(restoredFilters).toEqual(originalFilters)
    })

    it('handles empty filter array', () => {
      const url = generateShareableURL([])
      const restored = parseShareableURL(url)
      expect(restored).toEqual([])
    })

    it('rejects malformed tokens', () => {
      const badUrl = 'https://example.com?token=not-valid-base64!'
      expect(() => parseShareableURL(badUrl)).toThrow()
    })

    it('rejects expired tokens', () => {
      const filters = [{ column: 'test', operator: 'equals', value: 'value', dataType: 'TEXT' }]
      const url = generateShareableURL(filters, { expiresIn: -1 }) // Already expired
      
      expect(() => parseShareableURL(url)).toThrow('Token has expired')
    })
  })

  describe('File export sanitization', () => {
    it('sanitizes dangerous characters in filenames', () => {
      expect(sanitizeFilename('../../etc/passwd.sql')).toBe('etc_passwd.sql')
      expect(sanitizeFilename('../../../root/.ssh/id_rsa')).toBe('root_ssh_id_rsa')
      expect(sanitizeFilename('C:\\Windows\\System32\\config.sql')).toBe('C_Windows_System32_config.sql')
    })

    it('removes path traversal attempts', () => {
      expect(sanitizeFilename('..\\..\\sensitive.sql')).toBe('sensitive.sql')
      expect(sanitizeFilename('./../../data.sql')).toBe('data.sql')
    })

    it('preserves valid filename characters', () => {
      expect(sanitizeFilename('report_2024-01-15.sql')).toBe('report_2024-01-15.sql')
      expect(sanitizeFilename('user-data_export.sql')).toBe('user-data_export.sql')
    })

    it('handles special characters safely', () => {
      expect(sanitizeFilename('file<script>.sql')).toBe('file_script_.sql')
      expect(sanitizeFilename('data|pipe.sql')).toBe('data_pipe.sql')
      expect(sanitizeFilename('test:colon.sql')).toBe('test_colon.sql')
    })

    it('limits filename length', () => {
      const longName = 'a'.repeat(300) + '.sql'
      const sanitized = sanitizeFilename(longName)
      expect(sanitized.length).toBeLessThanOrEqual(255)
      expect(sanitized).toEndWith('.sql')
    })

    it('handles null bytes and control characters', () => {
      expect(sanitizeFilename('file\x00null.sql')).toBe('filenull.sql')
      expect(sanitizeFilename('test\r\ninjection.sql')).toBe('testinjection.sql')
    })
  })

  describe('SQL comment sanitization', () => {
    it('prevents SQL injection in exported comments', () => {
      const metadata = {
        description: "'; DROP TABLE users; --"
      }
      const sql = generateExportSQL([], metadata)
      expect(sql).not.toContain('DROP TABLE')
      expect(sql).toContain('-- Description: \\'; DROP TABLE users; --')
    })

    it('escapes comment terminators', () => {
      const metadata = {
        description: 'Normal comment */ SELECT * FROM passwords /*'
      }
      const sql = generateExportSQL([], metadata)
      expect(sql).not.toContain('*/')
      expect(sql).toContain('*\\/')
    })

    it('handles multiline comments safely', () => {
      const metadata = {
        description: 'Line 1\n-- Line 2\n/* Line 3 */'
      }
      const sql = generateExportSQL([], metadata)
      const lines = sql.split('\n')
      
      // All lines should be properly commented
      lines.forEach(line => {
        if (line.trim() && !line.startsWith('SELECT')) {
          expect(line).toMatch(/^--/)
        }
      })
    })

    it('includes safe metadata in export', () => {
      const metadata = {
        exportDate: '2024-01-15',
        recordCount: 100,
        description: 'Monthly report'
      }
      const sql = generateExportSQL([], metadata)
      
      expect(sql).toContain('-- Export Date: 2024-01-15')
      expect(sql).toContain('-- Record Count: 100')
      expect(sql).toContain('-- Description: Monthly report')
    })

    it('sanitizes user-provided export names', () => {
      const metadata = {
        exportName: '../../etc/passwd',
        user: 'admin<script>alert(1)</script>'
      }
      const sql = generateExportSQL([], metadata)
      
      expect(sql).not.toContain('../../')
      expect(sql).not.toContain('<script>')
      expect(sql).toContain('etc_passwd')
    })
  })

  describe('Encryption functions', () => {
    it('encrypts filter state securely', () => {
      const filters = [
        { column: 'sensitive', operator: 'equals', value: 'data', dataType: 'TEXT' }
      ]
      const encrypted = encryptFilterState(filters)
      
      expect(encrypted).not.toContain('sensitive')
      expect(encrypted).not.toContain('data')
      expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*\./) // Base64 with signature
    })

    it('decrypts filter state correctly', () => {
      const original = [
        { column: 'test', operator: 'equals', value: 'value', dataType: 'TEXT' }
      ]
      const encrypted = encryptFilterState(original)
      const decrypted = decryptFilterState(encrypted)
      
      expect(decrypted).toEqual(original)
    })

    it('validates signature before decryption', () => {
      const encrypted = encryptFilterState([])
      const tampered = encrypted.slice(0, -5) + 'XXXXX'
      
      expect(() => decryptFilterState(tampered)).toThrow('Invalid signature')
    })

    it('handles complex filter objects', () => {
      const complexFilters = [
        { column: 'date', operator: 'between', value: ['2024-01-01', '2024-12-31'], dataType: 'DATE' },
        { column: 'tags', operator: 'contains', value: 'important', dataType: 'TEXT' },
        { column: 'priority', operator: 'greater_than', value: 5, dataType: 'NUMBER' }
      ]
      
      const encrypted = encryptFilterState(complexFilters)
      const decrypted = decryptFilterState(encrypted)
      
      expect(decrypted).toEqual(complexFilters)
    })
  })

  describe('Token validation', () => {
    it('validates token format', () => {
      expect(validateTokenSignature('not.valid.token')).toBe(false)
      expect(validateTokenSignature('')).toBe(false)
      expect(validateTokenSignature(null)).toBe(false)
    })

    it('accepts valid tokens', () => {
      const filters = []
      const token = encryptFilterState(filters)
      expect(validateTokenSignature(token)).toBe(true)
    })

    it('rejects modified tokens', () => {
      const filters = []
      const token = encryptFilterState(filters)
      const modified = token.replace('A', 'B')
      expect(validateTokenSignature(modified)).toBe(false)
    })
  })
})