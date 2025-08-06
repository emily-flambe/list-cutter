import React from 'react';
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
  useMediaQuery
} from '@mui/material';

const CuttytabsTable = ({ data, rowVariable, columnVariable }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  if (!data || !data.crosstab) {
    return (
      <Typography color="text.secondary">
        No crosstab data available
      </Typography>
    );
  }

  const { crosstab, rowTotals, columnTotals, grandTotal } = data;
  
  // Get sorted row and column keys for consistent display
  const rowKeys = Object.keys(crosstab).sort();
  const columnKeys = Object.keys(columnTotals).sort();

  return (
    <Box sx={{ width: '100%', overflow: 'hidden' }}>
      <TableContainer 
        component={Paper} 
        variant="outlined"
        sx={{ 
          maxHeight: 600,
          overflow: 'auto',
          border: '1px solid',
          borderColor: 'divider',
          '& .MuiTableCell-root': {
            fontSize: isMobile ? '0.75rem' : '0.875rem',
            padding: isMobile ? '8px 4px' : '12px 8px',
          }
        }}
      >
        <Table stickyHeader size={isMobile ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              {/* Top-left corner cell with variable names */}
              <TableCell 
                sx={{ 
                  fontWeight: 'bold',
                  backgroundColor: 'grey.100',
                  minWidth: isMobile ? '80px' : '120px',
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  borderRight: '2px solid',
                  borderColor: 'divider'
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                  {rowVariable}
                </Typography>
                <br />
                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                  / {columnVariable}
                </Typography>
              </TableCell>
              
              {/* Column headers */}
              {columnKeys.map((colKey) => (
                <TableCell 
                  key={colKey}
                  align="center"
                  sx={{ 
                    fontWeight: 'bold',
                    backgroundColor: 'grey.100',
                    minWidth: isMobile ? '60px' : '80px'
                  }}
                >
                  {colKey}
                </TableCell>
              ))}
              
              {/* Total column header */}
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
            {/* Data rows */}
            {rowKeys.map((rowKey) => (
              <TableRow key={rowKey} hover>
                {/* Row header */}
                <TableCell 
                  component="th" 
                  scope="row"
                  sx={{ 
                    fontWeight: 'bold',
                    backgroundColor: 'grey.50',
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    borderRight: '2px solid',
                    borderColor: 'divider'
                  }}
                >
                  {rowKey}
                </TableCell>
                
                {/* Data cells */}
                {columnKeys.map((colKey) => {
                  const value = crosstab[rowKey]?.[colKey] || 0;
                  return (
                    <TableCell 
                      key={colKey}
                      align="center"
                      sx={{
                        backgroundColor: value === 0 ? 'grey.50' : 'background.default',
                        color: value === 0 ? 'text.disabled' : 'text.primary'
                      }}
                    >
                      {value}
                    </TableCell>
                  );
                })}
                
                {/* Row total */}
                <TableCell 
                  align="center"
                  sx={{ 
                    fontWeight: 'bold',
                    backgroundColor: 'primary.light',
                    color: 'primary.contrastText'
                  }}
                >
                  {rowTotals[rowKey] || 0}
                </TableCell>
              </TableRow>
            ))}
            
            {/* Column totals row */}
            <TableRow sx={{ backgroundColor: 'primary.light' }}>
              <TableCell 
                sx={{ 
                  fontWeight: 'bold',
                  color: 'primary.contrastText',
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  borderRight: '2px solid',
                  borderColor: 'divider',
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
                  {columnTotals[colKey] || 0}
                </TableCell>
              ))}
              
              {/* Grand total */}
              <TableCell 
                align="center"
                sx={{ 
                  fontWeight: 'bold',
                  backgroundColor: 'primary.dark',
                  color: 'primary.contrastText',
                  fontSize: '1rem'
                }}
              >
                {grandTotal}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* Summary information */}
      <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Rows: {rowKeys.length}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Columns: {columnKeys.length}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Total Records: {grandTotal}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Non-zero Cells: {
            rowKeys.reduce((count, rowKey) => 
              count + columnKeys.filter(colKey => 
                crosstab[rowKey]?.[colKey] > 0
              ).length, 0
            )
          } / {rowKeys.length * columnKeys.length}
        </Typography>
      </Box>
    </Box>
  );
};

export default CuttytabsTable;