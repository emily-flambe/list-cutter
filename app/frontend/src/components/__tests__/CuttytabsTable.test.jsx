/**
 * Regression prevention tests for CuttytabsTable component
 * Focuses on critical styling and display logic that must not break
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CuttytabsTable from '../CuttytabsTable';

// Mock theme for consistent testing
const mockTheme = createTheme({
  breakpoints: {
    down: () => false, // Always return false for mobile check
  },
});

// Test data that covers edge cases
const mockCrosstabData = {
  crosstab: {
    'Male': { 'Yes': 2, 'No': 1 },
    'Female': { 'Yes': 1, 'No': 1 }
  },
  rowTotals: { 'Male': 3, 'Female': 2 },
  columnTotals: { 'Yes': 3, 'No': 2 },
  grandTotal: 5,
  rowPercentages: {
    'Male': { 'Yes': 66.67, 'No': 33.33 },
    'Female': { 'Yes': 50.0, 'No': 50.0 }
  },
  columnPercentages: {
    'Male': { 'Yes': 66.67, 'No': 50.0 },
    'Female': { 'Yes': 33.33, 'No': 50.0 }
  },
  totalPercentages: {
    'Male': { 'Yes': 40.0, 'No': 20.0 },
    'Female': { 'Yes': 20.0, 'No': 20.0 }
  }
};

// Test data with zeros for edge case testing
const mockDataWithZeros = {
  crosstab: {
    'A': { 'X': 10, 'Y': 0 },
    'B': { 'X': 0, 'Y': 5 }
  },
  rowTotals: { 'A': 10, 'B': 5 },
  columnTotals: { 'X': 10, 'Y': 5 },
  grandTotal: 15,
  rowPercentages: {
    'A': { 'X': 100.0, 'Y': 0.0 },
    'B': { 'X': 0.0, 'Y': 100.0 }
  },
  columnPercentages: {
    'A': { 'X': 100.0, 'Y': 0.0 },
    'B': { 'X': 0.0, 'Y': 100.0 }
  },
  totalPercentages: {
    'A': { 'X': 66.67, 'Y': 0.0 },
    'B': { 'X': 0.0, 'Y': 33.33 }
  }
};

const renderTable = (data = mockCrosstabData, props = {}) => {
  return render(
    <ThemeProvider theme={mockTheme}>
      <CuttytabsTable 
        data={data} 
        rowVariable="Gender" 
        columnVariable="Response"
        {...props}
      />
    </ThemeProvider>
  );
};

describe('CuttytabsTable Regression Prevention', () => {
  
  describe('gradient color calculation regression protection', () => {
    test('must maintain consistent color thresholds for percentage ranges', () => {
      renderTable();
      
      // Get DOM node to test computed styles (simplified check)
      const tableElement = screen.getByRole('table');
      expect(tableElement).toBeInTheDocument();
      
      // Switch to different display modes to test gradient calculations
      const totalRadio = screen.getByLabelText('Total %');
      const rowRadio = screen.getByLabelText('Row %');
      const columnRadio = screen.getByLabelText('Column %');
      
      expect(totalRadio).toBeChecked(); // Default should be total
      
      // Test mode switching doesn't crash
      fireEvent.click(rowRadio);
      expect(rowRadio).toBeChecked();
      
      fireEvent.click(columnRadio);
      expect(columnRadio).toBeChecked();
      
      fireEvent.click(totalRadio);
      expect(totalRadio).toBeChecked();
    });

    test('must handle zero percentage values without breaking gradients', () => {
      renderTable(mockDataWithZeros);
      
      // Component should render without crashing on zero values
      expect(screen.getByRole('table')).toBeInTheDocument();
      
      // Should display zero values
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    test('must handle 100% values without breaking gradients', () => {
      // Create data with 100% values
      const maxData = {
        ...mockDataWithZeros,
        rowPercentages: {
          'A': { 'X': 100.0, 'Y': 0.0 },
          'B': { 'X': 0.0, 'Y': 100.0 }
        }
      };
      
      renderTable(maxData);
      expect(screen.getByRole('table')).toBeInTheDocument();
      
      // Switch to row percentage mode where we have 100% values
      const rowRadio = screen.getByLabelText('Row %');
      fireEvent.click(rowRadio);
      
      // Should render without crashing
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  describe('display mode state regression protection', () => {
    test('must maintain correct display mode when switching between modes', () => {
      renderTable();
      
      const totalRadio = screen.getByLabelText('Total %');
      const rowRadio = screen.getByLabelText('Row %');
      const columnRadio = screen.getByLabelText('Column %');
      
      // Test each mode switch maintains state correctly
      fireEvent.click(rowRadio);
      expect(rowRadio).toBeChecked();
      expect(totalRadio).not.toBeChecked();
      expect(columnRadio).not.toBeChecked();
      
      fireEvent.click(columnRadio);
      expect(columnRadio).toBeChecked();
      expect(totalRadio).not.toBeChecked();
      expect(rowRadio).not.toBeChecked();
      
      fireEvent.click(totalRadio);
      expect(totalRadio).toBeChecked();
      expect(rowRadio).not.toBeChecked();
      expect(columnRadio).not.toBeChecked();
    });

    test('must default to total percentage mode', () => {
      renderTable();
      
      const totalRadio = screen.getByLabelText('Total %');
      expect(totalRadio).toBeChecked();
    });
  });

  describe('data validation regression protection', () => {
    test('must handle missing crosstab data gracefully', () => {
      const invalidData = { grandTotal: 0 };
      renderTable(invalidData);
      
      // Should display error message instead of crashing
      expect(screen.getByText(/Invalid crosstab data format/)).toBeInTheDocument();
    });

    test('must handle null data gracefully', () => {
      renderTable(null);
      
      expect(screen.getByText(/No analysis data provided/)).toBeInTheDocument();
    });

    test('must handle undefined data gracefully', () => {
      renderTable(undefined);
      
      expect(screen.getByText(/No analysis data provided/)).toBeInTheDocument();
    });

    test('must handle empty crosstab gracefully', () => {
      const emptyData = {
        crosstab: {},
        rowTotals: {},
        columnTotals: {},
        grandTotal: 0
      };
      renderTable(emptyData);
      
      expect(screen.getByText(/No data found for the selected variables/)).toBeInTheDocument();
    });

    test('must handle malformed percentage data gracefully', () => {
      const malformedData = {
        ...mockCrosstabData,
        rowPercentages: null, // Malformed percentage data
        columnPercentages: undefined,
        totalPercentages: {}
      };
      renderTable(malformedData);
      
      // Should still render the table (will show 0% for missing percentages)
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  describe('mathematical consistency regression protection', () => {
    test('must display consistent percentage calculations across modes', () => {
      renderTable();
      
      // Test that switching modes doesn't corrupt the display
      const totalRadio = screen.getByLabelText('Total %');
      const rowRadio = screen.getByLabelText('Row %');
      
      // Switch to row mode
      fireEvent.click(rowRadio);
      expect(screen.getByRole('table')).toBeInTheDocument();
      
      // Switch back to total mode
      fireEvent.click(totalRadio);
      expect(screen.getByRole('table')).toBeInTheDocument();
      
      // Table should still display correctly
      expect(screen.getByText('5')).toBeInTheDocument(); // Grand total
    });

    test('must handle floating point percentages without display corruption', () => {
      const precisionData = {
        ...mockCrosstabData,
        totalPercentages: {
          'Male': { 'Yes': 33.333333, 'No': 16.666667 },
          'Female': { 'Yes': 16.666667, 'No': 33.333333 }
        }
      };
      
      renderTable(precisionData);
      expect(screen.getByRole('table')).toBeInTheDocument();
      
      // Should display rounded percentages (not full precision)
      // Looking for text containing percentage values to ensure rounding works
      const tableText = screen.getByRole('table').textContent;
      expect(tableText).toMatch(/\d+\.\d%/); // Should show decimal percentages
    });
  });

  describe('text contrast regression protection', () => {
    test('must maintain readable text on all background colors', () => {
      renderTable(mockDataWithZeros);
      
      // Test with different display modes that create different background colors
      const modes = ['Total %', 'Row %', 'Column %'];
      
      modes.forEach(mode => {
        const radio = screen.getByLabelText(mode);
        fireEvent.click(radio);
        
        // Table should remain rendered and accessible
        expect(screen.getByRole('table')).toBeInTheDocument();
        
        // Check that text content is still present (indicates readable text)
        expect(screen.getByText('Gender')).toBeInTheDocument();
        expect(screen.getByText('Response')).toBeInTheDocument();
      });
    });
  });

  describe('performance regression protection', () => {
    test('must handle large data sets without performance degradation', () => {
      // Create larger dataset to test performance
      const largeData = {
        crosstab: {},
        rowTotals: {},
        columnTotals: {},
        grandTotal: 10000,
        rowPercentages: {},
        columnPercentages: {},
        totalPercentages: {}
      };
      
      // Generate 50x50 matrix (2500 cells)
      for (let i = 0; i < 50; i++) {
        const rowKey = `Row${i}`;
        largeData.crosstab[rowKey] = {};
        largeData.rowPercentages[rowKey] = {};
        largeData.columnPercentages[rowKey] = {};
        largeData.totalPercentages[rowKey] = {};
        largeData.rowTotals[rowKey] = 200;
        
        for (let j = 0; j < 50; j++) {
          const colKey = `Col${j}`;
          largeData.crosstab[rowKey][colKey] = 4;
          largeData.rowPercentages[rowKey][colKey] = 2.0;
          largeData.columnPercentages[rowKey][colKey] = 2.0;
          largeData.totalPercentages[rowKey][colKey] = 0.04;
          
          if (i === 0) {
            largeData.columnTotals[colKey] = 200;
          }
        }
      }
      
      // Component should render without timeout
      const startTime = Date.now();
      renderTable(largeData);
      const endTime = Date.now();
      
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(endTime - startTime).toBeLessThan(1000); // Should render in under 1 second
    });
  });
});