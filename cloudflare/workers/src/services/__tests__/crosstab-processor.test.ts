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
});