import { describe, it, expect } from 'vitest';
import { parseWhereClause, applyFilters } from '@/services/csv/filter';
import { ApiError } from '@/middleware/error';

describe('CSV Filter Service', () => {
  describe('parseWhereClause', () => {
    describe('Basic Operators', () => {
      it('should handle equality operators', () => {
        expect(parseWhereClause('25', '= 25')).toBe(true);
        expect(parseWhereClause('25', '== 25')).toBe(true);
        expect(parseWhereClause('25', '= 30')).toBe(false);
        expect(parseWhereClause('John', '= John')).toBe(true);
        expect(parseWhereClause('John', '= Jane')).toBe(false);
      });

      it('should handle inequality operators', () => {
        expect(parseWhereClause('25', '!= 30')).toBe(true);
        expect(parseWhereClause('25', '!= 25')).toBe(false);
        expect(parseWhereClause('John', '!= Jane')).toBe(true);
        expect(parseWhereClause('John', '!= John')).toBe(false);
      });

      it('should handle comparison operators for numbers', () => {
        expect(parseWhereClause('25', '> 20')).toBe(true);
        expect(parseWhereClause('25', '> 30')).toBe(false);
        expect(parseWhereClause('25', '< 30')).toBe(true);
        expect(parseWhereClause('25', '< 20')).toBe(false);
        expect(parseWhereClause('25', '>= 25')).toBe(true);
        expect(parseWhereClause('25', '>= 30')).toBe(false);
        expect(parseWhereClause('25', '<= 25')).toBe(true);
        expect(parseWhereClause('25', '<= 20')).toBe(false);
      });

      it('should handle decimal numbers', () => {
        expect(parseWhereClause('25.5', '> 25')).toBe(true);
        expect(parseWhereClause('25.5', '< 26')).toBe(true);
        expect(parseWhereClause('25.5', '= 25.5')).toBe(true);
        expect(parseWhereClause('25.5', '!= 25.6')).toBe(true);
      });

      it('should handle negative numbers', () => {
        expect(parseWhereClause('-10', '< 0')).toBe(true);
        expect(parseWhereClause('-10', '> -15')).toBe(true);
        expect(parseWhereClause('-10', '= -10')).toBe(true);
        expect(parseWhereClause('-10', '!= -5')).toBe(true);
      });
    });

    describe('BETWEEN Operator', () => {
      it('should handle BETWEEN clauses correctly', () => {
        expect(parseWhereClause('25', 'BETWEEN 20 AND 30')).toBe(true);
        expect(parseWhereClause('25', 'BETWEEN 30 AND 40')).toBe(false);
        expect(parseWhereClause('25', 'BETWEEN 25 AND 25')).toBe(true);
        expect(parseWhereClause('25', 'between 20 and 30')).toBe(true); // Case insensitive
      });

      it('should handle BETWEEN with decimals', () => {
        expect(parseWhereClause('25.5', 'BETWEEN 25.0 AND 26.0')).toBe(true);
        expect(parseWhereClause('25.5', 'BETWEEN 26.0 AND 27.0')).toBe(false);
      });

      it('should handle BETWEEN edge cases', () => {
        expect(parseWhereClause('20', 'BETWEEN 20 AND 30')).toBe(true); // Lower bound inclusive
        expect(parseWhereClause('30', 'BETWEEN 20 AND 30')).toBe(true); // Upper bound inclusive
        expect(parseWhereClause('19', 'BETWEEN 20 AND 30')).toBe(false);
        expect(parseWhereClause('31', 'BETWEEN 20 AND 30')).toBe(false);
      });

      it('should reject non-numeric values for BETWEEN', () => {
        expect(parseWhereClause('John', 'BETWEEN 20 AND 30')).toBe(false);
      });

      it('should throw error for malformed BETWEEN clauses', () => {
        expect(() => parseWhereClause('25', 'BETWEEN 20')).toThrow(ApiError);
        expect(() => parseWhereClause('25', 'BETWEEN')).toThrow(ApiError);
        expect(() => parseWhereClause('25', 'BETWEEN 20 AND')).toThrow(ApiError);
        expect(() => parseWhereClause('25', 'BETWEEN AND 30')).toThrow(ApiError);
      });
    });

    describe('IN Operator', () => {
      it('should handle IN clauses correctly', () => {
        expect(parseWhereClause('John', 'IN (John, Jane, Bob)')).toBe(true);
        expect(parseWhereClause('Alice', 'IN (John, Jane, Bob)')).toBe(false);
        expect(parseWhereClause('john', 'in (John, Jane, Bob)')).toBe(false); // Case sensitive
      });

      it('should handle IN with quotes', () => {
        expect(parseWhereClause('John', 'IN ("John", "Jane", "Bob")')).toBe(true);
        expect(parseWhereClause('John', "IN ('John', 'Jane', 'Bob')")).toBe(true);
        expect(parseWhereClause('Alice', 'IN ("John", "Jane", "Bob")')).toBe(false);
      });

      it('should handle IN with numbers', () => {
        expect(parseWhereClause('25', 'IN (20, 25, 30)')).toBe(true);
        expect(parseWhereClause('35', 'IN (20, 25, 30)')).toBe(false);
        expect(parseWhereClause('25', 'IN ("20", "25", "30")')).toBe(true);
      });

      it('should handle IN with mixed quotes and no quotes', () => {
        expect(parseWhereClause('John', 'IN (John, "Jane", \'Bob\')')).toBe(true);
        expect(parseWhereClause('Jane', 'IN (John, "Jane", \'Bob\')')).toBe(true);
        expect(parseWhereClause('Bob', 'IN (John, "Jane", \'Bob\')')).toBe(true);
      });

      it('should handle IN with spaces and special characters', () => {
        expect(parseWhereClause('New York', 'IN ("New York", "Los Angeles")')).toBe(true);
        expect(parseWhereClause('user@example.com', 'IN ("user@example.com", "admin@example.com")')).toBe(true);
      });

      it('should handle empty IN clauses', () => {
        expect(parseWhereClause('John', 'IN ()')).toBe(false);
        expect(parseWhereClause('John', 'IN("")')).toBe(false);
      });
    });

    describe('String Comparisons', () => {
      it('should handle string equality with quotes', () => {
        expect(parseWhereClause('John', '= "John"')).toBe(true);
        expect(parseWhereClause('John', "= 'John'")).toBe(true);
        expect(parseWhereClause('John', '= "Jane"')).toBe(false);
      });

      it('should handle strings with spaces', () => {
        expect(parseWhereClause('John Doe', '= "John Doe"')).toBe(true);
        expect(parseWhereClause('John Doe', '= John Doe')).toBe(true);
        expect(parseWhereClause('John Doe', '!= "Jane Doe"')).toBe(true);
      });

      it('should handle strings with special characters', () => {
        expect(parseWhereClause('user@example.com', '= "user@example.com"')).toBe(true);
        expect(parseWhereClause('$100', '= "$100"')).toBe(true);
        expect(parseWhereClause('50%', '= "50%"')).toBe(true);
      });

      it('should not apply numeric operators to non-numeric strings', () => {
        expect(parseWhereClause('John', '> Jane')).toBe(true); // Falls back to default true
        expect(parseWhereClause('John', '< Jane')).toBe(true); // Falls back to default true
        expect(parseWhereClause('John', '>= Jane')).toBe(true); // Falls back to default true
        expect(parseWhereClause('John', '<= Jane')).toBe(true); // Falls back to default true
      });
    });

    describe('Edge Cases and Error Handling', () => {
      it('should return true for empty conditions', () => {
        expect(parseWhereClause('any value', '')).toBe(true);
        expect(parseWhereClause('any value', '   ')).toBe(true);
      });

      it('should handle whitespace correctly', () => {
        expect(parseWhereClause('  25  ', '  =   25  ')).toBe(true);
        expect(parseWhereClause('John', '  =  John  ')).toBe(true);
        expect(parseWhereClause('25', '  >  20  ')).toBe(true);
      });

      it('should throw ApiError for invalid operator format', () => {
        expect(() => parseWhereClause('25', 'invalid condition')).toThrow(ApiError);
        expect(() => parseWhereClause('25', '25')).toThrow(ApiError); // Missing operator
        expect(() => parseWhereClause('25', '> ')).toThrow(ApiError); // Missing value
      });

      it('should handle zero values correctly', () => {
        expect(parseWhereClause('0', '= 0')).toBe(true);
        expect(parseWhereClause('0', '> -1')).toBe(true);
        expect(parseWhereClause('0', '< 1')).toBe(true);
        expect(parseWhereClause('0', 'BETWEEN -1 AND 1')).toBe(true);
      });

      it('should handle boolean-like strings', () => {
        expect(parseWhereClause('true', '= true')).toBe(true);
        expect(parseWhereClause('false', '= false')).toBe(true);
        expect(parseWhereClause('true', '!= false')).toBe(true);
      });

      it('should handle numeric strings with leading zeros', () => {
        expect(parseWhereClause('007', '= 7')).toBe(true);
        expect(parseWhereClause('0025', '= 25')).toBe(true);
        expect(parseWhereClause('0025', '> 20')).toBe(true);
      });
    });
  });

  describe('applyFilters', () => {
    const testRecords = [
      { name: 'John', age: '25', city: 'NYC', salary: '50000' },
      { name: 'Jane', age: '30', city: 'LA', salary: '75000' },
      { name: 'Bob', age: '35', city: 'NYC', salary: '60000' },
      { name: 'Alice', age: '28', city: 'Chicago', salary: '65000' },
      { name: 'Charlie', age: '42', city: 'LA', salary: '80000' }
    ];

    it('should filter records with simple equality conditions', () => {
      const filters = { city: '= NYC' };
      const result = applyFilters(testRecords, filters);

      expect(result).toHaveLength(2);
      expect(result.every(record => record.city === 'NYC')).toBe(true);
      expect(result.map(r => r.name)).toEqual(['John', 'Bob']);
    });

    it('should filter records with numeric comparisons', () => {
      const filters = { age: '> 30' };
      const result = applyFilters(testRecords, filters);

      expect(result).toHaveLength(2);
      expect(result.map(r => r.name)).toEqual(['Bob', 'Charlie']);
    });

    it('should filter records with multiple conditions (AND logic)', () => {
      const filters = { 
        city: '= NYC', 
        age: '>= 30' 
      };
      const result = applyFilters(testRecords, filters);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bob');
    });

    it('should filter records with BETWEEN conditions', () => {
      const filters = { age: 'BETWEEN 28 AND 35' };
      const result = applyFilters(testRecords, filters);

      expect(result).toHaveLength(3);
      expect(result.map(r => r.name)).toEqual(['Jane', 'Bob', 'Alice']);
    });

    it('should filter records with IN conditions', () => {
      const filters = { city: 'IN (NYC, Chicago)' };
      const result = applyFilters(testRecords, filters);

      expect(result).toHaveLength(3);
      expect(result.map(r => r.name)).toEqual(['John', 'Bob', 'Alice']);
    });

    it('should handle complex multi-column filtering', () => {
      const filters = {
        age: '>= 28',
        salary: '> 60000',
        city: 'IN (LA, Chicago)'
      };
      const result = applyFilters(testRecords, filters);

      expect(result).toHaveLength(2);
      expect(result.map(r => r.name)).toEqual(['Jane', 'Charlie']);
    });

    it('should return all records when no filters are applied', () => {
      const filters = {};
      const result = applyFilters(testRecords, filters);

      expect(result).toHaveLength(testRecords.length);
      expect(result).toEqual(testRecords);
    });

    it('should return empty array when no records match', () => {
      const filters = { age: '> 100' };
      const result = applyFilters(testRecords, filters);

      expect(result).toHaveLength(0);
    });

    it('should handle filters for non-existent columns gracefully', () => {
      const filters = { nonexistent_column: '= value' };
      const result = applyFilters(testRecords, filters);

      // Should return all records since the column doesn't exist
      expect(result).toHaveLength(testRecords.length);
    });

    it('should handle records with missing values', () => {
      const recordsWithMissing = [
        { name: 'John', age: '25', city: 'NYC' },
        { name: 'Jane', city: 'LA' }, // Missing age
        { name: 'Bob', age: '35' }, // Missing city
        { age: '28', city: 'Chicago' } // Missing name
      ];

      const filters = { age: '>= 25' };
      const result = applyFilters(recordsWithMissing, filters);

      expect(result).toHaveLength(3); // John, Bob, and the unnamed record
      expect(result.map(r => r.name || 'unnamed')).toEqual(['John', 'Bob', 'unnamed']);
    });

    it('should handle invalid filter conditions gracefully', () => {
      const filters = { age: 'invalid condition' };
      const result = applyFilters(testRecords, filters);

      // Should filter out records when condition parsing fails
      expect(result).toHaveLength(0);
    });

    it('should be case sensitive for string comparisons', () => {
      const filters = { name: '= john' }; // lowercase
      const result = applyFilters(testRecords, filters);

      expect(result).toHaveLength(0); // 'John' !== 'john'
    });

    it('should handle empty records array', () => {
      const filters = { age: '> 25' };
      const result = applyFilters([], filters);

      expect(result).toHaveLength(0);
    });

    it('should preserve original record structure', () => {
      const filters = { name: '= John' };
      const result = applyFilters(testRecords, filters);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'John',
        age: '25',
        city: 'NYC',
        salary: '50000'
      });
    });

    describe('Performance Tests', () => {
      it('should filter large datasets efficiently', () => {
        // Create a large dataset
        const largeRecords = Array.from({ length: 10000 }, (_, i) => ({
          id: String(i),
          name: `User${i}`,
          age: String(20 + (i % 50)),
          city: `City${i % 10}`,
          department: `Dept${i % 5}`,
          salary: String(30000 + (i % 50000))
        }));

        const filters = {
          age: '> 30',
          department: 'IN (Dept1, Dept3)',
          salary: 'BETWEEN 40000 AND 60000'
        };

        const start = performance.now();
        const result = applyFilters(largeRecords, filters);
        const duration = performance.now() - start;

        expect(result.length).toBeGreaterThan(0);
        expect(duration).toBeLessThan(100); // Should complete within 100ms

        // Verify filtering accuracy on a subset
        expect(result.every(record => 
          parseInt(record.age) > 30 &&
          ['Dept1', 'Dept3'].includes(record.department) &&
          parseInt(record.salary) >= 40000 &&
          parseInt(record.salary) <= 60000
        )).toBe(true);
      });

      it('should handle many filter conditions efficiently', () => {
        const filters = {
          name: 'IN (John, Jane, Bob)',
          age: '>= 25',
          city: 'IN (NYC, LA)',
          salary: '> 50000'
        };

        const start = performance.now();
        const result = applyFilters(testRecords, filters);
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(10); // Should be very fast for small datasets
        expect(result).toHaveLength(1); // Only Jane should match all conditions
        expect(result[0].name).toBe('Jane');
      });
    });

    describe('Complex Filtering Scenarios', () => {
      it('should handle filtering with quoted values containing special characters', () => {
        const specialRecords = [
          { name: 'O\'Connor', email: 'user@domain.com', title: 'Sr. Engineer' },
          { name: 'Smith, Jr.', email: 'admin@domain.org', title: 'Manager' },
          { name: 'Johnson', email: 'test@domain.net', title: 'Engineer' }
        ];

        const filters = { name: '= "O\'Connor"' };
        const result = applyFilters(specialRecords, filters);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('O\'Connor');
      });

      it('should handle numeric strings vs actual numbers consistently', () => {
        const mixedRecords = [
          { id: '001', score: '85.5', rank: '3' },
          { id: '002', score: '92.0', rank: '1' },
          { id: '003', score: '78.2', rank: '5' }
        ];

        const filters = { score: '> 80' };
        const result = applyFilters(mixedRecords, filters);

        expect(result).toHaveLength(2);
        expect(result.map(r => r.id)).toEqual(['001', '002']);
      });

      it('should handle edge cases with floating point precision', () => {
        const precisionRecords = [
          { value: '0.1' },
          { value: '0.2' },
          { value: '0.3' }
        ];

        const filters = { value: '>= 0.2' };
        const result = applyFilters(precisionRecords, filters);

        expect(result).toHaveLength(2);
        expect(result.map(r => r.value)).toEqual(['0.2', '0.3']);
      });
    });
  });
});