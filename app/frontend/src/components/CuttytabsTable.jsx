import React, { useMemo, useEffect, useRef } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  useTheme,
  useMediaQuery,
  Alert,
  Chip
} from '@mui/material';

const CuttytabsTable = ({ data, rowVariable, columnVariable }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const tableRef = useRef(null);
  
  const optimizedData = useMemo(() => {
    
    // Comprehensive validation for edge cases
    if (!data) {
      return { error: 'No analysis data provided' };
    }

    if (!data.crosstab || typeof data.crosstab !== 'object') {
      return { error: 'Invalid crosstab data format' };
    }

    const { crosstab, rowTotals, columnTotals, grandTotal } = data;
    
    // Validate data structure
    if (!rowTotals || !columnTotals) {
      return { error: 'Missing totals data in crosstab' };
    }

    if (typeof grandTotal !== 'number' || grandTotal < 0) {
      return { error: 'Invalid grand total in crosstab data' };
    }
    
    // Get sorted row and column keys for consistent display
    const rowKeys = Object.keys(crosstab).sort();
    const columnKeys = Object.keys(columnTotals).sort();
    
    // Handle empty results
    if (rowKeys.length === 0 || columnKeys.length === 0) {
      return { error: 'empty', rowKeys, columnKeys };
    }

    const totalCells = rowKeys.length * columnKeys.length;
    const nonZeroCells = rowKeys.reduce((count, rowKey) => 
      count + columnKeys.filter(colKey => 
        crosstab[rowKey]?.[colKey] > 0
      ).length, 0
    );
    const sparsity = (nonZeroCells / totalCells) * 100;
    
    const isLarge = totalCells > 5000;
    const isVeryLarge = totalCells > 20000;
    const isSparse = sparsity < 15;
    
    return {
      crosstab,
      rowTotals,
      columnTotals,
      grandTotal,
      rowKeys,
      columnKeys,
      totalCells,
      nonZeroCells,
      sparsity,
      isLarge,
      isVeryLarge,
      isSparse
    };
  }, [data]);

  // Handle errors from memoized calculation
  if (optimizedData.error) {
    if (optimizedData.error === 'empty') {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="text.secondary" variant="h6">
            No data found for the selected variables
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
            Try selecting different variables or check your data file.
          </Typography>
        </Box>
      );
    }
    
    return (
      <Typography color="text.secondary">
        {optimizedData.error}
      </Typography>
    );
  }

  const { 
    crosstab, 
    rowTotals, 
    columnTotals, 
    grandTotal, 
    rowKeys, 
    columnKeys,
    totalCells,
    nonZeroCells,
    sparsity,
    isLarge,
    isVeryLarge,
    isSparse
  } = optimizedData;

  return (
    <Box sx={{ width: '100%', overflow: 'hidden' }}>
      <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Rows: {rowKeys.length.toLocaleString()}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Columns: {columnKeys.length.toLocaleString()}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Total Records: {typeof grandTotal === 'number' ? grandTotal.toLocaleString() : '0'}
        </Typography>
      </Box>
      
      {isVeryLarge && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Large crosstab detected ({totalCells.toLocaleString()} cells).
        </Alert>
      )}
      
      <TableContainer 
        ref={tableRef}
        component={Paper} 
        variant="outlined"
        sx={{ 
          maxHeight: isVeryLarge ? 400 : isLarge ? 500 : 600,
          overflow: 'auto',
          border: '1px solid',
          borderColor: 'divider',
          '& .MuiTableCell-root': {
            fontSize: isMobile ? '0.7rem' : isLarge ? '0.8rem' : '0.875rem',
            padding: isMobile ? '6px 3px' : isLarge ? '8px 6px' : '12px 8px',
            lineHeight: isLarge ? 1.2 : 1.43,
            border: '1px solid #000000 !important',
          },
          transform: 'translateZ(0)',
          willChange: 'scroll-position'
        }}
      >
        <Table 
          stickyHeader 
          size={isMobile ? 'small' : isLarge ? 'small' : 'medium'}
          sx={{
            tableLayout: isLarge ? 'fixed' : 'auto',
            borderCollapse: 'collapse !important',
            borderSpacing: 0,
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell 
                sx={{ 
                  fontWeight: 'bold',
                  backgroundColor: 'grey.400',
                  color: '#000000 !important',
                  minWidth: isMobile ? '80px' : '120px',
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#000000 !important', fontSize: '0.65rem' }}>
                  Cols →: {columnVariable}
                </Typography>
                <br />
                <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#000000 !important', fontSize: '0.65rem' }}>
                  Rows ↓: {rowVariable}
                </Typography>
              </TableCell>
              
              {columnKeys.map((colKey) => (
                <TableCell 
                  key={colKey}
                  align="center"
                  sx={{ 
                    fontWeight: 'bold',
                    backgroundColor: 'grey.300',
                    color: '#000000 !important',
                    minWidth: isMobile ? '60px' : '80px',
                  }}
                >
                  {colKey}
                </TableCell>
              ))}
              
              <TableCell 
                align="center"
                sx={{ 
                  fontWeight: 'bold',
                  backgroundColor: 'primary.light',
                  color: 'primary.contrastText',
                  minWidth: isMobile ? '60px' : '80px'
                }}
              >
                Total
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rowKeys.map((rowKey) => (
              <TableRow key={rowKey} hover>
                <TableCell 
                  component="th" 
                  scope="row"
                  sx={{ 
                    fontWeight: 'bold',
                    backgroundColor: 'grey.300',
                    color: '#000000 !important',
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                  }}
                >
                  {rowKey}
                </TableCell>
                
                {columnKeys.map((colKey) => {
                  const value = crosstab[rowKey]?.[colKey];
                  const displayValue = typeof value === 'number' ? value : 0;
                  const isZero = displayValue === 0;
                  const formattedValue = isLarge && displayValue > 999 ? displayValue.toLocaleString() : displayValue;
                  
                  return (
                    <TableCell 
                      key={colKey}
                      align="center"
                      sx={{
                        backgroundColor: '#ffffff !important',
                        color: isZero ? '#666666' : '#000000',
                        fontWeight: isZero ? 'normal' : 'medium',
                        ...(isLarge && {
                          borderRight: 'none',
                          '&:hover': {
                            backgroundColor: '#f5f5f5 !important'
                          }
                        })
                      }}
                    >
                      {formattedValue}
                    </TableCell>
                  );
                })}
                
                <TableCell 
                  align="center"
                  sx={{ 
                    fontWeight: 'bold',
                    backgroundColor: 'primary.light',
                    color: 'primary.contrastText'
                  }}
                >
                  {isLarge && typeof rowTotals[rowKey] === 'number' && rowTotals[rowKey] > 999 
                    ? rowTotals[rowKey].toLocaleString() 
                    : (typeof rowTotals[rowKey] === 'number' ? rowTotals[rowKey] : '0')}
                </TableCell>
              </TableRow>
            ))}
            
            <TableRow sx={{ backgroundColor: 'primary.light' }}>
              <TableCell 
                sx={{ 
                  fontWeight: 'bold',
                  color: 'primary.contrastText',
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  backgroundColor: 'primary.light'
                }}
              >
                Total
              </TableCell>
              
              {columnKeys.map((colKey) => (
                <TableCell 
                  key={colKey}
                  align="center"
                  sx={{ 
                    fontWeight: 'bold',
                    color: 'primary.contrastText'
                  }}
                >
                  {isLarge && typeof columnTotals[colKey] === 'number' && columnTotals[colKey] > 999 
                    ? columnTotals[colKey].toLocaleString() 
                    : (typeof columnTotals[colKey] === 'number' ? columnTotals[colKey] : '0')}
                </TableCell>
              ))}
              
              <TableCell 
                align="center"
                sx={{ 
                  fontWeight: 'bold',
                  backgroundColor: 'primary.dark',
                  color: 'primary.contrastText',
                  fontSize: '1rem'
                }}
              >
                {isLarge && typeof grandTotal === 'number' && grandTotal > 999 
                  ? grandTotal.toLocaleString() 
                  : (typeof grandTotal === 'number' ? grandTotal : '0')}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      
    </Box>
  );
};

export default CuttytabsTable;