import React, { useMemo, useEffect, useRef, useState } from 'react';
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
  Chip,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup
} from '@mui/material';

const CuttytabsTable = ({ data, rowVariable, columnVariable }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const tableRef = useRef(null);
  const [displayMode, setDisplayMode] = useState('total'); // 'row', 'column', 'total'
  
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

  // Function to get cell display based on current display mode
  const getCellDisplay = (rowKey, colKey) => {
    const count = crosstab[rowKey]?.[colKey] || 0;
    const formattedCount = isLarge && count > 999 ? count.toLocaleString() : count;
    
    // Get background to determine text color
    const bgColor = getCellBackground(rowKey, colKey);
    const isDark = bgColor === '#475569' || bgColor === '#64748b' || bgColor === '#94a3b8';
    const percentageColor = isDark ? '#e2e8f0' : '#666'; // Light text only on dark backgrounds
    
    switch (displayMode) {
      case 'row':
        const rowPct = data.rowPercentages?.[rowKey]?.[colKey] || 0;
        return (
          <Box component="div">
            <div>{formattedCount}</div>
            <div style={{ fontSize: '0.75em', color: percentageColor, marginTop: '2px' }}>
              {rowPct.toFixed(1)}%
            </div>
          </Box>
        );
      case 'column':
        const colPct = data.columnPercentages?.[rowKey]?.[colKey] || 0;
        return (
          <Box component="div">
            <div>{formattedCount}</div>
            <div style={{ fontSize: '0.75em', color: percentageColor, marginTop: '2px' }}>
              {colPct.toFixed(1)}%
            </div>
          </Box>
        );
      case 'total':
        const totalPct = data.totalPercentages?.[rowKey]?.[colKey] || 0;
        return (
          <Box component="div">
            <div>{formattedCount}</div>
            <div style={{ fontSize: '0.75em', color: percentageColor, marginTop: '2px' }}>
              {totalPct.toFixed(1)}%
            </div>
          </Box>
        );
      default:
        // Default to total percentages if somehow no mode is set
        const defaultTotalPct = data.totalPercentages?.[rowKey]?.[colKey] || 0;
        return (
          <Box component="div">
            <div>{formattedCount}</div>
            <div style={{ fontSize: '0.75em', color: percentageColor, marginTop: '2px' }}>
              {defaultTotalPct.toFixed(1)}%
            </div>
          </Box>
        );
    }
  };

  // Function to get background color based on current display mode
  const getCellBackground = (rowKey, colKey) => {
    const count = crosstab[rowKey]?.[colKey] || 0;
    if (count === 0) return '#f8f9fa';
    
    // Get the percentage based on current display mode
    let percentage;
    switch (displayMode) {
      case 'row':
        percentage = data.rowPercentages?.[rowKey]?.[colKey] || 0;
        break;
      case 'column':
        percentage = data.columnPercentages?.[rowKey]?.[colKey] || 0;
        break;
      case 'total':
        percentage = data.totalPercentages?.[rowKey]?.[colKey] || 0;
        break;
      default:
        return '#ffffff'; // Fallback
    }
    
    // More continuous gradient with more buckets
    if (percentage >= 80) return '#475569'; // Darkest slate
    if (percentage >= 60) return '#64748b'; // Dark slate
    if (percentage >= 40) return '#94a3b8'; // Medium slate
    if (percentage >= 25) return '#cbd5e1'; // Light slate
    if (percentage >= 15) return '#e2e8f0'; // Very light slate
    if (percentage >= 8) return '#f1f5f9'; // Barely visible slate
    if (percentage >= 3) return '#f8fafc'; // Almost white
    return '#ffffff'; // White for very small percentages
  };

  // Function to get background intensity for subtotals - Night theme gradient to primary.dark
  const getSubtotalBackground = (percentage) => {
    // Gradient from light blue to primary.dark (Night theme)
    if (percentage >= 80) return '#0d47a1'; // primary.dark equivalent - matches grand total
    if (percentage >= 50) return '#1565c0'; // Dark blue for medium-high (50%)
    if (percentage >= 20) return '#1976d2'; // Medium blue for medium (19%)
    if (percentage >= 10) return '#42a5f5'; // Light-medium blue for low-medium (12%)
    if (percentage >= 5) return '#64b5f6'; // Light blue for low (6-7%)
    return '#90caf9'; // Very light blue for very low (0.23%)
  };

  // Function to display row totals with percentages
  const getRowTotalDisplay = (rowKey) => {
    const total = rowTotals[rowKey] || 0;
    const formattedTotal = isLarge && total > 999 ? total.toLocaleString() : total;
    const rowPct = ((total / grandTotal) * 100) || 0;
    
    return (
      <Box component="div">
        <div>{formattedTotal}</div>
        <div style={{ fontSize: '0.75em', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
          {rowPct.toFixed(1)}%
        </div>
      </Box>
    );
  };

  // Function to display column totals with percentages  
  const getColumnTotalDisplay = (colKey) => {
    const total = columnTotals[colKey] || 0;
    const formattedTotal = isLarge && total > 999 ? total.toLocaleString() : total;
    const colPct = ((total / grandTotal) * 100) || 0;
    
    return (
      <Box component="div">
        <div>{formattedTotal}</div>
        <div style={{ fontSize: '0.75em', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
          {colPct.toFixed(1)}%
        </div>
      </Box>
    );
  };

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
      
      {/* Display Mode Toggle Controls */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
        <FormControl component="fieldset">
          <RadioGroup row value={displayMode} onChange={(e) => setDisplayMode(e.target.value)}>
            <FormControlLabel value="total" control={<Radio />} label="Total %" />
            <FormControlLabel value="row" control={<Radio />} label="Row %" />
            <FormControlLabel value="column" control={<Radio />} label="Column %" />
          </RadioGroup>
        </FormControl>
      </Box>
      
      <TableContainer 
        ref={tableRef}
        component={Paper} 
        variant="outlined"
        sx={{ 
          maxHeight: 600,
          overflow: 'auto',
          border: '1px solid',
          borderColor: 'divider',
          '& .MuiTableCell-root': {
            fontSize: isMobile ? '0.7rem' : '0.875rem',
            padding: isMobile ? '6px 4px' : '12px 8px',
            lineHeight: 1.43,
            border: '1px solid #000000 !important',
          },
        }}
      >
        <Table 
          stickyHeader 
          size="medium"
          sx={{
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
                  minWidth: '120px',
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
                  const cellContent = getCellDisplay(rowKey, colKey);
                  const bgColor = getCellBackground(rowKey, colKey);
                  
                  return (
                    <TableCell 
                      key={colKey}
                      align="center"
                      sx={{
                        backgroundColor: `${bgColor} !important`,
                        color: isZero ? '#666666' : '#000000',
                        fontWeight: isZero ? 'normal' : 'medium',
                      }}
                    >
                      {cellContent}
                    </TableCell>
                  );
                })}
                
                <TableCell 
                  align="center"
                  sx={{ 
                    fontWeight: 'bold',
                    backgroundColor: getSubtotalBackground(((rowTotals[rowKey] || 0) / (grandTotal || 1)) * 100),
                    color: 'primary.contrastText'
                  }}
                >
                  {getRowTotalDisplay(rowKey)}
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
                    backgroundColor: getSubtotalBackground(((columnTotals[colKey] || 0) / (grandTotal || 1)) * 100),
                    color: 'primary.contrastText'
                  }}
                >
                  {getColumnTotalDisplay(colKey)}
                </TableCell>
              ))}
              
              <TableCell 
                align="center"
                sx={{ 
                  fontWeight: 'bold',
                  backgroundColor: '#0a2e5c', // Darkest point of the gradient - darker than 80%+
                  color: '#ffffff', // White text for visibility on dark background
                  fontSize: '1rem'
                }}
              >
                <Box component="div">
                  <div>{isLarge && typeof grandTotal === 'number' && grandTotal > 999 
                    ? grandTotal.toLocaleString() 
                    : (typeof grandTotal === 'number' ? grandTotal : '0')}</div>
                  <div style={{ fontSize: '0.75em', color: '#ffffff', marginTop: '2px' }}>
                    100.0%
                  </div>
                </Box>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      
    </Box>
  );
};

export default CuttytabsTable;