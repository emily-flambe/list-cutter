import { describe, it, expect } from 'vitest'
import { compileFiltersToSQL } from '../sqlPreviewCompiler'

describe('SQL Preview Integration Tests', () => {
  it('handles table names with spaces correctly', () => {
    const filters = []
    const sql = compileFiltersToSQL(filters, { 
      tableName: '2025 National Public Opinion Reference Survey' 
    })
    expect(sql).toBe('SELECT * FROM "2025 National Public Opinion Reference Survey"')
  })

  it('compiles Gender contains woman filter correctly', () => {
    const filters = [
      {
        column: 'Gender',
        operator: 'contains',
        value: 'woman',
        dataType: 'TEXT'
      }
    ]
    const sql = compileFiltersToSQL(filters, { 
      tableName: '2025 National Public Opinion Reference Survey' 
    })
    expect(sql).toBe(
      'SELECT * FROM "2025 National Public Opinion Reference Survey"\n' +
      'WHERE "Gender" LIKE \'%woman%\''
    )
  })

  it('handles multiple filters with table names containing spaces', () => {
    const filters = [
      {
        column: 'Gender',
        operator: 'contains',
        value: 'woman',
        dataType: 'TEXT'
      },
      {
        column: 'Age',
        operator: 'greater_than',
        value: 25,
        dataType: 'NUMBER'
      }
    ]
    const sql = compileFiltersToSQL(filters, { 
      tableName: '2025 National Public Opinion Reference Survey' 
    })
    expect(sql).toBe(
      'SELECT * FROM "2025 National Public Opinion Reference Survey"\n' +
      'WHERE "Gender" LIKE \'%woman%\'\n' +
      '  AND "Age" > 25'
    )
  })

  it('handles not_equals operator', () => {
    const filters = [
      {
        column: 'Status',
        operator: 'not_equals',
        value: 'inactive',
        dataType: 'TEXT'
      }
    ]
    const sql = compileFiltersToSQL(filters)
    expect(sql).toBe(
      'SELECT * FROM data\n' +
      'WHERE "Status" != \'inactive\''
    )
  })

  it('handles is_empty and is_not_empty operators', () => {
    const filters = [
      {
        column: 'Email',
        operator: 'is_null',
        value: null,
        dataType: 'TEXT'
      },
      {
        column: 'Phone',
        operator: 'is_not_null',
        value: null,
        dataType: 'TEXT'
      }
    ]
    const sql = compileFiltersToSQL(filters)
    expect(sql).toBe(
      'SELECT * FROM data\n' +
      'WHERE "Email" IS NULL\n' +
      '  AND "Phone" IS NOT NULL'
    )
  })
})