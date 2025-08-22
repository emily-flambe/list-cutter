/**
 * DataTypeDetector Tests - Ruby's RADICAL SIMPLICITY Testing
 * 
 * Test the core functionality with simple, fast unit tests
 * Focus on performance and accuracy of type detection
 */

import { describe, it, expect } from 'vitest';
import { DataTypeDetector, DataType } from '../data-type-detector';

describe('DataTypeDetector', () => {
  // Ruby's test CSV data samples
  const csvWithMixedTypes = `
name,age,salary,start_date,is_active,category
John Doe,25,50000.50,2023-01-15,true,manager
Jane Smith,30,65000.00,2022-06-01,false,developer
Bob Wilson,28,55000.75,2023-03-20,true,designer
Alice Brown,35,75000.25,2021-11-10,false,manager
  `.trim();

  const csvWithIntegers = `
id,count,score
1,100,85
2,250,92
3,175,78
4,300,95
  `.trim();

  const csvWithCategorical = `
department,status
HR,active
IT,active
Sales,inactive
IT,active
HR,inactive
Sales,active
  `.trim();

  describe('analyzeColumnTypes', () => {
    it('should detect mixed data types correctly', async () => {
      const result = await DataTypeDetector.analyzeColumnTypes(csvWithMixedTypes);
      
      expect(result.columns).toHaveLength(6);
      expect(result.rowsAnalyzed).toBe(4);
      
      // Check specific column types
      const nameColumn = result.columns.find(c => c.name === 'name');
      const ageColumn = result.columns.find(c => c.name === 'age');
      const salaryColumn = result.columns.find(c => c.name === 'salary');
      const dateColumn = result.columns.find(c => c.name === 'start_date');
      const booleanColumn = result.columns.find(c => c.name === 'is_active');
      const categoryColumn = result.columns.find(c => c.name === 'category');
      
      expect(nameColumn?.dataType).toBe(DataType.TEXT);
      expect(ageColumn?.dataType).toBe(DataType.INTEGER);
      expect(salaryColumn?.dataType).toBe(DataType.DECIMAL);
      expect(dateColumn?.dataType).toBe(DataType.DATE);
      expect(booleanColumn?.dataType).toBe(DataType.BOOLEAN);
      expect(categoryColumn?.dataType).toBe(DataType.CATEGORICAL);
    });

    it('should detect integer columns', async () => {
      const result = await DataTypeDetector.analyzeColumnTypes(csvWithIntegers);
      
      expect(result.columns).toHaveLength(3);
      result.columns.forEach(column => {
        expect(column.dataType).toBe(DataType.INTEGER);
        expect(column.confidence).toBeGreaterThan(0.7);
      });
    });

    it('should detect categorical columns', async () => {
      const result = await DataTypeDetector.analyzeColumnTypes(csvWithCategorical);
      
      expect(result.columns).toHaveLength(2);
      
      const deptColumn = result.columns.find(c => c.name === 'department');
      const statusColumn = result.columns.find(c => c.name === 'status');
      
      expect(deptColumn?.dataType).toBe(DataType.CATEGORICAL);
      expect(statusColumn?.dataType).toBe(DataType.CATEGORICAL);
    });

    it('should handle empty CSV', async () => {
      const result = await DataTypeDetector.analyzeColumnTypes('');
      
      expect(result.columns).toHaveLength(0);
      expect(result.rowsAnalyzed).toBe(0);
      expect(result.fileInfo.totalRows).toBe(0);
      expect(result.fileInfo.totalColumns).toBe(0);
    });

    it('should complete analysis quickly', async () => {
      const startTime = Date.now();
      await DataTypeDetector.analyzeColumnTypes(csvWithMixedTypes);
      const duration = Date.now() - startTime;
      
      // Ruby's performance target: <500ms for small files
      expect(duration).toBeLessThan(500);
    });
  });

  describe('getFilterSuggestions', () => {
    it('should provide appropriate filter suggestions for each data type', () => {
      const columns = [
        { name: 'age', dataType: DataType.INTEGER, confidence: 0.9, sampleValues: ['25', '30'], uniqueValueCount: 2, nullCount: 0, totalSamples: 4 },
        { name: 'salary', dataType: DataType.DECIMAL, confidence: 0.9, sampleValues: ['50000.50'], uniqueValueCount: 4, nullCount: 0, totalSamples: 4 },
        { name: 'start_date', dataType: DataType.DATE, confidence: 0.8, sampleValues: ['2023-01-15'], uniqueValueCount: 4, nullCount: 0, totalSamples: 4 },
        { name: 'is_active', dataType: DataType.BOOLEAN, confidence: 1.0, sampleValues: ['true', 'false'], uniqueValueCount: 2, nullCount: 0, totalSamples: 4 },
        { name: 'category', dataType: DataType.CATEGORICAL, confidence: 0.8, sampleValues: ['manager', 'developer'], uniqueValueCount: 3, nullCount: 0, totalSamples: 4 },
        { name: 'notes', dataType: DataType.TEXT, confidence: 0.5, sampleValues: ['Some text'], uniqueValueCount: 4, nullCount: 0, totalSamples: 4 }
      ];

      const suggestions = DataTypeDetector.getFilterSuggestions(columns);

      expect(suggestions['age']).toContain('range');
      expect(suggestions['age']).toContain('greater_than');
      expect(suggestions['age']).toContain('less_than');

      expect(suggestions['salary']).toContain('range');
      expect(suggestions['salary']).toContain('greater_than');

      expect(suggestions['start_date']).toContain('date_range');
      expect(suggestions['start_date']).toContain('before');
      expect(suggestions['start_date']).toContain('after');

      expect(suggestions['is_active']).toContain('equals');
      expect(suggestions['is_active']).toContain('is_true');
      expect(suggestions['is_active']).toContain('is_false');

      expect(suggestions['category']).toContain('equals');
      expect(suggestions['category']).toContain('in_list');

      expect(suggestions['notes']).toContain('contains');
      expect(suggestions['notes']).toContain('starts_with');
      expect(suggestions['notes']).toContain('ends_with');
    });
  });

  describe('Performance Tests', () => {
    const generateLargeCsv = (rows: number) => {
      let csv = 'id,name,value,date,flag\n';
      for (let i = 1; i <= rows; i++) {
        csv += `${i},User${i},${i * 10.5},2023-${String(i % 12 + 1).padStart(2, '0')}-01,${i % 2 === 0}\n`;
      }
      return csv;
    };

    it('should handle 1000 rows efficiently', async () => {
      const largeCsv = generateLargeCsv(1000);
      
      const startTime = Date.now();
      const result = await DataTypeDetector.analyzeColumnTypes(largeCsv);
      const duration = Date.now() - startTime;

      expect(result.columns).toHaveLength(5);
      expect(result.rowsAnalyzed).toBe(1000);
      
      // Ruby's performance target: <500ms for 1000 rows
      expect(duration).toBeLessThan(500);
      
    });
  });
});