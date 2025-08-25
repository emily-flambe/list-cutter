import { describe, it, expect } from 'vitest'
import { 
  compileFilterToSQL, 
  compileFiltersToSQL,
  escapeSQLString,
  formatSQL
} from '../sqlPreviewCompiler'

describe('SQL Preview Compiler [phase-1]', () => {
  describe('Filter to SQL compilation', () => {
    describe('Text filters', () => {
      it('compiles text equality filter correctly', () => {
        const filter = {
          column: 'city',
          operator: 'equals',
          value: 'New York',
          dataType: 'TEXT'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"city" = \'New York\'')
      })

      it('escapes single quotes in text values', () => {
        const filter = {
          column: 'name',
          operator: 'equals',
          value: "O'Brien",
          dataType: 'TEXT'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"name" = \'O\'\'Brien\'')
      })

      it('compiles contains operator with LIKE pattern', () => {
        const filter = {
          column: 'description',
          operator: 'contains',
          value: 'product',
          dataType: 'TEXT'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"description" LIKE \'%product%\'')
      })

      it('compiles starts_with operator', () => {
        const filter = {
          column: 'email',
          operator: 'starts_with',
          value: 'admin',
          dataType: 'TEXT'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"email" LIKE \'admin%\'')
      })

      it('compiles ends_with operator', () => {
        const filter = {
          column: 'domain',
          operator: 'ends_with',
          value: '.com',
          dataType: 'TEXT'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"domain" LIKE \'%.com\'')
      })

      it('compiles not_contains operator', () => {
        const filter = {
          column: 'notes',
          operator: 'not_contains',
          value: 'spam',
          dataType: 'TEXT'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"notes" NOT LIKE \'%spam%\'')
      })
    })

    describe('Numeric filters', () => {
      it('compiles numeric comparisons without quotes', () => {
        const filter = {
          column: 'age',
          operator: 'greater_than',
          value: 25,
          dataType: 'NUMBER'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"age" > 25')
      })

      it('compiles numeric equals', () => {
        const filter = {
          column: 'count',
          operator: 'equals',
          value: 100,
          dataType: 'NUMBER'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"count" = 100')
      })

      it('compiles less_than operator', () => {
        const filter = {
          column: 'score',
          operator: 'less_than',
          value: 50,
          dataType: 'NUMBER'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"score" < 50')
      })

      it('compiles between operator for numbers', () => {
        const filter = {
          column: 'price',
          operator: 'between',
          value: [10, 100],
          dataType: 'NUMBER'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"price" BETWEEN 10 AND 100')
      })

      it('handles decimal numbers correctly', () => {
        const filter = {
          column: 'percentage',
          operator: 'greater_than',
          value: 75.5,
          dataType: 'NUMBER'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"percentage" > 75.5')
      })
    })

    describe('Date filters', () => {
      it('compiles date comparisons with proper formatting', () => {
        const filter = {
          column: 'created_date',
          operator: 'greater_than',
          value: '2024-01-01',
          dataType: 'DATE'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"created_date" > \'2024-01-01\'')
      })

      it('compiles date equals', () => {
        const filter = {
          column: 'birth_date',
          operator: 'equals',
          value: '1990-05-15',
          dataType: 'DATE'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"birth_date" = \'1990-05-15\'')
      })

      it('compiles date before (less than)', () => {
        const filter = {
          column: 'expires',
          operator: 'before',
          value: '2024-12-31',
          dataType: 'DATE'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"expires" < \'2024-12-31\'')
      })

      it('compiles date after (greater than)', () => {
        const filter = {
          column: 'updated',
          operator: 'after',
          value: '2024-01-01',
          dataType: 'DATE'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"updated" > \'2024-01-01\'')
      })

      it('compiles date between', () => {
        const filter = {
          column: 'event_date',
          operator: 'between',
          value: ['2024-01-01', '2024-12-31'],
          dataType: 'DATE'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"event_date" BETWEEN \'2024-01-01\' AND \'2024-12-31\'')
      })
    })

    describe('Boolean filters', () => {
      it('compiles boolean true values', () => {
        const filter = {
          column: 'active',
          operator: 'is_true',
          value: true,
          dataType: 'BOOLEAN'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"active" = TRUE')
      })

      it('compiles boolean false values', () => {
        const filter = {
          column: 'deleted',
          operator: 'is_false',
          value: false,
          dataType: 'BOOLEAN'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"deleted" = FALSE')
      })
    })

    describe('NULL handling', () => {
      it('handles NULL values correctly', () => {
        const filter = {
          column: 'email',
          operator: 'is_null',
          value: null,
          dataType: 'TEXT'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"email" IS NULL')
      })

      it('handles NOT NULL values', () => {
        const filter = {
          column: 'phone',
          operator: 'is_not_null',
          value: null,
          dataType: 'TEXT'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"phone" IS NOT NULL')
      })
    })

    describe('Special characters and edge cases', () => {
      it('escapes column names with special characters', () => {
        const filter = {
          column: 'user-name',
          operator: 'equals',
          value: 'test',
          dataType: 'TEXT'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"user-name" = \'test\'')
      })

      it('handles empty string values', () => {
        const filter = {
          column: 'notes',
          operator: 'equals',
          value: '',
          dataType: 'TEXT'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"notes" = \'\'')
      })

      it('escapes percent signs in LIKE patterns', () => {
        const filter = {
          column: 'discount',
          operator: 'contains',
          value: '25%',
          dataType: 'TEXT'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"discount" LIKE \'%25\\%%\'')
      })

      it('escapes underscore in LIKE patterns', () => {
        const filter = {
          column: 'code',
          operator: 'contains',
          value: 'test_code',
          dataType: 'TEXT'
        }
        const sql = compileFilterToSQL(filter)
        expect(sql).toBe('"code" LIKE \'%test\\_code%\'')
      })
    })
  })

  describe('Multiple filters combination', () => {
    it('combines multiple filters with AND operator', () => {
      const filters = [
        { column: 'age', operator: 'greater_than', value: 25, dataType: 'NUMBER' },
        { column: 'city', operator: 'equals', value: 'NYC', dataType: 'TEXT' }
      ]
      const sql = compileFiltersToSQL(filters)
      expect(sql).toContain('WHERE "age" > 25\n  AND "city" = \'NYC\'')
    })

    it('handles empty filter array', () => {
      const sql = compileFiltersToSQL([])
      expect(sql).toBe('SELECT * FROM data')
    })

    it('handles single filter', () => {
      const filters = [
        { column: 'status', operator: 'equals', value: 'active', dataType: 'TEXT' }
      ]
      const sql = compileFiltersToSQL(filters)
      expect(sql).toBe('SELECT * FROM data\nWHERE "status" = \'active\'')
    })

    it('combines many filters with proper formatting', () => {
      const filters = [
        { column: 'age', operator: 'greater_than', value: 25, dataType: 'NUMBER' },
        { column: 'city', operator: 'equals', value: 'NYC', dataType: 'TEXT' },
        { column: 'active', operator: 'is_true', value: true, dataType: 'BOOLEAN' },
        { column: 'created', operator: 'after', value: '2024-01-01', dataType: 'DATE' }
      ]
      const sql = compileFiltersToSQL(filters)
      expect(sql).toBe(
        'SELECT * FROM data\n' +
        'WHERE "age" > 25\n' +
        '  AND "city" = \'NYC\'\n' +
        '  AND "active" = TRUE\n' +
        '  AND "created" > \'2024-01-01\''
      )
    })

    it('accepts custom table name', () => {
      const filters = [
        { column: 'id', operator: 'greater_than', value: 100, dataType: 'NUMBER' }
      ]
      const sql = compileFiltersToSQL(filters, { tableName: 'users' })
      expect(sql).toBe('SELECT * FROM users\nWHERE "id" > 100')
    })
  })

  describe('SQL formatting', () => {
    it('formats SQL with proper indentation', () => {
      const filters = [
        { column: 'a', operator: 'equals', value: 1, dataType: 'NUMBER' },
        { column: 'b', operator: 'equals', value: 2, dataType: 'NUMBER' },
        { column: 'c', operator: 'equals', value: 3, dataType: 'NUMBER' }
      ]
      const sql = compileFiltersToSQL(filters, { format: true })
      expect(sql).toBe(
        'SELECT * FROM data\n' +
        'WHERE "a" = 1\n' +
        '  AND "b" = 2\n' +
        '  AND "c" = 3'
      )
    })

    it('generates compact SQL when requested', () => {
      const filters = [
        { column: 'a', operator: 'equals', value: 1, dataType: 'NUMBER' },
        { column: 'b', operator: 'equals', value: 2, dataType: 'NUMBER' }
      ]
      const sql = compileFiltersToSQL(filters, { format: false })
      expect(sql).toBe('SELECT * FROM data WHERE "a" = 1 AND "b" = 2')
    })
  })

  describe('Helper functions', () => {
    describe('escapeSQLString', () => {
      it('escapes single quotes', () => {
        expect(escapeSQLString("O'Brien")).toBe("O''Brien")
      })

      it('handles strings without quotes', () => {
        expect(escapeSQLString('normal string')).toBe('normal string')
      })

      it('escapes multiple quotes', () => {
        expect(escapeSQLString("it's 'quoted'")).toBe("it''s ''quoted''")
      })
    })

    describe('formatSQL', () => {
      it('formats WHERE clauses with indentation', () => {
        const sql = 'SELECT * FROM data WHERE a = 1 AND b = 2 AND c = 3'
        const formatted = formatSQL(sql)
        expect(formatted).toBe(
          'SELECT * FROM data\n' +
          'WHERE a = 1\n' +
          '  AND b = 2\n' +
          '  AND c = 3'
        )
      })
    })
  })
})