/**
 * Tests for CrosstabProcessor
 */

import { describe, it, expect } from 'vitest';
import { CrosstabProcessor } from '../crosstab-processor';

describe('CrosstabProcessor', () => {
  const sampleCSV = `Gender,Response,Age
Male,Yes,25
Female,No,30
Male,Yes,35
Female,Yes,28
Male,No,45`;

  describe('extractFields', () => {
    it('should extract field names from CSV header', () => {
      const result = CrosstabProcessor.extractFields(sampleCSV);
      
      expect(result.fields).toEqual(['Gender', 'Response', 'Age']);
      expect(result.rowCount).toBe(5); // 5 data rows
    });

    it('should handle empty CSV', () => {
      const result = CrosstabProcessor.extractFields('');
      
      expect(result.fields).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('should handle CSV with quoted fields', () => {
      const quotedCSV = `"First Name","Last Name","Email Address"
"John","Doe","john@example.com"`;
      
      const result = CrosstabProcessor.extractFields(quotedCSV);
      
      expect(result.fields).toEqual(['First Name', 'Last Name', 'Email Address']);
      expect(result.rowCount).toBe(1);
    });
  });

  describe('generateCrosstab', () => {
    it('should generate correct crosstab data', async () => {
      const result = await CrosstabProcessor.generateCrosstab(sampleCSV, 'Gender', 'Response');
      
      expect(result.crosstab).toEqual({
        'Male': { 'Yes': 2, 'No': 1 },
        'Female': { 'Yes': 1, 'No': 1 }
      });
      
      expect(result.rowTotals).toEqual({
        'Male': 3,
        'Female': 2
      });
      
      expect(result.columnTotals).toEqual({
        'Yes': 3,
        'No': 2
      });
      
      expect(result.grandTotal).toBe(5);
      expect(result.rowVariable).toBe('Gender');
      expect(result.columnVariable).toBe('Response');
    });

    it('should handle missing values', async () => {
      const csvWithMissing = `Gender,Response
Male,Yes
,No
Female,
Male,Yes`;
      
      const result = await CrosstabProcessor.generateCrosstab(csvWithMissing, 'Gender', 'Response');
      
      expect(result.crosstab).toEqual({
        'Male': { 'Yes': 2, '(empty)': 0, 'No': 0 },
        '(empty)': { 'Yes': 0, '(empty)': 0, 'No': 1 },
        'Female': { 'Yes': 0, '(empty)': 1, 'No': 0 }
      });
      
      expect(result.grandTotal).toBe(4);
    });

    it('should throw error for same variable names', async () => {
      await expect(
        CrosstabProcessor.generateCrosstab(sampleCSV, 'Gender', 'Gender')
      ).rejects.toThrow('Row and column variables must be different');
    });

    it('should throw error for non-existent variables', async () => {
      await expect(
        CrosstabProcessor.generateCrosstab(sampleCSV, 'NonExistent', 'Response')
      ).rejects.toThrow('Row variable "NonExistent" not found');
    });
  });

  describe('generateExportCSV', () => {
    it('should generate properly formatted export CSV', async () => {
      const crosstabData = await CrosstabProcessor.generateCrosstab(sampleCSV, 'Gender', 'Response');
      const exportCSV = CrosstabProcessor.generateExportCSV(crosstabData);
      
      const expectedLines = [
        'Gender/Response,No,Yes,Total',
        'Female,1,1,2',
        'Male,1,2,3',
        'Total,2,3,5'
      ];
      
      expect(exportCSV).toBe(expectedLines.join('\n'));
    });

    it('should handle fields with commas', async () => {
      const csvWithCommas = `"Location, State",Response
"New York, NY",Yes
"Los Angeles, CA",No`;
      
      const crosstabData = await CrosstabProcessor.generateCrosstab(csvWithCommas, 'Location, State', 'Response');
      const exportCSV = CrosstabProcessor.generateExportCSV(crosstabData);
      
      expect(exportCSV).toContain('"Location, State/Response"');
      expect(exportCSV).toContain('"Los Angeles, CA"');
      expect(exportCSV).toContain('"New York, NY"');
    });
  });

  describe('percentage calculations', () => {
    it('should calculate row percentages correctly', async () => {
      const result = await CrosstabProcessor.generateCrosstab(sampleCSV, 'Gender', 'Response');
      
      // Male: Yes=2/3=66.67%, No=1/3=33.33%
      expect(result.rowPercentages['Male']['Yes']).toBeCloseTo(66.67, 2);
      expect(result.rowPercentages['Male']['No']).toBeCloseTo(33.33, 2);
      
      // Female: Yes=1/2=50%, No=1/2=50%
      expect(result.rowPercentages['Female']['Yes']).toBeCloseTo(50, 2);
      expect(result.rowPercentages['Female']['No']).toBeCloseTo(50, 2);
    });

    it('should calculate column percentages correctly', async () => {
      const result = await CrosstabProcessor.generateCrosstab(sampleCSV, 'Gender', 'Response');
      
      // Yes column: Male=2/3=66.67%, Female=1/3=33.33%
      expect(result.columnPercentages['Male']['Yes']).toBeCloseTo(66.67, 2);
      expect(result.columnPercentages['Female']['Yes']).toBeCloseTo(33.33, 2);
      
      // No column: Male=1/2=50%, Female=1/2=50%
      expect(result.columnPercentages['Male']['No']).toBeCloseTo(50, 2);
      expect(result.columnPercentages['Female']['No']).toBeCloseTo(50, 2);
    });

    it('should calculate total percentages correctly', async () => {
      const result = await CrosstabProcessor.generateCrosstab(sampleCSV, 'Gender', 'Response');
      
      // All percentages should add up to 100%
      expect(result.totalPercentages['Male']['Yes']).toBeCloseTo(40, 2); // 2/5
      expect(result.totalPercentages['Male']['No']).toBeCloseTo(20, 2);  // 1/5
      expect(result.totalPercentages['Female']['Yes']).toBeCloseTo(20, 2); // 1/5
      expect(result.totalPercentages['Female']['No']).toBeCloseTo(20, 2);  // 1/5
    });

    it('should handle zero values in percentages', async () => {
      const zeroTestCSV = `Gender,Response
Male,Yes
Male,Yes
Female,No`;
      
      const result = await CrosstabProcessor.generateCrosstab(zeroTestCSV, 'Gender', 'Response');
      
      // Male has no 'No' responses, should be 0%
      expect(result.rowPercentages['Male']['No']).toBe(0);
      expect(result.columnPercentages['Male']['No']).toBe(0);
      expect(result.totalPercentages['Male']['No']).toBe(0);
    });
  });

  describe('regression prevention tests', () => {
    describe('division by zero safety', () => {
      it('should handle zero row totals without crashing', async () => {
        // Create data where some row has zero total (edge case)
        const zeroRowCSV = `Gender,Response
Male,Yes
Male,No`;
        
        const result = await CrosstabProcessor.generateCrosstab(zeroRowCSV, 'Gender', 'Response');
        
        // All percentage calculations should return 0 for non-existent Female row
        expect(result.rowPercentages['Female']).toBeUndefined();
        expect(result.columnPercentages['Female']).toBeUndefined();
        expect(result.totalPercentages['Female']).toBeUndefined();
        
        // Existing data should still calculate correctly
        expect(result.rowPercentages['Male']['Yes']).toBeCloseTo(50, 2);
        expect(result.rowPercentages['Male']['No']).toBeCloseTo(50, 2);
      });

      it('should handle zero column totals without crashing', async () => {
        const result = await CrosstabProcessor.generateCrosstab('Gender,Response\nMale,Yes\nFemale,Yes', 'Gender', 'Response');
        
        // No 'No' responses exist, so those calculations should be safe
        expect(result.columnPercentages['Male']['No']).toBe(0);
        expect(result.columnPercentages['Female']['No']).toBe(0);
        
        // Yes column should calculate correctly (100% distribution)
        expect(result.columnPercentages['Male']['Yes']).toBeCloseTo(50, 2);
        expect(result.columnPercentages['Female']['Yes']).toBeCloseTo(50, 2);
      });

      it('should handle zero grand total without crashing', async () => {
        const emptyDataCSV = 'Gender,Response\n'; // Header only
        
        await expect(
          CrosstabProcessor.generateCrosstab(emptyDataCSV, 'Gender', 'Response')
        ).rejects.toThrow('CSV must contain at least a header row and one data row');
      });
    });

    describe('data structure contract validation', () => {
      it('must always return complete percentage matrices', async () => {
        const result = await CrosstabProcessor.generateCrosstab(sampleCSV, 'Gender', 'Response');
        
        // Verify all three percentage matrices exist
        expect(result.rowPercentages).toBeDefined();
        expect(result.columnPercentages).toBeDefined();
        expect(result.totalPercentages).toBeDefined();
        
        // Verify matrix completeness - every row/column combination must exist
        const rowKeys = Object.keys(result.crosstab);
        const colKeys = Object.keys(result.columnTotals);
        
        for (const rowKey of rowKeys) {
          expect(result.rowPercentages[rowKey]).toBeDefined();
          expect(result.columnPercentages[rowKey]).toBeDefined();
          expect(result.totalPercentages[rowKey]).toBeDefined();
          
          for (const colKey of colKeys) {
            expect(result.rowPercentages[rowKey][colKey]).toBeDefined();
            expect(result.columnPercentages[rowKey][colKey]).toBeDefined();
            expect(result.totalPercentages[rowKey][colKey]).toBeDefined();
            
            // All percentages must be numbers
            expect(typeof result.rowPercentages[rowKey][colKey]).toBe('number');
            expect(typeof result.columnPercentages[rowKey][colKey]).toBe('number');
            expect(typeof result.totalPercentages[rowKey][colKey]).toBe('number');
          }
        }
      });

      it('must maintain row percentage mathematical consistency', async () => {
        const result = await CrosstabProcessor.generateCrosstab(sampleCSV, 'Gender', 'Response');
        
        // Each row's percentages must sum to 100% (within floating point tolerance)
        for (const rowKey of Object.keys(result.crosstab)) {
          const rowPercentageSum = Object.values(result.rowPercentages[rowKey])
            .reduce((sum, pct) => sum + pct, 0);
          expect(rowPercentageSum).toBeCloseTo(100, 1);
        }
      });

      it('must maintain column percentage mathematical consistency', async () => {
        const result = await CrosstabProcessor.generateCrosstab(sampleCSV, 'Gender', 'Response');
        
        // Each column's percentages must sum to 100% (within floating point tolerance)
        const colKeys = Object.keys(result.columnTotals);
        for (const colKey of colKeys) {
          const colPercentageSum = Object.keys(result.crosstab)
            .reduce((sum, rowKey) => sum + result.columnPercentages[rowKey][colKey], 0);
          expect(colPercentageSum).toBeCloseTo(100, 1);
        }
      });

      it('must maintain total percentage mathematical consistency', async () => {
        const result = await CrosstabProcessor.generateCrosstab(sampleCSV, 'Gender', 'Response');
        
        // All total percentages must sum to 100%
        let totalPercentageSum = 0;
        for (const rowKey of Object.keys(result.crosstab)) {
          for (const colKey of Object.keys(result.columnTotals)) {
            totalPercentageSum += result.totalPercentages[rowKey][colKey];
          }
        }
        expect(totalPercentageSum).toBeCloseTo(100, 1);
      });
    });

    describe('unicode normalization regression prevention', () => {
      it('must handle em-dashes and en-dashes consistently', () => {
        const testContent = 'Age Group,Count\n25—30,5\n30–35,3\n35—40,2';
        const normalized = CrosstabProcessor.normalizeUnicodeCharacters(testContent);
        
        // All dashes should be converted to regular hyphens
        expect(normalized).not.toContain('—');
        expect(normalized).not.toContain('–');
        expect(normalized).toContain('25-30');
        expect(normalized).toContain('30-35');
        expect(normalized).toContain('35-40');
      });

      it('must handle box-drawing characters that cause display issues', () => {
        const testContent = 'Code,Value\n10───12,5\n15─20,3';
        const normalized = CrosstabProcessor.normalizeUnicodeCharacters(testContent);
        
        // Box-drawing characters should be converted to hyphens
        expect(normalized).not.toContain('─');
        expect(normalized).toContain('10---12');  // Multiple box chars become multiple hyphens
        expect(normalized).toContain('15-20');
      });

      it('must handle smart quotes without breaking CSV parsing', () => {
        const testContent = 'Name,Description\n"John","He said "hello""\n"Jane","She said 'hi'"';
        const normalized = CrosstabProcessor.normalizeUnicodeCharacters(testContent);
        
        // Smart quotes should be converted to regular quotes
        expect(normalized).not.toContain('"');
        expect(normalized).not.toContain('"');
        expect(normalized).not.toContain(''');
        expect(normalized).not.toContain(''');
        expect(normalized).toContain('He said "hello"');
        expect(normalized).toContain("She said 'hi'");
      });
    });

    describe('performance limit enforcement', () => {
      it('must reject oversized file content', () => {
        // Create content that exceeds MAX_FILE_SIZE_MB (50MB)
        const oversizedContent = 'A'.repeat(51 * 1024 * 1024); // 51MB
        
        expect(() => {
          CrosstabProcessor.extractFields(oversizedContent);
        }).toThrow(/File too large.*51\.0MB.*Maximum supported: 50MB/);
      });

      it('must validate processing limits before starting', () => {
        // Create content that would exceed row limits
        const manyRowsContent = 'A,B\n' + 'x,y\n'.repeat(100001); // 100,001 rows
        
        expect(() => {
          CrosstabProcessor.validateProcessingLimits(manyRowsContent, 'test operation');
        }).toThrow(/File has too many rows.*100001.*Maximum: 100000 rows/);
      });
    });

    describe('matrix completeness guarantees', () => {
      it('must create zero entries for all row/column combinations', async () => {
        const sparseCSV = `Gender,Response
Male,Yes
Female,No`;
        
        const result = await CrosstabProcessor.generateCrosstab(sparseCSV, 'Gender', 'Response');
        
        // All combinations must exist, even with zero counts
        expect(result.crosstab['Male']['Yes']).toBe(1);
        expect(result.crosstab['Male']['No']).toBe(0);  // This should exist as 0
        expect(result.crosstab['Female']['Yes']).toBe(0); // This should exist as 0
        expect(result.crosstab['Female']['No']).toBe(1);
        
        // Percentages should also exist for all combinations
        expect(result.rowPercentages['Male']['No']).toBe(0);
        expect(result.rowPercentages['Female']['Yes']).toBe(0);
      });
    });
  });
});