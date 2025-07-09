import { describe, it, expect } from 'vitest';
import { parseCsv, getCsvColumns, generateCsv } from '@/services/csv/parser';
import { ApiError } from '@/middleware/error';

describe('CSV Parser Service', () => {
  describe('parseCsv', () => {
    it('should parse simple CSV content', () => {
      const csvContent = 'name,age,city\nJohn,25,NYC\nJane,30,LA';
      const result = parseCsv(csvContent);

      expect(result).toEqual([
        { name: 'John', age: '25', city: 'NYC' },
        { name: 'Jane', age: '30', city: 'LA' }
      ]);
    });

    it('should handle CSV with quoted fields', () => {
      const csvContent = 'name,description\n"John Doe","A person with, comma"\n"Jane Smith","Another person"';
      const result = parseCsv(csvContent);

      expect(result).toEqual([
        { name: 'John Doe', description: 'A person with, comma' },
        { name: 'Jane Smith', description: 'Another person' }
      ]);
    });

    it('should skip empty lines', () => {
      const csvContent = 'name,age\nJohn,25\n\n\nJane,30\n\n';
      const result = parseCsv(csvContent);

      expect(result).toEqual([
        { name: 'John', age: '25' },
        { name: 'Jane', age: '30' }
      ]);
    });

    it('should trim whitespace from fields', () => {
      const csvContent = 'name,age,city\n  John  ,  25  ,  NYC  \n  Jane  ,  30  ,  LA  ';
      const result = parseCsv(csvContent);

      expect(result).toEqual([
        { name: 'John', age: '25', city: 'NYC' },
        { name: 'Jane', age: '30', city: 'LA' }
      ]);
    });

    it('should handle mixed quotes correctly', () => {
      const csvContent = 'name,quote\nJohn,"He said \'hello\'"\nJane,\'She said "goodbye"\'';
      const result = parseCsv(csvContent);

      expect(result).toEqual([
        { name: 'John', quote: "He said 'hello'" },
        { name: 'Jane', quote: 'She said "goodbye"' }
      ]);
    });

    it('should handle special characters', () => {
      const csvContent = 'name,special\nJohn,@#$%^&*()\nJane,!~`[]{}|;:';
      const result = parseCsv(csvContent);

      expect(result).toEqual([
        { name: 'John', special: '@#$%^&*()' },
        { name: 'Jane', special: '!~`[]{}|;:' }
      ]);
    });

    it('should handle Unicode characters', () => {
      const csvContent = 'name,unicode\n张三,中文\nДмитрий,русский\nΓιάννης,ελληνικά';
      const result = parseCsv(csvContent);

      expect(result).toEqual([
        { name: '张三', unicode: '中文' },
        { name: 'Дмитрий', unicode: 'русский' },
        { name: 'Γιάννης', unicode: 'ελληνικά' }
      ]);
    });

    it('should handle empty CSV content', () => {
      const csvContent = '';
      const result = parseCsv(csvContent);

      expect(result).toEqual([]);
    });

    it('should handle CSV with only headers', () => {
      const csvContent = 'name,age,city';
      const result = parseCsv(csvContent);

      expect(result).toEqual([]);
    });

    it('should handle CSV with missing values', () => {
      const csvContent = 'name,age,city\nJohn,,NYC\n,30,\nJane,25,LA';
      const result = parseCsv(csvContent);

      expect(result).toEqual([
        { name: 'John', age: '', city: 'NYC' },
        { name: '', age: '30', city: '' },
        { name: 'Jane', age: '25', city: 'LA' }
      ]);
    });

    it('should handle CSV with varying column counts', () => {
      const csvContent = 'name,age,city\nJohn,25\nJane,30,LA,Extra';
      const result = parseCsv(csvContent);

      expect(result).toEqual([
        { name: 'John', age: '25', city: '' },
        { name: 'Jane', age: '30', city: 'LA' } // Extra column is ignored
      ]);
    });

    it('should throw ApiError for malformed CSV', () => {
      const malformedCsv = 'name,age\n"John,25\nJane",30'; // Unclosed quote
      
      expect(() => parseCsv(malformedCsv)).toThrow(ApiError);
      expect(() => parseCsv(malformedCsv)).toThrow('Could not parse CSV');
    });

    it('should handle large CSV files efficiently', () => {
      // Generate a large CSV with 1000 rows
      const headers = 'id,name,email,age,city,country\n';
      const rows = Array.from({ length: 1000 }, (_, i) => 
        `${i},User${i},user${i}@example.com,${20 + i % 50},City${i % 10},Country${i % 5}`
      ).join('\n');
      const largeCsv = headers + rows;

      const start = performance.now();
      const result = parseCsv(largeCsv);
      const duration = performance.now() - start;

      expect(result).toHaveLength(1000);
      expect(result[0]).toMatchObject({
        id: '0',
        name: 'User0',
        email: 'user0@example.com',
        age: '20',
        city: 'City0',
        country: 'Country0'
      });
      
      // Should parse reasonably quickly (under 100ms for 1000 rows)
      expect(duration).toBeLessThan(100);
    });
  });

  describe('getCsvColumns', () => {
    it('should extract column names from CSV', () => {
      const csvContent = 'name,age,city,country\nJohn,25,NYC,USA';
      const columns = getCsvColumns(csvContent);

      expect(columns).toEqual(['name', 'age', 'city', 'country']);
    });

    it('should return empty array for empty CSV', () => {
      const csvContent = '';
      const columns = getCsvColumns(csvContent);

      expect(columns).toEqual([]);
    });

    it('should return columns even with no data rows', () => {
      const csvContent = 'name,age,city';
      const columns = getCsvColumns(csvContent);

      expect(columns).toEqual([]);
    });

    it('should handle CSV with spaces in column names', () => {
      const csvContent = 'Full Name,Date of Birth,Email Address\nJohn Doe,1990-01-01,john@example.com';
      const columns = getCsvColumns(csvContent);

      expect(columns).toEqual(['Full Name', 'Date of Birth', 'Email Address']);
    });

    it('should handle CSV with special characters in column names', () => {
      const csvContent = 'name,age (years),city/state,@handle\nJohn,25,NYC/NY,@john';
      const columns = getCsvColumns(csvContent);

      expect(columns).toEqual(['name', 'age (years)', 'city/state', '@handle']);
    });

    it('should handle duplicate column names', () => {
      const csvContent = 'name,age,name,city\nJohn,25,Johnny,NYC';
      const columns = getCsvColumns(csvContent);

      // csv-parse typically handles duplicates by adding numbers
      expect(columns).toContain('name');
      expect(columns).toContain('age');
      expect(columns).toContain('city');
    });
  });

  describe('generateCsv', () => {
    it('should generate CSV from records', () => {
      const records = [
        { name: 'John', age: '25', city: 'NYC' },
        { name: 'Jane', age: '30', city: 'LA' }
      ];

      const csv = generateCsv(records);
      expect(csv).toHaveValidCSVStructure();
      
      // Should include headers
      expect(csv).toContain('name,age,city');
      expect(csv).toContain('John,25,NYC');
      expect(csv).toContain('Jane,30,LA');
    });

    it('should generate CSV with specific columns only', () => {
      const records = [
        { name: 'John', age: '25', city: 'NYC', country: 'USA' },
        { name: 'Jane', age: '30', city: 'LA', country: 'USA' }
      ];
      const columns = ['name', 'city'];

      const csv = generateCsv(records, columns);
      expect(csv).toHaveValidCSVStructure();
      
      expect(csv).toContain('name,city');
      expect(csv).toContain('John,NYC');
      expect(csv).toContain('Jane,LA');
      expect(csv).not.toContain('age');
      expect(csv).not.toContain('country');
    });

    it('should handle empty records array', () => {
      const records: Record<string, unknown>[] = [];
      const csv = generateCsv(records);

      expect(csv).toBe('');
    });

    it('should handle records with missing fields', () => {
      const records = [
        { name: 'John', age: '25' },
        { name: 'Jane', city: 'LA' },
        { age: '35', city: 'Chicago' }
      ];

      const csv = generateCsv(records);
      expect(csv).toHaveValidCSVStructure();
      
      // Should include all possible columns
      expect(csv).toContain('name');
      expect(csv).toContain('age');
      expect(csv).toContain('city');
    });

    it('should escape special characters properly', () => {
      const records = [
        { name: 'John "Johnny" Doe', description: 'A person with, commas and "quotes"' },
        { name: 'Jane\nSmith', description: 'Multiline\ndescription' }
      ];

      const csv = generateCsv(records);
      expect(csv).toHaveValidCSVStructure();
      
      // Should handle quotes and commas correctly
      expect(csv).toContain('"John ""Johnny"" Doe"');
      expect(csv).toContain('"A person with, commas and ""quotes"""');
    });

    it('should handle numeric and boolean values', () => {
      const records = [
        { name: 'John', age: 25, score: 98.5, active: true },
        { name: 'Jane', age: 30, score: 87.2, active: false }
      ];

      const csv = generateCsv(records);
      expect(csv).toHaveValidCSVStructure();
      
      expect(csv).toContain('John,25,98.5,true');
      expect(csv).toContain('Jane,30,87.2,false');
    });

    it('should handle null and undefined values', () => {
      const records = [
        { name: 'John', age: null, city: undefined },
        { name: 'Jane', age: '30', city: 'LA' }
      ];

      const csv = generateCsv(records);
      expect(csv).toHaveValidCSVStructure();
      
      // Null and undefined should be converted to empty strings
      expect(csv).toContain('John,,');
    });

    it('should handle large datasets efficiently', () => {
      const records = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `User${i}`,
        email: `user${i}@example.com`,
        age: 20 + (i % 50),
        city: `City${i % 10}`,
        active: i % 2 === 0
      }));

      const start = performance.now();
      const csv = generateCsv(records);
      const duration = performance.now() - start;

      expect(csv).toHaveValidCSVStructure();
      expect(csv.split('\n')).toHaveLength(1002); // 1000 data rows + header + final newline
      
      // Should generate reasonably quickly (under 50ms for 1000 rows)
      expect(duration).toBeLessThan(50);
    });
  });

  describe('Round-trip Processing', () => {
    it('should maintain data integrity through parse -> generate cycle', () => {
      const originalCsv = 'name,age,city\nJohn,25,NYC\nJane,30,LA\nBob,35,Chicago';
      
      const parsed = parseCsv(originalCsv);
      const regenerated = generateCsv(parsed);
      const reparsed = parseCsv(regenerated);

      expect(reparsed).toEqual(parsed);
    });

    it('should handle complex data through round-trip processing', () => {
      const complexRecords = [
        { 
          name: 'John "Johnny" Doe', 
          description: 'A complex, multi-part description with "quotes"',
          score: 98.5,
          active: true,
          notes: 'Line 1\nLine 2\nLine 3'
        },
        {
          name: 'Jane Smith',
          description: 'Another description with, special characters: @#$%',
          score: 87.2,
          active: false,
          notes: ''
        }
      ];

      const csv = generateCsv(complexRecords);
      const parsed = parseCsv(csv);

      // Convert back to compare (numbers and booleans become strings in CSV)
      const expectedRecords = complexRecords.map(record => ({
        name: record.name,
        description: record.description,
        score: String(record.score),
        active: String(record.active),
        notes: record.notes
      }));

      expect(parsed).toEqual(expectedRecords);
    });
  });

  describe('Error Handling', () => {
    it('should provide meaningful error messages for invalid CSV', () => {
      const invalidCsvs = [
        'name,age\n"John,25', // Unclosed quote
        'name,age\nJohn,"25\nJane,30"', // Quote in wrong place
      ];

      for (const invalidCsv of invalidCsvs) {
        expect(() => parseCsv(invalidCsv)).toThrow(ApiError);
        expect(() => parseCsv(invalidCsv)).toThrow(/Could not parse CSV/);
      }
    });

    it('should handle edge cases gracefully', () => {
      // These should not throw errors
      expect(() => parseCsv('\n\n\n')).not.toThrow();
      expect(() => parseCsv(',,,')).not.toThrow();
      expect(() => generateCsv([])).not.toThrow();
      expect(() => getCsvColumns('')).not.toThrow();
    });
  });
});