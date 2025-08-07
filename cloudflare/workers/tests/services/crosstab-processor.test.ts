/**
 * Tests for CrosstabProcessor
 */

import { describe, it, expect } from 'vitest';
import { CrosstabProcessor } from '../../src/services/crosstab-processor';

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
});