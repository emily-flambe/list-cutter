import { describe, it, expect } from 'vitest'
import {
  explainSQL,
  explainFilter,
  estimateRowCount,
  classifyComplexity,
  generatePerformanceHints,
  explainOperator
} from '../sqlExplainer'

describe('SQL Natural Language Explainer [phase-1]', () => {
  describe('Basic SQL explanations', () => {
    it('explains simple equality in plain English', () => {
      const sql = '"age" = 25'
      const explanation = explainSQL(sql)
      expect(explanation).toBe('Records where age equals 25')
    })

    it('explains comparison operators clearly', () => {
      expect(explainSQL('"price" > 100')).toBe('Records where price is greater than 100')
      expect(explainSQL('"score" < 50')).toBe('Records where score is less than 50')
      expect(explainSQL('"rating" >= 4')).toBe('Records where rating is greater than or equal to 4')
      expect(explainSQL('"count" <= 10')).toBe('Records where count is less than or equal to 10')
    })

    it('explains LIKE patterns', () => {
      expect(explainSQL('"email" LIKE \'%@gmail.com\'')).toBe('Records where email ends with "@gmail.com"')
      expect(explainSQL('"name" LIKE \'John%\'')).toBe('Records where name starts with "John"')
      expect(explainSQL('"description" LIKE \'%product%\'')).toBe('Records where description contains "product"')
    })

    it('explains NOT LIKE patterns', () => {
      expect(explainSQL('"email" NOT LIKE \'%@spam.com\'')).toBe('Records where email does not end with "@spam.com"')
      expect(explainSQL('"notes" NOT LIKE \'%confidential%\'')).toBe('Records where notes does not contain "confidential"')
    })

    it('explains NULL checks', () => {
      expect(explainSQL('"phone" IS NULL')).toBe('Records where phone is empty')
      expect(explainSQL('"email" IS NOT NULL')).toBe('Records where email is not empty')
    })

    it('explains BETWEEN operator', () => {
      expect(explainSQL('"age" BETWEEN 18 AND 65')).toBe('Records where age is between 18 and 65')
      expect(explainSQL('"price" BETWEEN 10.99 AND 99.99')).toBe('Records where price is between 10.99 and 99.99')
      expect(explainSQL('"date" BETWEEN \'2024-01-01\' AND \'2024-12-31\'')).toBe('Records where date is between 2024-01-01 and 2024-12-31')
    })

    it('explains IN operator', () => {
      expect(explainSQL('"status" IN (\'active\', \'pending\')')).toBe('Records where status is one of: active, pending')
      expect(explainSQL('"priority" IN (1, 2, 3)')).toBe('Records where priority is one of: 1, 2, 3')
    })

    it('explains NOT IN operator', () => {
      expect(explainSQL('"status" NOT IN (\'deleted\', \'archived\')')).toBe('Records where status is not one of: deleted, archived')
    })
  })

  describe('Complex SQL explanations', () => {
    it('explains complex conditions with proper grammar', () => {
      const sql = '"age" > 25 AND "city" = \'NYC\''
      const explanation = explainSQL(sql)
      expect(explanation).toBe('Records where age is greater than 25 AND city equals NYC')
    })

    it('explains OR conditions', () => {
      const sql = '"status" = \'active\' OR "status" = \'pending\''
      const explanation = explainSQL(sql)
      expect(explanation).toBe('Records where status equals active OR status equals pending')
    })

    it('explains mixed AND/OR conditions with parentheses', () => {
      const sql = '("age" > 25 AND "city" = \'NYC\') OR "vip" = TRUE'
      const explanation = explainSQL(sql)
      expect(explanation).toBe('Records where (age is greater than 25 AND city equals NYC) OR vip equals TRUE')
    })

    it('explains multiple AND conditions', () => {
      const sql = '"age" > 25 AND "city" = \'NYC\' AND "active" = TRUE'
      const explanation = explainSQL(sql)
      expect(explanation).toBe('Records where age is greater than 25 AND city equals NYC AND active equals TRUE')
    })

    it('handles complex nested conditions', () => {
      const sql = '("age" > 25 OR "vip" = TRUE) AND ("city" = \'NYC\' OR "city" = \'LA\')'
      const explanation = explainSQL(sql)
      expect(explanation).toContain('age is greater than 25 OR vip equals TRUE')
      expect(explanation).toContain('city equals NYC OR city equals LA')
    })
  })

  describe('Filter explanations', () => {
    it('explains individual filter objects', () => {
      const filter = {
        column: 'age',
        operator: 'greater_than',
        value: 25,
        dataType: 'NUMBER'
      }
      const explanation = explainFilter(filter)
      expect(explanation).toBe('age is greater than 25')
    })

    it('explains text filter operations', () => {
      expect(explainFilter({
        column: 'email',
        operator: 'contains',
        value: '@gmail',
        dataType: 'TEXT'
      })).toBe('email contains "@gmail"')

      expect(explainFilter({
        column: 'name',
        operator: 'starts_with',
        value: 'John',
        dataType: 'TEXT'
      })).toBe('name starts with "John"')

      expect(explainFilter({
        column: 'url',
        operator: 'ends_with',
        value: '.com',
        dataType: 'TEXT'
      })).toBe('url ends with ".com"')
    })

    it('explains date filter operations', () => {
      expect(explainFilter({
        column: 'created',
        operator: 'after',
        value: '2024-01-01',
        dataType: 'DATE'
      })).toBe('created is after 2024-01-01')

      expect(explainFilter({
        column: 'expires',
        operator: 'before',
        value: '2024-12-31',
        dataType: 'DATE'
      })).toBe('expires is before 2024-12-31')

      expect(explainFilter({
        column: 'event_date',
        operator: 'between',
        value: ['2024-01-01', '2024-12-31'],
        dataType: 'DATE'
      })).toBe('event_date is between 2024-01-01 and 2024-12-31')
    })

    it('explains boolean filters', () => {
      expect(explainFilter({
        column: 'active',
        operator: 'is_true',
        value: true,
        dataType: 'BOOLEAN'
      })).toBe('active is true')

      expect(explainFilter({
        column: 'deleted',
        operator: 'is_false',
        value: false,
        dataType: 'BOOLEAN'
      })).toBe('deleted is false')
    })
  })

  describe('Operator explanations', () => {
    it('provides human-readable operator descriptions', () => {
      expect(explainOperator('equals')).toBe('equals')
      expect(explainOperator('greater_than')).toBe('is greater than')
      expect(explainOperator('less_than')).toBe('is less than')
      expect(explainOperator('contains')).toBe('contains')
      expect(explainOperator('starts_with')).toBe('starts with')
      expect(explainOperator('ends_with')).toBe('ends with')
      expect(explainOperator('between')).toBe('is between')
      expect(explainOperator('is_null')).toBe('is empty')
      expect(explainOperator('is_not_null')).toBe('is not empty')
    })
  })

  describe('Performance estimation', () => {
    it('estimates row counts for simple filters', () => {
      const filter = { 
        column: 'age', 
        operator: 'greater_than', 
        value: 25,
        dataType: 'NUMBER'
      }
      const stats = { 
        totalRows: 1000,
        columnStats: {
          age: {
            min: 18,
            max: 80,
            avg: 35,
            distribution: 'normal'
          }
        }
      }
      const estimate = estimateRowCount(filter, stats)
      expect(estimate).toBeGreaterThan(0)
      expect(estimate).toBeLessThan(1000)
      expect(estimate).toBeCloseTo(700, -2) // Approximately 70% of records
    })

    it('estimates row counts for equality filters', () => {
      const filter = {
        column: 'status',
        operator: 'equals',
        value: 'active',
        dataType: 'TEXT'
      }
      const stats = {
        totalRows: 1000,
        columnStats: {
          status: {
            uniqueValues: 5,
            topValues: {
              'active': 400,
              'inactive': 300,
              'pending': 200,
              'deleted': 50,
              'archived': 50
            }
          }
        }
      }
      const estimate = estimateRowCount(filter, stats)
      expect(estimate).toBe(400)
    })

    it('estimates row counts for LIKE patterns', () => {
      const filter = {
        column: 'email',
        operator: 'ends_with',
        value: '@gmail.com',
        dataType: 'TEXT'
      }
      const stats = {
        totalRows: 1000,
        columnStats: {
          email: {
            patterns: {
              '@gmail.com': 0.4,
              '@yahoo.com': 0.2,
              '@outlook.com': 0.3,
              'other': 0.1
            }
          }
        }
      }
      const estimate = estimateRowCount(filter, stats)
      expect(estimate).toBe(400)
    })

    it('provides conservative estimates when stats are incomplete', () => {
      const filter = {
        column: 'unknown_column',
        operator: 'equals',
        value: 'test',
        dataType: 'TEXT'
      }
      const stats = {
        totalRows: 1000,
        columnStats: {}
      }
      const estimate = estimateRowCount(filter, stats)
      expect(estimate).toBeGreaterThan(0)
      expect(estimate).toBeLessThanOrEqual(1000)
    })
  })

  describe('Query complexity classification', () => {
    it('classifies query complexity accurately', () => {
      const simple = '"age" > 25'
      const moderate = '"age" > 25 AND "city" = \'NYC\''
      const complex = '"age" > 25 AND "city" IN (\'NYC\', \'LA\') OR ("status" = \'active\' AND "vip" = TRUE)'
      
      expect(classifyComplexity(simple)).toBe('simple')
      expect(classifyComplexity(moderate)).toBe('moderate')
      expect(classifyComplexity(complex)).toBe('complex')
    })

    it('considers number of conditions', () => {
      const oneCondition = '"a" = 1'
      const twoConditions = '"a" = 1 AND "b" = 2'
      const fiveConditions = '"a" = 1 AND "b" = 2 AND "c" = 3 AND "d" = 4 AND "e" = 5'
      
      expect(classifyComplexity(oneCondition)).toBe('simple')
      expect(classifyComplexity(twoConditions)).toBe('simple')
      expect(classifyComplexity(fiveConditions)).toBe('complex')
    })

    it('considers presence of OR operators', () => {
      const withOr = '"a" = 1 OR "b" = 2'
      const withoutOr = '"a" = 1 AND "b" = 2'
      
      expect(classifyComplexity(withOr).complexity).toBeGreaterThan(
        classifyComplexity(withoutOr).complexity
      )
    })

    it('considers subqueries and functions', () => {
      const withFunction = 'UPPER("name") = \'JOHN\''
      const withSubquery = '"id" IN (SELECT id FROM other_table)'
      
      expect(classifyComplexity(withFunction)).not.toBe('simple')
      expect(classifyComplexity(withSubquery)).toBe('complex')
    })
  })

  describe('Performance hints', () => {
    it('generates performance hints for queries', () => {
      const filter = {
        column: 'email',
        operator: 'contains',
        value: '@gmail',
        dataType: 'TEXT'
      }
      const hints = generatePerformanceHints(filter)
      
      expect(hints).toContain('Consider using an index on "email"')
      expect(hints).toContain('LIKE patterns with leading wildcards cannot use indexes effectively')
    })

    it('suggests indexes for frequently filtered columns', () => {
      const filter = {
        column: 'user_id',
        operator: 'equals',
        value: 123,
        dataType: 'NUMBER'
      }
      const hints = generatePerformanceHints(filter, { isFrequent: true })
      
      expect(hints).toContain('This column is frequently filtered - ensure it has an index')
    })

    it('warns about full table scans', () => {
      const filter = {
        column: 'notes',
        operator: 'contains',
        value: 'important',
        dataType: 'TEXT'
      }
      const hints = generatePerformanceHints(filter, { hasIndex: false })
      
      expect(hints).toContain('This query may result in a full table scan')
    })

    it('provides optimization suggestions for date ranges', () => {
      const filter = {
        column: 'created_date',
        operator: 'between',
        value: ['2020-01-01', '2024-12-31'],
        dataType: 'DATE'
      }
      const hints = generatePerformanceHints(filter)
      
      expect(hints).toContain('Date range queries benefit from indexes')
      expect(hints).toContain('Consider partitioning by date for large datasets')
    })
  })
})